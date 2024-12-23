import { SQLiteMemoryAdapter } from './SQLiteMemoryAdapter.js';

export class EnhancedSQLiteMemoryAdapter extends SQLiteMemoryAdapter {
	constructor(sql) {
		super(sql);
		this.stats = {
			totalMemories: 0,
			messagesProcessed: 0,
			lastCleanup: Date.now()
		};

		this.MEMORY_WARN_THRESHOLD = 10000;
		this.MEMORY_CRITICAL_THRESHOLD = 50000;
	}

	async initializeSchema() {
		// First call parent's initializeSchema to ensure all base tables exist
		await super.initializeSchema();

		try {
			// Get current columns
			const tableInfo = await this.sql.exec('PRAGMA table_info(memories)').toArray();
			const columns = tableInfo.map(col => col.name);

			// Add columns one at a time if they don't exist
			if (!columns.includes('importance_score')) {
				await this.sql.exec('ALTER TABLE memories ADD COLUMN importance_score FLOAT DEFAULT 0');
			}
			if (!columns.includes('access_count')) {
				await this.sql.exec('ALTER TABLE memories ADD COLUMN access_count INTEGER DEFAULT 0');
			}
			if (!columns.includes('last_accessed')) {
				await this.sql.exec('ALTER TABLE memories ADD COLUMN last_accessed TIMESTAMP');
			}
			if (!columns.includes('metadata')) {
				await this.sql.exec('ALTER TABLE memories ADD COLUMN metadata TEXT');
			}
			if (!columns.includes('userName')) {
				await this.sql.exec('ALTER TABLE memories ADD COLUMN userName TEXT');
			}

			// Create indexes - SQLite will ignore if they already exist
			await this.sql.exec(`
                CREATE INDEX IF NOT EXISTS idx_memories_importance 
                ON memories(importance_score);
                
                CREATE INDEX IF NOT EXISTS idx_memories_access 
                ON memories(access_count, last_accessed);

                CREATE TABLE IF NOT EXISTS memory_stats (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    total_memories INTEGER NOT NULL,
                    messages_processed INTEGER NOT NULL,
                    last_cleanup TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
			await this.sql.exec(`
				CREATE INDEX IF NOT EXISTS idx_memories_username 
				ON memories(userName);
				
				CREATE INDEX IF NOT EXISTS idx_memories_user 
				ON memories(userId, userName);
			  `);
		} catch (error) {
			console.error('Error adding enhanced columns:', error);
			// Continue even if enhancement fails - base functionality will still work
		}
	}

	async ensureRoomExists(roomId, agentId) {
		try {
			const room = await this.sql.exec(`
				SELECT id FROM rooms WHERE id = ? LIMIT 1
			`, roomId).toArray();

			if (!room.length) {
				await this.sql.exec(`
					INSERT INTO rooms (
						id,
						character_id,
						created_at,
						last_active
					) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
				`, roomId, agentId);
				return true;
			}
			return true;
		} catch (error) {
			console.error('Error ensuring room exists:', error);
			return false;
		}
	}

	// Add this method to help with room-related queries
	async getMemoriesByRoomId(roomId, options = {}) {
		try {
			const { limit = 10, type = null } = options;

			const query = `
				SELECT * FROM memories 
				WHERE roomId = ?
				${type ? 'AND type = ?' : ''}
				ORDER BY createdAt DESC
				LIMIT ?
			`;

			const params = type ? [roomId, type, limit] : [roomId, limit];

			const memories = await this.sql.exec(query, ...params).toArray();

			return memories.map(m => ({
				id: m.id,
				type: m.type,
				content: JSON.parse(m.content),
				userId: m.userId,
				roomId: m.roomId,
				agentId: m.agentId,
				createdAt: parseInt(m.createdAt),
				isUnique: Boolean(m.isUnique),
				importance_score: m.importance_score,
				metadata: m.metadata ? JSON.parse(m.metadata) : null
			}));
		} catch (error) {
			console.error('Error getting room memories:', error);
			return [];
		}
	}

	async getMemoriesByRoomIds({ agentId, roomIds, count = 5 }) {
		try {
			const memories = await this.sql.exec(`
                SELECT * FROM memories 
                WHERE agentId = ?
                AND roomId IN (${roomIds.map(() => '?').join(',')})
                ORDER BY createdAt DESC
                LIMIT ?
            `, agentId, ...roomIds, count).toArray();

			const memoryArray = Array.isArray(memories[0]) ? memories[0] : memories;
			return memoryArray.map(m => ({
				id: m.id,
				type: m.type || 'message',
				content: typeof m.content === 'string' ? JSON.parse(m.content) : m.content,
				userId: m.userId,
				roomId: m.roomId,
				agentId: m.agentId,
				createdAt: parseInt(m.createdAt),
				isUnique: Boolean(m.isUnique)
			}));
		} catch (error) {
			console.error('Error getting memories by room IDs:', error);
			return [];
		}
	}

	// Override createMemory to add importance scoring
	async createMemory({ id, type = 'message', content, userId, userName, roomId, agentId, isUnique = false }) {
		try {
		  if (!roomId) {
			return false;
		  }
	  
		  const importanceScore = await this.calculateImportanceScore(content);
		  
		  const enhancedMemory = {
			id: id || crypto.randomUUID(),
			type,
			content: typeof content === 'string' ? content : JSON.stringify(content),
			userId,  // Can be null for unauthenticated users
			userName: userName || 'guest', // Always required
			roomId,
			agentId,
			createdAt: Date.now(),
			isUnique: isUnique ? 1 : 0,
			importance_score: importanceScore,
			metadata: JSON.stringify({
			  contentType: typeof content,
			  size: JSON.stringify(content).length,
			  context: await this.extractContext(content)
			})
		  };
	  
		  await this.sql.exec(`
			INSERT INTO memories (
			  id,
			  type,
			  content,
			  userId,
			  userName,
			  roomId,
			  agentId,
			  createdAt,
			  isUnique,
			  importance_score,
			  metadata
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		  `, 
			enhancedMemory.id,
			enhancedMemory.type,
			enhancedMemory.content,
			enhancedMemory.userId,
			enhancedMemory.userName,
			enhancedMemory.roomId,
			enhancedMemory.agentId,
			enhancedMemory.createdAt,
			enhancedMemory.isUnique,
			enhancedMemory.importance_score,
			enhancedMemory.metadata
		  );
	  
		  this.stats.totalMemories++;
		  this.stats.messagesProcessed++;
		  await this.checkMemoryThresholds();
	  
		  return true;
		} catch (error) {
		  return false;
		}
	  }
	  

	// Add new helper methods
	async calculateImportanceScore(content) {
		const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
		const length = contentStr.length;
		const uniqueWords = new Set(contentStr.toLowerCase().split(/\s+/)).size;
		return Math.min((length * 0.01 + uniqueWords * 0.1) / 100, 1.0);
	}

	async extractContext(content) {
		const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
		return {
			length: contentStr.length,
			timestamp: Date.now(),
			summary: contentStr.slice(0, 100) + '...'
		};
	}

	async checkMemoryThresholds() {
		const totalMemories = (await this.sql.exec('SELECT COUNT(*) as count FROM memories').toArray())[0].count;

		if (totalMemories >= this.MEMORY_CRITICAL_THRESHOLD) {
			console.error(`CRITICAL: Memory count (${totalMemories}) has exceeded critical threshold`);
		} else if (totalMemories >= this.MEMORY_WARN_THRESHOLD) {
			console.warn(`WARNING: Memory count (${totalMemories}) has exceeded warning threshold`);
		}
	}
}
