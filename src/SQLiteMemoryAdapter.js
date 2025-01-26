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
			
			// Handle content format
			let formattedContent;
			if (typeof content === 'string') {
				// If it's a string, wrap it in a text object
				formattedContent = JSON.stringify({ text: content });
			} else if (typeof content === 'object') {
				// If it's already an object, stringify it
				formattedContent = JSON.stringify(content);
			} else {
				// For any other type, convert to string and wrap in text object
				formattedContent = JSON.stringify({ text: String(content) });
			}

			const memory = {
				id: id || crypto.randomUUID(),
				type,
				content: formattedContent,
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
			this.memories.set(memory.id, {
				...memory,
				content: JSON.parse(memory.content)  // Parse it back for the cache
			});
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
			console.log('[getMemoryById] Raw memory data:', {
				id: memory.id,
				type: memory.type,
				contentType: typeof memory.content,
				contentPreview: memory.content?.substring(0, 100),
				contentLength: memory.content?.length
			});

			let parsedContent;
			try {
				// First try to parse as JSON
				if (typeof memory.content === 'string') {
					try {
						parsedContent = JSON.parse(memory.content);
						console.log('[getMemoryById] Successfully parsed content as JSON:', {
							id: memory.id,
							contentType: typeof parsedContent,
							hasText: 'text' in parsedContent,
							keys: Object.keys(parsedContent)
						});
					} catch (firstParseError) {
						// If first parse fails, check if it's a double-stringified JSON
						try {
							parsedContent = JSON.parse(JSON.parse(memory.content));
							console.log('[getMemoryById] Successfully parsed double-stringified JSON:', {
								id: memory.id,
								contentType: typeof parsedContent,
								hasText: 'text' in parsedContent,
								keys: Object.keys(parsedContent)
							});
						} catch (secondParseError) {
							// If both parses fail, treat as plain text
							console.log('[getMemoryById] Content appears to be plain text:', {
								id: memory.id,
								parseError: firstParseError.message,
								content: memory.content?.substring(0, 100)
							});
							parsedContent = { text: memory.content };
						}
					}
				} else {
					parsedContent = memory.content;
				}
			} catch (parseError) {
				console.warn('[getMemoryById] Failed to parse content:', {
					id: memory.id,
					error: parseError.message,
					content: memory.content?.substring(0, 100)
				});
				// If all parsing fails, wrap in text object
				parsedContent = { text: memory.content };
			}

			let parsedMetadata = null;
			try {
				if (memory.metadata) {
					console.log('[getMemoryById] Raw metadata:', {
						id: memory.id,
						metadataType: typeof memory.metadata,
						metadataPreview: memory.metadata?.substring(0, 100)
					});
					parsedMetadata = JSON.parse(memory.metadata);
				}
			} catch (metadataError) {
				console.warn('[getMemoryById] Failed to parse metadata:', {
					id: memory.id,
					error: metadataError.message
				});
			}

			const formatted = {
				id: memory.id,
				type: memory.type || 'message',
				content: parsedContent,
				userId: memory.userId,
				roomId: memory.roomId,
				agentId: memory.agentId,
				createdAt: parseInt(memory.createdAt),
				isUnique: Boolean(memory.isUnique),
				importance_score: memory.importance_score,
				metadata: parsedMetadata
			};

			console.log('[getMemoryById] Final formatted memory:', {
				id: formatted.id,
				type: formatted.type,
				contentType: typeof formatted.content,
				hasText: 'text' in formatted.content,
				keys: Object.keys(formatted.content)
			});

			// Store in cache
			this.memories.set(id, formatted);
			return formatted;
		} catch (error) {
			console.error('[getMemoryById] Error:', {
				message: error.message,
				stack: error.stack
			});
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

			const result = memories.map(m => {
				console.log('[getAllMemoriesByCharacter] Processing memory:', {
					id: m.id,
					type: m.type,
					contentType: typeof m.content,
					contentPreview: m.content?.substring(0, 100)
				});

				let parsedContent;
				try {
					// First check if content is already an object
					if (typeof m.content === 'object' && m.content !== null) {
						parsedContent = m.content;
					} else if (typeof m.content === 'string') {
						// Try to parse as JSON first
						try {
							parsedContent = JSON.parse(m.content);
							console.log('[getAllMemoriesByCharacter] Parsed JSON content:', {
								id: m.id,
								contentType: typeof parsedContent,
								hasText: 'text' in parsedContent,
								keys: Object.keys(parsedContent)
							});
						} catch (parseError) {
							// If parsing fails, treat as plain text
							console.log('[getAllMemoriesByCharacter] Content is plain text:', {
								id: m.id,
								content: m.content?.substring(0, 100)
							});
							parsedContent = { text: m.content };
						}
					} else {
						// For any other type, convert to string and wrap
						parsedContent = { text: String(m.content) };
					}

					return {
						id: m.id,
						type: m.type || 'message',
						content: parsedContent,
						userId: m.userId,
						roomId: m.roomId,
						agentId: m.agentId,
						createdAt: parseInt(m.createdAt),
						isUnique: Boolean(m.isUnique),
						importance_score: m.importance_score,
						metadata: m.metadata ? JSON.parse(m.metadata) : null
					};
				} catch (error) {
					console.error('[getAllMemoriesByCharacter] Failed to process memory:', {
						id: m.id,
						error: error.message,
						content: m.content?.substring(0, 100)
					});
					return null;
				}
			}).filter(Boolean); // Remove any null entries from failed processing

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
}

export default SQLiteMemoryAdapter;