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

	async deleteMemory(memoryId) {
		try {
			await this.sql.exec(`
				DELETE FROM memories 
				WHERE id = ?
			`, memoryId);
			
			// Remove from cache
			this.memories.delete(memoryId);
			return true;
		} catch (error) {
			console.error('Error deleting memory:', error);
			return false;
		}
	}

	async findMemories(query, options = {}) {
		try {
			const { limit = 10, type = null } = options;
			
			// First try exact content match
			let memories = await this.sql.exec(`
				SELECT * FROM memories 
				WHERE content LIKE ?
				${type ? 'AND type = ?' : ''}
				ORDER BY createdAt DESC
				LIMIT ?
			`, `%${query}%`, ...(type ? [type] : []), limit).toArray();

			// If we have embeddings, also try semantic search
			if (memories.length < limit && this.searchMemoriesByEmbedding) {
				const embedding = await this.createEmbedding(query);
				if (embedding) {
					const semanticResults = await this.searchMemoriesByEmbedding(embedding, {
						limit: limit - memories.length,
						type
					});
					memories = [...memories, ...semanticResults];
				}
			}

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
			console.error('Error finding memories:', error);
			return [];
		}
	}

	async updateMemory(memory) {
		try {
			const { id } = memory;

			console.log('[EnhancedSQLiteMemoryAdapter.updateMemory] Starting update:', {
				id,
				updates: Object.keys(memory).filter(k => k !== 'id')
			});

			// First verify the memory exists and get current values
			const existing = await this.sql.exec('SELECT * FROM memories WHERE id = ? LIMIT 1', id).toArray();
			console.log('[EnhancedSQLiteMemoryAdapter.updateMemory] Memory exists check:', {
				id,
				exists: existing.length > 0
			});

			if (!existing.length) {
				console.error('[EnhancedSQLiteMemoryAdapter.updateMemory] Memory not found:', id);
				return false;
			}

			// Build update query dynamically based on provided fields
			const updates = [];
			const params = [];
			
			if ('type' in memory) {
				updates.push('type = ?');
				params.push(memory.type);
			}
			if ('content' in memory) {
				updates.push('content = ?');
				// Ensure content is stringified if it's an object
				params.push(typeof memory.content === 'string' ? memory.content : JSON.stringify(memory.content));
			}
			if ('userId' in memory) {
				updates.push('userId = ?');
				params.push(memory.userId);
			}
			if ('userName' in memory) {
				updates.push('userName = ?');
				params.push(memory.userName);
			}
			// Update importance_score if it's provided in the payload
			if ('importance_score' in memory) {
				updates.push('importance_score = ?');
				params.push(memory.importance_score);
				console.log('[EnhancedSQLiteMemoryAdapter.updateMemory] Updating importance score:', memory.importance_score);
			}

			// Only proceed if we have updates to make
			if (updates.length === 0) {
				console.log('[EnhancedSQLiteMemoryAdapter.updateMemory] No fields to update');
				return true;
			}

			// Add the id as the last parameter
			params.push(id);

			const query = `
				UPDATE memories 
				SET ${updates.join(', ')}
				WHERE id = ?
			`;

			console.log('[EnhancedSQLiteMemoryAdapter.updateMemory] Executing update:', {
				query,
				params: params.map((p, i) => i === params.length - 1 ? `id: ${p}` : `param${i}: ${p}`)
			});

			await this.sql.exec(query, ...params);

			const changes = await this.sql.exec('SELECT changes() as count').toArray();
			const success = changes[0].count > 0;

			console.log('[EnhancedSQLiteMemoryAdapter.updateMemory] Update result:', {
				success,
				changes: changes[0].count
			});

			return success;
		} catch (error) {
			console.error('[EnhancedSQLiteMemoryAdapter.updateMemory] Error:', {
				message: error.message,
				stack: error.stack,
				type: error.constructor.name
			});
			return false;
		}
	}

	async getAllMemoriesByCharacter(characterId, options = {}) {
		try {
			const { limit = 100, type = null } = options;
			console.log('[getAllMemoriesByCharacter] Input:', { characterId, options });

			// First get all unique rooms for this character
			const roomsQuery = 'SELECT DISTINCT roomId FROM memories WHERE agentId = ?';
			const rooms = await this.sql.exec(roomsQuery, characterId).toArray();
			console.log('[getAllMemoriesByCharacter] Found rooms:', rooms.map(r => r.roomId));

			const query = `
				SELECT * FROM memories 
				WHERE agentId = ?
				${type ? 'AND type = ?' : ''}
				ORDER BY createdAt DESC
				LIMIT ?
			`;

			const params = [characterId];
			if (type) params.push(type);
			params.push(limit);

			console.log('[getAllMemoriesByCharacter] Query:', {
				sql: query,
				params,
				paramTypes: params.map(p => typeof p)
			});

			const memories = await this.sql.exec(query, ...params).toArray();
			console.log('[getAllMemoriesByCharacter] Found memories:', {
				count: memories.length,
				firstFew: memories.slice(0, 3).map(m => ({
					id: m.id,
					type: m.type,
					roomId: m.roomId,
					createdAt: m.createdAt
				}))
			});

			const result = memories.map(m => ({
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

			console.log('[getAllMemoriesByCharacter] Processed results:', {
				totalCount: result.length,
				uniqueRooms: [...new Set(result.map(m => m.roomId))],
				uniqueTypes: [...new Set(result.map(m => m.type))]
			});

			return result;
		} catch (error) {
			console.error('[getAllMemoriesByCharacter] Error:', {
				message: error.message,
				stack: error.stack,
				type: error.constructor.name
			});
			return [];
		}
	}

	// Keep this for backward compatibility but make it use the new method
	async getAllMemoriesBySessionId(sessionId, options = {}) {
		try {
			const { type = null, getAllMemories = false } = options;
			
			// If getAllMemories is true, get the character ID from any memory with this session ID
			if (getAllMemories) {
				const sessionQuery = 'SELECT DISTINCT agentId FROM memories WHERE userId = ? LIMIT 1';
				const agents = await this.sql.exec(sessionQuery, sessionId).toArray();
				
				if (agents.length > 0) {
					return this.getAllMemoriesByCharacter(agents[0].agentId, { type });
				}
			}
			
			// Fall back to session-based retrieval if getAllMemories is false or no agent found
			const query = `
				SELECT * FROM memories 
				WHERE userId = ?
				${type ? 'AND type = ?' : ''}
				ORDER BY createdAt DESC
				LIMIT 100
			`;

			const params = [sessionId];
			if (type) params.push(type);

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
			console.error('[getAllMemoriesBySessionId] Error:', error);
			return [];
		}
	}
}
