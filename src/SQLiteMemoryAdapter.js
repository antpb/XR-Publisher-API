export class SQLiteMemoryAdapter {
	constructor(sql) {
		this.sql = sql;
		this.memories = new Map();
	}

	async initializeSchema() {
		try {
			// Create tables one at a time to ensure proper ordering and syntax
			await this.sql.exec(`
                CREATE TABLE IF NOT EXISTS memories (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    content TEXT NOT NULL,
                    embedding BLOB,
                    userId TEXT NOT NULL,
                    roomId TEXT NOT NULL,
                    agentId TEXT NOT NULL,
                    isUnique INTEGER DEFAULT 0,
                    createdAt INTEGER NOT NULL
                )
            `);

			await this.sql.exec(`
                CREATE TABLE IF NOT EXISTS goals (
                    id TEXT PRIMARY KEY,
                    roomId TEXT NOT NULL,
                    userId TEXT NOT NULL,
                    name TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'PENDING',
                    objectives TEXT NOT NULL DEFAULT '[]',
                    createdAt INTEGER NOT NULL,
                    updatedAt INTEGER NOT NULL
                )
            `);

			await this.sql.exec(`
                CREATE TABLE IF NOT EXISTS session_nonces (
                    nonce TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    request_count INTEGER DEFAULT 0
                )
            `);

			// Create indexes
			await this.sql.exec(`
                CREATE INDEX IF NOT EXISTS idx_memories_room ON memories(roomId, createdAt);
                CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(userId);
                CREATE INDEX IF NOT EXISTS idx_memories_agent ON memories(agentId);
                CREATE INDEX IF NOT EXISTS idx_goals_room ON goals(roomId);
                CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(userId);
                CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status)
            `);

			return true;
		} catch (error) {
			console.error('Error initializing database adapter schema:', error);
			throw error;
		}
	}



	// async createMemory(memory) {
	// 	try {
	// 		await this.sql.exec(`
	// 		INSERT INTO memories (
	// 		  id,
	// 		  content,
	// 		  userId,
	// 		  roomId,
	// 		  agentId,
	// 		  createdAt,
	// 		  type
	// 		) VALUES (?, ?, ?, ?, ?, ?, ?)
	// 	  `,
	// 			memory.id,
	// 			JSON.stringify(memory.content),
	// 			memory.userId,
	// 			memory.roomId,
	// 			memory.agentId,
	// 			memory.createdAt,
	// 			memory.type || 'message'
	// 		);
	// 		return true;
	// 	} catch (error) {
	// 		console.error('Error creating memory:', error);
	// 		return false;
	// 	}
	// }
	async cleanCharacterData(characterData) {
		// Ensure core arrays are initialized and filtered
		const cleanedCharacter = {
			...characterData,
			name: characterData.name,
			status: characterData.status || "private",
			modelProvider: characterData.modelProvider || "openai",
			clients: characterData.clients || ["DIRECT"],
			bio: Array.isArray(characterData.bio) ? characterData.bio.join('\n') : characterData.bio,
			lore: characterData.lore?.filter(Boolean).map(text => text.trim()) || [],
			adjectives: characterData.adjectives?.filter(Boolean).map(text => text.trim()) || [],
			topics: characterData.topics?.filter(Boolean).map(text => text.trim()) || [],
			messageExamples: characterData.messageExamples?.filter(Array.isArray) || [],
			postExamples: characterData.postExamples?.filter(Boolean) || [],
			style: {
				all: characterData.style?.all?.filter(Boolean) || [],
				chat: characterData.style?.chat?.filter(Boolean) || [],
				post: characterData.style?.post?.filter(Boolean) || []
			},
			settings: {
				...(characterData.settings || {}),
				secrets: undefined // Remove sensitive data
			}
		};

		return cleanedCharacter;
	}

	async getMemories({ roomId, count = 10, type = 'message', unique = true }) {
		try {
			const memories = await this.sql.exec(`
                SELECT * FROM memories 
                WHERE roomId = ? 
                ${type ? 'AND type = ?' : ''}
                ${unique ? 'AND isUnique = 1' : ''}
                ORDER BY createdAt DESC
                LIMIT ?
            `, ...[roomId, ...(type ? [type] : []), count]).toArray();

			const parsedMemories = memories.map(m => ({
				id: m.id,
				type: m.type || 'message',
				content: typeof m.content === 'string' ? JSON.parse(m.content) : m.content,
				userId: m.userId,
				roomId: m.roomId,
				agentId: m.agentId,
				createdAt: parseInt(m.createdAt),
				isUnique: Boolean(m.isUnique)
			}));

			// Cache the memories
			parsedMemories.forEach(memory => {
				this.memories.set(memory.id, memory);
			});

			return parsedMemories;
		} catch (error) {
			console.error('Error getting memories:', error);
			return [];
		}
	}

	async getAllMemories(roomId) {
		try {
			const memories = await this.sql.exec(`
			SELECT * FROM memories 
			WHERE roomId = ? 
			ORDER BY createdAt DESC
		  `, roomId).toArray();

			return memories.map(m => ({
				id: m.id,
				type: m.type || 'message',
				content: typeof m.content === 'string' ? JSON.parse(m.content) : m.content,
				userId: m.userId,
				roomId: m.roomId,
				agentId: m.agentId,
				createdAt: parseInt(m.createdAt),
				isUnique: Boolean(m.isUnique)
			})).sort((a, b) => b.createdAt - a.createdAt);
		} catch (error) {
			console.error('Error getting all memories:', error);
			return [];
		}
	}
	async createMemory({ id, type = 'message', content, userId, roomId, agentId, isUnique = false }) {
		try {
			if (!roomId) {
				console.error('Missing required roomId for memory creation');
				return false;
			}
	
			// Check if room exists first
			const roomExists = await this.sql.exec(`
				SELECT id FROM rooms WHERE id = ? LIMIT 1
			`, roomId).toArray();
	
			if (!roomExists.length) {
				// Create room if it doesn't exist
				await this.sql.exec(`
					INSERT INTO rooms (
						id,
						character_id,
						created_at,
						last_active
					) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
				`, roomId, agentId);
			}
	
			const createdAt = Date.now();
			const memory = {
				id: id || crypto.randomUUID(),
				type,
				content: typeof content === 'string' ? content : JSON.stringify(content),
				userId,
				roomId,
				agentId,
				createdAt,
				isUnique: isUnique ? 1 : 0
			};
	
			await this.sql.exec(`
				INSERT INTO memories (
					id,
					type,
					content,
					userId,
					roomId,
					agentId,
					createdAt,
					isUnique
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`,
				memory.id,
				memory.type,
				memory.content,
				memory.userId,
				memory.roomId,
				memory.agentId,
				memory.createdAt,
				memory.isUnique
			);
	
			// Store in memory cache
			this.memories.set(memory.id, memory);
			return true;
		} catch (error) {
			console.error('Error creating memory:', error);
			console.error('Failed memory data:', { id, type, roomId, userId, agentId });
			return false;
		}
	}		

	async getMemoryById(id) {
		try {
			// Check cache first
			if (this.memories.has(id)) {
				return this.memories.get(id);
			}

			const memories = await this.sql.exec(`
			SELECT * FROM memories 
			WHERE id = ?
			LIMIT 1
		  `, id).toArray();

			if (!memories.length) {
				return null;
			}

			const memory = memories[0];
			const formatted = {
				id: memory.id,
				type: memory.type || 'message',
				content: typeof memory.content === 'string' ? JSON.parse(memory.content) : memory.content,
				userId: memory.userId,
				roomId: memory.roomId,
				agentId: memory.agentId,
				createdAt: parseInt(memory.createdAt),
				isUnique: Boolean(memory.isUnique)
			};

			// Store in cache
			this.memories.set(id, formatted);
			return formatted;
		} catch (error) {
			console.error('Error getting memory by ID:', error);
			return null;
		}
	}

	// New helper methods
	sortMemories(memories) {
		return (memories || []).sort((a, b) => b.createdAt - a.createdAt);
	}

	async cleanupOldMemories(roomId, maxAge = 24 * 60 * 60 * 1000) {
		try {
			const cutoff = Date.now() - maxAge;
			await this.sql.exec(`
        DELETE FROM memories 
        WHERE roomId = ? AND createdAt < ? AND isUnique = 0
      `, roomId, cutoff);
			return true;
		} catch (error) {
			console.error('Error cleaning up memories:', error);
			return false;
		}
	}

	// Method to get all related memories
	async getRelatedMemories({ roomId, content, limit = 5 }) {
		try {
			// For now, just return recent memories since we don't have vector search
			return await this.getMemories({ roomId, count: limit });
		} catch (error) {
			console.error('Error getting related memories:', error);
			return [];
		}
	}

	// Goals implementation
	async createGoal(goal) {
		try {
			const now = Date.now();
			await this.sql.exec(`
			INSERT INTO goals (
			  id,
			  roomId,
			  userId,
			  name,
			  status,
			  objectives,
			  createdAt,
			  updatedAt
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		  `,
				goal.id,
				goal.roomId,
				goal.userId,
				goal.name,
				goal.status || 'PENDING',
				JSON.stringify(goal.objectives || []),
				now,
				now
			);
			return true;
		} catch (error) {
			console.error('Error creating goal:', error);
			return false;
		}
	}
	async getGoals({ roomId, onlyInProgress = false }) {
		try {
			const goals = await this.sql.exec(`
			SELECT * FROM goals 
			WHERE roomId = ?
			${onlyInProgress ? "AND status = 'IN_PROGRESS'" : ''}
			ORDER BY createdAt DESC
		  `, roomId).toArray();

			// Make sure we return a properly formatted array even if empty
			return goals.map(g => ({
				id: g.id,
				roomId: g.roomId,
				userId: g.userId,
				name: g.name,
				status: g.status,
				objectives: JSON.parse(g.objectives || '[]'),
				createdAt: parseInt(g.createdAt),
				updatedAt: parseInt(g.updatedAt)
			})) || [];
		} catch (error) {
			console.error('Error getting goals:', error);
			// Return empty array instead of null or undefined
			return [];
		}
	}
	async getGoalById(goalId) {
		try {
			const goals = await this.sql.exec(`
			SELECT * FROM goals 
			WHERE id = ?
			LIMIT 1
		  `, goalId).toArray();

			if (goals.length === 0) {
				return null;
			}

			const goal = goals[0];
			return {
				id: goal.id,
				roomId: goal.roomId,
				userId: goal.userId,
				name: goal.name,
				status: goal.status,
				objectives: JSON.parse(goal.objectives || '[]'),
				createdAt: parseInt(goal.createdAt),
				updatedAt: parseInt(goal.updatedAt)
			};
		} catch (error) {
			console.error('Error getting goal by ID:', error);
			return null;
		}
	}

	async updateGoal(goalId, updates) {
		try {
			const setStatements = [];
			const values = [];

			if (updates.status) {
				setStatements.push('status = ?');
				values.push(updates.status);
			}

			if (updates.objectives) {
				setStatements.push('objectives = ?');
				values.push(JSON.stringify(updates.objectives));
			}

			if (updates.name) {
				setStatements.push('name = ?');
				values.push(updates.name);
			}

			setStatements.push('updatedAt = ?');
			values.push(Date.now());

			values.push(goalId);

			if (setStatements.length === 0) {
				return true; // Nothing to update
			}

			await this.sql.exec(`
			UPDATE goals 
			SET ${setStatements.join(', ')}
			WHERE id = ?
		  `, ...values);

			return true;
		} catch (error) {
			console.error('Error updating goal:', error);
			return false;
		}
	}
	async deleteGoal(goalId) {
		try {
			await this.sql.exec(`
			DELETE FROM goals 
			WHERE id = ?
		  `, goalId);
			return true;
		} catch (error) {
			console.error('Error deleting goal:', error);
			return false;
		}
	}

	formatGoal(goal) {
		return {
			id: goal.id,
			roomId: goal.roomId,
			userId: goal.userId,
			name: goal.name,
			status: goal.status,
			objectives: Array.isArray(goal.objectives) ? goal.objectives : [],
			createdAt: parseInt(goal.createdAt),
			updatedAt: parseInt(goal.updatedAt)
		};
	}

	// Make sure to handle objectives array properly in all methods
	async getObjectives(goalId) {
		try {
			const goal = await this.getGoalById(goalId);
			return goal ? goal.objectives : [];
		} catch (error) {
			console.error('Error getting objectives:', error);
			return [];
		}
	}

	async getAccountById(userId) {
		return {
			id: userId,
			name: userId,
			createdAt: Date.now()
		};
	}

	async createAccount(account) {
		return true;
	}


	async searchMemoriesByEmbedding(embedding, options = {}) {
		// Simple implementation without vector search
		return [];
	}

	// Add missing required methods
	async getParticipantsForRoom(roomId) {
		try {
			const participants = await this.sql.exec(`
			SELECT DISTINCT userId, agentId 
			FROM memories 
			WHERE roomId = ?
		  `, roomId).toArray();

			const uniqueParticipants = new Set();
			participants.forEach(p => {
				uniqueParticipants.add(p.userId);
				uniqueParticipants.add(p.agentId);
			});

			return Array.from(uniqueParticipants);
		} catch (error) {
			console.error('Error getting room participants:', error);
			return [];
		}
	}

	async removeAllMemories(roomId, tableName = 'memories') {
		try {
			await this.sql.exec(`
			DELETE FROM ${tableName} 
			WHERE roomId = ?
		  `, roomId);
			return true;
		} catch (error) {
			console.error('Error removing memories:', error);
			return false;
		}
	}

	async createRelationship({ userA, userB, status = 'FRIENDS' }) {
		try {
			await this.sql.exec(`
			INSERT INTO relationships (userA, userB, status)
			VALUES (?, ?, ?)
			ON CONFLICT(userA, userB) DO UPDATE SET status = ?
		  `, userA, userB, status, status);
			return true;
		} catch (error) {
			console.error('Error creating relationship:', error);
			return false;
		}
	}

	async getRelationships({ userId }) {
		try {
			const relationships = await this.sql.exec(`
			SELECT * FROM relationships 
			WHERE userA = ? OR userB = ?
		  `, userId, userId).toArray();
			return relationships;
		} catch (error) {
			console.error('Error getting relationships:', error);
			return [];
		}
	}

	async getCachedEmbeddings(params) {
		// Simple implementation returning empty results
		return [];
	}

}

export default SQLiteMemoryAdapter;