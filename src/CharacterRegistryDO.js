import { EnhancedSQLiteMemoryAdapter } from './EnhancedSQLiteMemoryAdapter.js';
import { initializeWorkerCompat } from './WorkerCompatibilityLayer.js';

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
	'Access-Control-Max-Age': '86400',
};

// Slugify function that preserves case but handles spaces and special characters
function slugifyCharacterName(name) {
	return name
		.trim()
		.replace(/[^\w\s-]/g, '') // Remove special characters except spaces and hyphens
		.replace(/\s+/g, '-');    // Replace spaces with hyphens
}

// Function to normalize character name for comparison
function normalizeCharacterName(name) {
	return name.trim().toLowerCase();
}

class NonceManager {
	constructor(sql) {
		this.sql = sql;
	}

	async createNonce(roomId, sessionId, expiresInSeconds = 300) {
		const nonce = crypto.randomUUID();
		const expiresAt = new Date(Date.now() + (expiresInSeconds * 1000));

		console.log('Creating/updating nonce:', {
			sessionId,
			roomId,
			nonce,
			expiresAt: expiresAt.toISOString()
		});

		try {
			// Try to update existing nonce first
			await this.sql.exec(`
                UPDATE session_nonces 
                SET nonce = ?,
                    room_id = ?,
                    expires_at = ?,
                    request_count = 0,
                    created_at = CURRENT_TIMESTAMP
                WHERE session_id = ?
            `, nonce, roomId, expiresAt.toISOString(), sessionId);

			// If no row was updated, insert new one
			const updateResult = await this.sql.exec('SELECT changes() as count').toArray();
			if (updateResult[0].count === 0) {
				await this.sql.exec(`
                    INSERT INTO session_nonces (
                        session_id,
                        room_id,
                        nonce,
                        expires_at,
                        request_count,
                        created_at
                    ) VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
                `, sessionId, roomId, nonce, expiresAt.toISOString());
			}

			return { nonce };
		} catch (error) {
			console.error('Error creating/updating nonce:', error);
			throw error;
		}
	}

	async validateNonce(sessionId, nonce, maxRequests = 5) {
		const results = await this.sql.exec(`
            SELECT * FROM session_nonces
            WHERE session_id = ? 
            AND nonce = ? 
            AND expires_at > CURRENT_TIMESTAMP
            AND request_count < ?
        `, sessionId, nonce, maxRequests).toArray();

		if (!results.length) {
			console.log('Nonce validation failed:', {
				sessionId,
				nonce,
				maxRequests,
				results
			});
			return false;
		}

		// Update request count
		await this.sql.exec(`
            UPDATE session_nonces 
            SET request_count = request_count + 1 
            WHERE session_id = ? AND nonce = ?
        `, sessionId, nonce);

		return true;
	}

	async cleanupExpiredNonces() {
		try {
			await this.sql.exec(`
                DELETE FROM session_nonces 
                WHERE expires_at < CURRENT_TIMESTAMP
            `);
			return true;
		} catch (error) {
			console.error('Error cleaning up expired nonces:', error);
			return false;
		}
	}
}

export class CharacterRegistryDO {
	#sessions = new Map();
	#sessionTimeouts = new Map();
	constructor(state, env) {
		// Initialize compatibility layer before anything else
		initializeWorkerCompat();
		this.state = state;
		this.env = env;
		this.sql = state.storage.sql;
		this.nonceManager = new NonceManager(this.sql);

		// Add explicit timeouts for DO operations
		this.requestTimeout = 45000;
		this.maxRetries = 2;

		// Initialize with timeout protection
		this.initialize().catch(console.error);
	}



	async initialize() {
		await this.initializeSchema();
		// await this.nonceManager.initializeSchema();
	}

	async initializeSchema() {
		try {
			console.log('Enabling foreign keys...');
			await this.sql.exec('PRAGMA foreign_keys = ON;');

			// Create characters table with new fields
			console.log('Creating characters table...');
			const createCharactersTable = `
				CREATE TABLE IF NOT EXISTS characters (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				author TEXT NOT NULL,
				name TEXT NOT NULL,
				slug TEXT,
				model_provider TEXT NOT NULL,
				bio TEXT,
				settings TEXT,
				vrm_url TEXT,
				profile_img TEXT,
				banner_img TEXT,
				status TEXT DEFAULT 'private',
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				UNIQUE(author, name)
				)
			`;
			console.log('SQL for characters table:', createCharactersTable);
			await this.sql.exec(createCharactersTable);

			// Create character_secrets table
			console.log('Creating character_secrets table...');
			await this.sql.exec(`
				CREATE TABLE IF NOT EXISTS character_secrets (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					character_id INTEGER NOT NULL,
					salt TEXT NOT NULL,
					model_keys TEXT,
					created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					FOREIGN KEY(character_id) REFERENCES characters(id)
				)
			`);

			// Create sessions table
			console.log('Creating sessions table...');
			await this.sql.exec(`
				CREATE TABLE IF NOT EXISTS character_sessions (
					id TEXT PRIMARY KEY,
					character_id INTEGER,
					created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					FOREIGN KEY(character_id) REFERENCES characters(id)
				)
			`);

			// Create nonces table
			console.log('Creating nonces table...');
			await this.sql.exec(`
				CREATE TABLE IF NOT EXISTS session_nonces (
					session_id TEXT PRIMARY KEY,
					nonce TEXT NOT NULL,
					expires_at TIMESTAMP NOT NULL,
					request_count INTEGER DEFAULT 0,
					created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
				)
			`);

			// Create indexes
			console.log('Creating indexes...');
			await this.sql.exec(`
				CREATE INDEX IF NOT EXISTS idx_characters_author ON characters(author);
				CREATE INDEX IF NOT EXISTS idx_characters_name ON characters(name);
				CREATE INDEX IF NOT EXISTS idx_characters_slug ON characters(author, slug);  /* Added slug index */
				CREATE INDEX IF NOT EXISTS idx_character_sessions_id ON character_sessions(id);
				CREATE INDEX IF NOT EXISTS idx_character_secrets_id ON character_secrets(character_id)
			`);

			console.log('Schema initialization completed successfully');
			return true;
		} catch (error) {
			console.error("Error initializing schema:", error);
			if (error.message.includes('syntax error')) {
				console.error("SQL Syntax error details:", {
					message: error.message,
					cause: error.cause,
					stack: error.stack
				});
			}
			throw error;
		}
	}


	async migrateMemorySchema() {
		try {
			console.log('Starting memory schema migration...');
			await this.sql.exec('PRAGMA foreign_keys = OFF;');

			// Get existing columns
			const tableInfo = await this.sql.exec('PRAGMA table_info(memories)').toArray();
			const columns = tableInfo.map(col => col.name);

			// Create temporary table with new schema
			await this.sql.exec(`
				CREATE TABLE IF NOT EXISTS memories_new (
					id TEXT PRIMARY KEY,
					type TEXT NOT NULL,
					content TEXT NOT NULL,
					embedding BLOB,
					userId TEXT,           -- Stores authenticated user ID if available
					userName TEXT,         -- Stores display name for messages
					roomId TEXT NOT NULL,
					agentId TEXT NOT NULL,
					isUnique INTEGER DEFAULT 0,
					createdAt INTEGER NOT NULL,
					importance_score FLOAT DEFAULT 0,
					access_count INTEGER DEFAULT 0,
					last_accessed TIMESTAMP,
					metadata TEXT
				);
			`);

			// Check if original memories table exists
			const memoryTableExists = await this.sql.exec(`
				SELECT name FROM sqlite_master 
				WHERE type='table' AND name='memories'
			`).toArray();

			if (memoryTableExists.length > 0) {
				// Copy data from old table to new table, preserving userId for authenticated users
				await this.sql.exec(`
					INSERT INTO memories_new 
					SELECT 
						id,
						type,
						content,
						embedding,
						userId,      -- Keep existing userId (authenticated users)
						userId,      -- Initially set userName to userId, we'll update display names in the message handler
						roomId,
						agentId,
						isUnique,
						createdAt,
						0 as importance_score,
						0 as access_count,
						NULL as last_accessed,
						NULL as metadata
					FROM memories
				`);

				await this.sql.exec('DROP TABLE memories;');
			}

			// Rename new table to memories
			await this.sql.exec('ALTER TABLE memories_new RENAME TO memories;');

			// Create indexes
			await this.sql.exec(`
				CREATE INDEX IF NOT EXISTS idx_memories_room ON memories(roomId, createdAt);
				CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(userId);
				CREATE INDEX IF NOT EXISTS idx_memories_username ON memories(userName);
				CREATE INDEX IF NOT EXISTS idx_memories_agent ON memories(agentId);
				CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance_score);
				CREATE INDEX IF NOT EXISTS idx_memories_access ON memories(access_count, last_accessed);
			`);

			await this.sql.exec('PRAGMA foreign_keys = ON;');
			console.log('Memory schema migration completed successfully');
			return true;
		} catch (error) {
			console.error('Error in memory schema migration:', error);
			await this.sql.exec('PRAGMA foreign_keys = ON;');
			throw error;
		}
	}

	async migrateStatusField() {
		try {
			console.log('Starting status field migration...');
			await this.sql.exec('PRAGMA foreign_keys = OFF;');

			// Get existing columns
			const tableInfo = await this.sql.exec('PRAGMA table_info(characters)').toArray();
			const columns = tableInfo.map(col => col.name);

			// Add status column if it doesn't exist
			if (!columns.includes('status')) {
				console.log('Adding status column...');
				await this.sql.exec('ALTER TABLE characters ADD COLUMN status TEXT DEFAULT "private"');

				// Set all existing characters to private
				await this.sql.exec('UPDATE characters SET status = "private" WHERE status IS NULL');
			}

			await this.sql.exec('PRAGMA foreign_keys = ON;');
			console.log('Status field migration completed successfully');
			return true;
		} catch (error) {
			console.error('Error in status field migration:', error);
			await this.sql.exec('PRAGMA foreign_keys = ON;');
			throw error;
		}
	}

	async migrateImageFields() {
		try {
			console.log('Starting image fields migration...');
			await this.sql.exec('PRAGMA foreign_keys = OFF;');

			// Get existing columns
			const tableInfo = await this.sql.exec('PRAGMA table_info(characters)').toArray();
			const columns = tableInfo.map(col => col.name);

			// Add profile_img column if it doesn't exist
			if (!columns.includes('profile_img')) {
				console.log('Adding profile_img column...');
				await this.sql.exec('ALTER TABLE characters ADD COLUMN profile_img TEXT');
			}

			// Add banner_img column if it doesn't exist
			if (!columns.includes('banner_img')) {
				console.log('Adding banner_img column...');
				await this.sql.exec('ALTER TABLE characters ADD COLUMN banner_img TEXT');
			}

			await this.sql.exec('PRAGMA foreign_keys = ON;');
			console.log('Image fields migration completed successfully');
			return true;
		} catch (error) {
			console.error('Error in image fields migration:', error);
			await this.sql.exec('PRAGMA foreign_keys = ON;');
			throw error;
		}
	}

	async base64ToArrayBuffer(base64) {
		// Make sure base64 is a string
		if (typeof base64 !== 'string') {
			console.error('Invalid base64 input:', base64);
			return new Uint8Array(); // Return empty array instead of throwing
		}

		try {
			// First decode base64 to binary string
			const binaryString = atob(base64);

			// Create Uint8Array of the right length
			const bytes = new Uint8Array(binaryString.length);

			// Fill array with decoded bytes
			for (let i = 0; i < binaryString.length; i++) {
				bytes[i] = binaryString.charCodeAt(i);
			}

			console.log('Converted base64 to ArrayBuffer:', {
				inputLength: base64.length,
				outputLength: bytes.length,
				isUint8Array: bytes instanceof Uint8Array
			});

			return bytes;
		} catch (error) {
			console.error('Error converting base64 to ArrayBuffer:', error);
			return new Uint8Array();
		}
	}



	async arrayBufferToBase64(buffer) {
		const bytes = new Uint8Array(buffer);
		let binary = '';
		for (let i = 0; i < bytes.byteLength; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return btoa(binary);
	}


	// encryption/decryption methods for secrets
	async encryptSecrets(modelKeys, salt) {
		try {
			// Convert modelKeys to string
			const secretsString = JSON.stringify(modelKeys);
			const encoder = new TextEncoder();
			console.log('Secrets string:', secretsString);
			// Create a key from the character_salt environment variable
			const key = await crypto.subtle.importKey(
				'raw',
				encoder.encode(this.env.CHARACTER_SALT),
				{ name: 'HMAC', hash: 'SHA-256' },
				false,
				['sign']
			);

			// Combine salt and secrets for encryption
			const dataToEncrypt = encoder.encode(salt + secretsString);
			// console.log('Data being encrypted:', {
			// 	combinedLength: dataToEncrypt.length,
			// 	isUint8Array: dataToEncrypt instanceof Uint8Array
			// });

			// Generate HMAC
			const signature = await crypto.subtle.sign('HMAC', key, dataToEncrypt);
			const base64Signature = await this.arrayBufferToBase64(signature);

			// console.log('Generated signature:', {
			// 	signatureType: signature.constructor.name,
			// 	base64Length: base64Signature.length
			// });

			const finalObject = {
				salt,
				data: secretsString,
				signature: base64Signature
			};

			// Ensure all required fields are present
			if (!finalObject.salt || !finalObject.data || !finalObject.signature) {
				throw new Error('Missing required encryption fields');
			}

			return JSON.stringify(finalObject);
		} catch (error) {
			console.error('Error encrypting secrets:', error);
			console.error('Error details:', {
				errorType: error.constructor.name,
				message: error.message,
				stack: error.stack
			});
			throw error;
		}
	}


	async decryptSecrets(encryptedData, salt) {
		try {
			// console.log('Starting decryption with:', { encryptedData, salt });

			const parsedData = JSON.parse(encryptedData);
			// console.log('Parsed encrypted data:', parsedData);

			// Check if we have invalid/missing signature data
			if (!parsedData.signature || typeof parsedData.signature !== 'string') {
				// console.log('No valid signature found, returning default secrets');
				// Return default secrets
				return {
					openai: this.env.OPENAI_API_KEY,
					anthropic: this.env.ANTHROPIC_API_KEY,
					discord_token: null,
					discord_public_key: null,
					discord_app_id: null,
					twitter_username: null,
					twitter_cookies: null,
					telegram_token: null,
					...JSON.parse(parsedData.data || '{}') // Include any saved data
				};
			}

			const { data, signature } = parsedData;
			const encoder = new TextEncoder();

			// Create the verification data
			const dataToVerify = encoder.encode(salt + data);
			// console.log('Data to verify:', {
			// 	salt,
			// 	data,
			// 	verifyArrayBuffer: dataToVerify instanceof Uint8Array,
			// 	verifyLength: dataToVerify.length
			// });

			// Create key from environment variable
			const key = await crypto.subtle.importKey(
				'raw',
				encoder.encode(this.env.CHARACTER_SALT),
				{ name: 'HMAC', hash: 'SHA-256' },
				false,
				['verify']
			);

			// Convert signature to ArrayBuffer
			const signatureBuffer = await this.base64ToArrayBuffer(signature);
			if (!(signatureBuffer instanceof Uint8Array)) {
				throw new Error('Failed to convert signature to Uint8Array');
			}

			// console.log('Signature conversion:', {
			// 	originalSignature: signature,
			// 	isArrayBuffer: signatureBuffer instanceof Uint8Array,
			// 	signatureLength: signatureBuffer.length,
			// 	signatureBytes: signatureBuffer.slice(0, 4) // Log first few bytes for debugging
			// });

			// Verify the HMAC
			const isValid = await crypto.subtle.verify(
				'HMAC',
				key,
				signatureBuffer,
				dataToVerify
			);

			if (!isValid) {
				throw new Error('Secret verification failed');
			}

			// If verification passes, return the decrypted data
			const decryptedData = JSON.parse(data);
			return {
				...decryptedData,
				openai: decryptedData.openai || this.env.OPENAI_API_KEY,
				anthropic: decryptedData.anthropic || this.env.ANTHROPIC_API_KEY
			};
		} catch (error) {
			console.error('Error decrypting secrets:', error);
			// Add the specific error state
			console.error('Error state:', {
				hasEncryptedData: !!encryptedData,
				hasSalt: !!salt,
				errorType: error.constructor.name,
				errorMessage: error.message,
				stack: error.stack
			});
			throw error;
		}
	}

	async initializeCharacterRoom(author, slug, roomId) {
		try {
			console.log('Initializing session for:', author, slug, 'in room:', roomId);
			const character = await this.getCharacter(author, slug);

			if (!character) {
				throw new Error('Character not found');
			}

			// Create session ID first
			const sessionId = crypto.randomUUID();
			console.log('Creating session with ID:', sessionId);

			// Create session record
			await this.sql.exec(`
				INSERT INTO character_sessions (
					id,
					character_id,
					room_id,
					created_at,
					last_active
				) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
			`, sessionId, character.id, roomId);

			// Get or create room
			const roomExists = await this.sql.exec(`
				SELECT id FROM rooms WHERE id = ? LIMIT 1
			`, roomId).toArray();

			if (!roomExists.length) {
				console.log('Creating new room:', roomId);
				await this.sql.exec(`
					INSERT INTO rooms (
						id,
						character_id,
						current_session_id,
						created_at,
						last_active
					) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
				`, roomId, character.id, sessionId);
			} else {
				// Update existing room with new session
				await this.sql.exec(`
					UPDATE rooms 
					SET current_session_id = ?,
						last_active = CURRENT_TIMESTAMP 
					WHERE id = ?
				`, sessionId, roomId);
			}

			// Initialize runtime
			const secrets = await this.getCharacterSecrets(character.id);
			const runtime = await this.initializeRuntime(character, secrets);

			// Create nonce using the session ID
			const { nonce } = await this.nonceManager.createNonce(roomId, sessionId);

			// Store runtime in memory
			this.#sessions.set(roomId, {
				runtime,
				character,
				roomId,
				sessionId,  // Store sessionId in memory too
				lastActive: new Date()
			});

			return {
				roomId,
				sessionId,
				nonce,
				config: {
					name: character.name,
					slug: character.slug,
					modelProvider: character.modelProvider,
					bio: character.bio,
					vrmUrl: character.vrmUrl,
					lore: character.lore,
					style: character.style,
					adjectives: character.adjectives,
					topics: character.topics,
					settings: {
						...character.settings,
						secrets: undefined
					}
				}
			};
		} catch (error) {
			console.error('Room initialization error:', error);
			throw error;
		}
	}


	async createInitialSchema() {
		try {
			await this.sql.exec(`
		  -- Main characters table
		  CREATE TABLE IF NOT EXISTS characters (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			author TEXT NOT NULL,
			name TEXT NOT NULL,
			model_provider TEXT NOT NULL,
			bio TEXT,
			settings TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(author, name)
		  );	  
				
		  -- Clients table (e.g., DISCORD, DIRECT)
		  CREATE TABLE IF NOT EXISTS character_clients (
			character_id INTEGER,
			client TEXT NOT NULL,
			FOREIGN KEY(character_id) REFERENCES characters(id),
			PRIMARY KEY(character_id, client)
		  );
  
		  -- Lore entries
		  CREATE TABLE IF NOT EXISTS character_lore (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			character_id INTEGER,
			lore_text TEXT NOT NULL,
			order_index INTEGER,
			FOREIGN KEY(character_id) REFERENCES characters(id)
		  );
  
		  -- Message examples
		  CREATE TABLE IF NOT EXISTS character_messages (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			character_id INTEGER,
			conversation_id INTEGER,
			user TEXT NOT NULL,
			content TEXT NOT NULL, -- JSON string for message content
			message_order INTEGER,
			FOREIGN KEY(character_id) REFERENCES characters(id)
		  );
  
		  -- Post examples
		  CREATE TABLE IF NOT EXISTS character_posts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			character_id INTEGER,
			post_text TEXT NOT NULL,
			FOREIGN KEY(character_id) REFERENCES characters(id)
		  );
  
		  -- Topics
		  CREATE TABLE IF NOT EXISTS character_topics (
			character_id INTEGER,
			topic TEXT NOT NULL,
			FOREIGN KEY(character_id) REFERENCES characters(id),
			PRIMARY KEY(character_id, topic)
		  );
  
		  -- Style settings
		  CREATE TABLE IF NOT EXISTS character_styles (
			character_id INTEGER,
			category TEXT NOT NULL, -- 'all', 'chat', or 'post'
			style_text TEXT NOT NULL,
			FOREIGN KEY(character_id) REFERENCES characters(id),
			PRIMARY KEY(character_id, category, style_text)
		  );
  
		  -- Adjectives
		  CREATE TABLE IF NOT EXISTS character_adjectives (
			character_id INTEGER,
			adjective TEXT NOT NULL,
			FOREIGN KEY(character_id) REFERENCES characters(id),
			PRIMARY KEY(character_id, adjective)
		  );
  
		  -- Create indexes
		  CREATE INDEX IF NOT EXISTS idx_characters_author 
		  ON characters(author);
		  
		  CREATE INDEX IF NOT EXISTS idx_characters_name 
		  ON characters(name);
		`);
		} catch (error) {
			console.error("Error initializing character schema:", error);
			throw error;
		}
	}

	async addRoomSupport() {
		try {
			console.log('Starting simplified room support migration...');
			await this.sql.exec('PRAGMA foreign_keys = OFF;');

			// Get existing tables
			const tables = await this.sql.exec(`SELECT name FROM sqlite_master WHERE type='table'`).toArray();
			console.log('Existing tables:', tables.map(t => t.name));

			// Check if rooms table exists and its columns
			const roomsExists = tables.find(t => t.name === 'rooms');
			if (roomsExists) {
				const roomsColumns = await this.sql.exec('PRAGMA table_info(rooms)').toArray();
				console.log('Current rooms columns:', roomsColumns.map(c => c.name));

				// Add missing columns to rooms table
				if (!roomsColumns.find(c => c.name === 'character_id')) {
					console.log('Adding character_id to rooms table...');
					await this.sql.exec(`ALTER TABLE rooms ADD COLUMN character_id INTEGER`);
				}
				if (!roomsColumns.find(c => c.name === 'current_session_id')) {
					console.log('Adding current_session_id to rooms table...');
					await this.sql.exec(`ALTER TABLE rooms ADD COLUMN current_session_id TEXT`);
				}
			} else {
				// Create rooms table if it doesn't exist
				console.log('Creating rooms table...');
				await this.sql.exec(`
					CREATE TABLE IF NOT EXISTS rooms (
						id TEXT PRIMARY KEY,
						character_id INTEGER,
						created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
						last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
						current_session_id TEXT,
						FOREIGN KEY(character_id) REFERENCES characters(id)
					)
				`);
			}

			// Add room_id to character_sessions if needed
			if (tables.find(t => t.name === 'character_sessions')) {
				const sessionsColumns = await this.sql.exec('PRAGMA table_info(character_sessions)').toArray();
				if (!sessionsColumns.find(c => c.name === 'room_id')) {
					console.log('Adding room_id to character_sessions table...');
					await this.sql.exec(`ALTER TABLE character_sessions ADD COLUMN room_id TEXT REFERENCES rooms(id)`);
				}
			}

			// Add room_id to session_nonces if needed
			if (tables.find(t => t.name === 'session_nonces')) {
				const noncesColumns = await this.sql.exec('PRAGMA table_info(session_nonces)').toArray();
				if (!noncesColumns.find(c => c.name === 'room_id')) {
					console.log('Adding room_id to session_nonces table...');
					await this.sql.exec(`ALTER TABLE session_nonces ADD COLUMN room_id TEXT REFERENCES rooms(id)`);
				}
			}

			// Create or update indexes
			console.log('Creating/updating indexes...');
			await this.sql.exec(`
				CREATE INDEX IF NOT EXISTS idx_rooms_character ON rooms(character_id);
				CREATE INDEX IF NOT EXISTS idx_sessions_room ON character_sessions(room_id);
				CREATE INDEX IF NOT EXISTS idx_nonces_room ON session_nonces(room_id)
			`);

			// Update existing rooms with character_id if needed
			const defaultChar = await this.sql.exec(`SELECT id FROM characters LIMIT 1`).toArray();
			if (defaultChar.length > 0) {
				console.log('Updating existing rooms with default character_id...');
				await this.sql.exec(`
					UPDATE rooms 
					SET character_id = ? 
					WHERE character_id IS NULL
				`, defaultChar[0].id);
			}

			await this.sql.exec('PRAGMA foreign_keys = ON;');
			console.log('Room support migration completed successfully');

			// Verify final schema
			const finalRooms = await this.sql.exec('PRAGMA table_info(rooms)').toArray();
			console.log('Final rooms schema:', finalRooms);

			return true;
		} catch (error) {
			console.error('Error in room support migration:', error);
			await this.sql.exec('PRAGMA foreign_keys = ON;');
			throw error;
		}
	}


	async handleMigrateSchema() {
		try {
			// First ensure base schema exists
			// await this.initializeSchema();
			// console.log('Base schema initialized');

			// // Then add room support
			// await this.addRoomSupport();
			// console.log('Room support added');

			// // Add image fields
			// await this.migrateImageFields();
			// console.log('Image fields added');

			// await this.migrateStatusField();
			// console.log('Status field added');

			await this.migrateMemorySchema();
			console.log('Memory schema migrated');

			return new Response(JSON.stringify({
				success: true,
				message: 'Schema migration completed successfully',
				details: {
					baseSchema: true,
					characterSlugs: true,  // Add this
					roomSupport: true,
					imageFields: true
				}
			}), {
				headers: { 'Content-Type': 'application/json' }
			});
		} catch (error) {
			console.error('Migration error:', error);
			return new Response(JSON.stringify({
				success: false,
				error: 'Migration failed',
				details: error.message
			}), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	}

	async cleanCharacterData(characterData) {
		const cleanedCharacter = {
			...characterData,
			name: characterData.name,
			slug: this.generateSlug(characterData.name),
			status: characterData.status || 'private',
			modelProvider: characterData.modelProvider || "openai",
			clients: characterData.clients || ["DIRECT"],
			bio: Array.isArray(characterData.bio) ? characterData.bio.join('\n') : characterData.bio,
			lore: characterData.lore?.filter(Boolean).map(text => text.trim()) || [],
			topics: characterData.topics?.filter(Boolean).map(text => text.trim()) || [], // Ensure topics is handled
			adjectives: characterData.adjectives?.filter(Boolean).map(text => text.trim()) || [],
			messageExamples: characterData.messageExamples?.filter(Array.isArray) || [],
			postExamples: characterData.postExamples?.filter(Boolean) || [],
			// Properly structure style object
			style: {
				all: characterData.style?.all?.filter(Boolean) || [],
				chat: characterData.style?.chat?.filter(Boolean) || [],
				post: characterData.style?.post?.filter(Boolean) || []
			},
			settings: {
				...(characterData.settings || {}),
				secrets: undefined
			}
		};

		return cleanedCharacter;
	}

	// Helper function to generate slugs - add this to your class
	generateSlug(name) {
		return name
			.trim()
			.toLowerCase()
			.replace(/[^\w\s-]/g, '') // Remove special characters
			.replace(/\s+/g, '-')     // Replace spaces with hyphens
			.replace(/-+/g, '-');     // Replace multiple hyphens with single hyphen
	}

	async createOrUpdateCharacter(author, characterData) {
		try {
			return await this.state.storage.transaction(async (txn) => {
				// Existing validation
				if (!author?.trim()) {
					throw new Error('Author is required');
				}
				if (!characterData?.name?.trim()) {
					throw new Error('Character name is required');
				}

				const bio = Array.isArray(characterData.bio) ? characterData.bio.join('\n') : characterData.bio;
				const secrets = characterData.settings?.secrets;
				const settingsWithoutSecrets = {
					...characterData.settings,
					secrets: undefined
				};

				const cleanedData = await this.cleanCharacterData(characterData);

				// Generate slug
				const slug = this.generateSlug(cleanedData.name);

				// Modified INSERT to include slug
				const result = await this.sql.exec(`
			  INSERT INTO characters (
				author,
				name,
				slug,
				model_provider,
				bio,
				vrm_url,
				profile_img,
				banner_img,
				settings,
				status
			  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			  ON CONFLICT(author, name) DO UPDATE SET
				slug = EXCLUDED.slug,
				model_provider = EXCLUDED.model_provider,
				bio = EXCLUDED.bio,
				vrm_url = EXCLUDED.vrm_url,
				profile_img = EXCLUDED.profile_img,
				banner_img = EXCLUDED.banner_img,
				settings = EXCLUDED.settings,
				status = EXCLUDED.status,
				updated_at = CURRENT_TIMESTAMP
			  RETURNING *
			`,
					author.trim(),
					cleanedData.name.trim(),
					slug,
					cleanedData.modelProvider || 'LLAMALOCAL',
					bio || '',
					cleanedData.vrmUrl || null,
					cleanedData.profileImg || null,
					cleanedData.bannerImg || null,
					JSON.stringify(settingsWithoutSecrets),
					cleanedData.status || 'private'
				).toArray();
				if (!result.length) {
					throw new Error('Failed to create/update character record');
				}

				const characterId = result[0].id;
				console.log('Created/updated character with ID:', characterId);

				// Store secrets separately if provided
				if (secrets?.openai || secrets?.anthropic) {
					const salt = crypto.randomUUID();
					const encryptedSecrets = await this.encryptSecrets({
						openai: secrets.openai || this.env.OPENAI_API_KEY,
						anthropic: secrets.anthropic || this.env.ANTHROPIC_API_KEY
					}, salt);

					// Update or insert secrets
					await this.sql.exec(`
					INSERT INTO character_secrets (
						character_id,
						salt,
						model_keys
					) VALUES (?, ?, ?)
					ON CONFLICT(character_id) DO UPDATE SET
						salt = EXCLUDED.salt,
						model_keys = EXCLUDED.model_keys
					`, characterId, salt, encryptedSecrets);
				}

				// Clear existing related data
				await this.sql.exec("DELETE FROM character_clients WHERE character_id = ?", characterId);
				await this.sql.exec("DELETE FROM character_lore WHERE character_id = ?", characterId);
				await this.sql.exec("DELETE FROM character_messages WHERE character_id = ?", characterId);
				await this.sql.exec("DELETE FROM character_posts WHERE character_id = ?", characterId);
				await this.sql.exec("DELETE FROM character_topics WHERE character_id = ?", characterId);
				await this.sql.exec("DELETE FROM character_styles WHERE character_id = ?", characterId);
				await this.sql.exec("DELETE FROM character_adjectives WHERE character_id = ?", characterId);

				// Insert clients with default if not provided
				const clients = cleanedData.clients || ['DIRECT'];
				for (const client of clients) {
					await this.sql.exec(
						"INSERT INTO character_clients (character_id, client) VALUES (?, ?)",
						characterId, client
					);
				}

				// Insert lore with empty array fallback
				const lore = cleanedData.lore || [];
				for (let i = 0; i < lore.length; i++) {
					await this.sql.exec(
						"INSERT INTO character_lore (character_id, lore_text, order_index) VALUES (?, ?, ?)",
						characterId, lore[i], i
					);
				}

				// Insert message examples with empty array fallback
				const messageExamples = cleanedData.messageExamples || [];
				for (let i = 0; i < messageExamples.length; i++) {
					const conversation = messageExamples[i];
					for (let j = 0; j < conversation.length; j++) {
						const message = conversation[j];
						await this.sql.exec(
							"INSERT INTO character_messages (character_id, conversation_id, user, content, message_order) VALUES (?, ?, ?, ?, ?)",
							characterId, i, message.user, JSON.stringify(message.content), j
						);
					}
				}

				// Insert post examples with empty array fallback
				const postExamples = cleanedData.postExamples || [];
				for (const post of postExamples) {
					await this.sql.exec(
						"INSERT INTO character_posts (character_id, post_text) VALUES (?, ?)",
						characterId, post
					);
				}

				// Insert topics with empty array fallback
				const topics = cleanedData.topics || [];
				for (const topic of topics) {
					await this.sql.exec(
						"INSERT INTO character_topics (character_id, topic) VALUES (?, ?)",
						characterId, topic
					);
				}

				// Insert style settings with default empty categories
				const style = cleanedData.style || { all: [], chat: [], post: [] };
				for (const [category, styles] of Object.entries(style)) {
					for (const styleText of styles) {
						await this.sql.exec(
							"INSERT INTO character_styles (character_id, category, style_text) VALUES (?, ?, ?)",
							characterId, category, styleText
						);
					}
				}

				// Insert adjectives with empty array fallback
				const adjectives = cleanedData.adjectives || [];
				for (const adjective of adjectives) {
					await this.sql.exec(
						"INSERT INTO character_adjectives (character_id, adjective) VALUES (?, ?)",
						characterId, adjective
					);
				}

				return characterId;
			});
		} catch (error) {
			console.error("Error creating/updating character:", error);
			throw new Error(`Failed to create/update character: ${error.message}`);
		}
	}

	async getCharactersByAuthor(author) {
		try {
			const characters = await this.sql.exec(`
			SELECT c.*, 
			  c.vrm_url,
			  c.model_provider,
			  c.profile_img,
			  c.banner_img,
			  c.bio,
			  c.status,
			  c.settings,
			  c.slug,
			  c.created_at,
			  c.updated_at,
			  GROUP_CONCAT(DISTINCT cc.client) as clients,
			  GROUP_CONCAT(DISTINCT cl.lore_text) as lore,
			  GROUP_CONCAT(DISTINCT cp.post_text) as posts,
			  GROUP_CONCAT(DISTINCT ct.topic) as topics,
			  GROUP_CONCAT(DISTINCT ca.adjective) as adjectives
			FROM characters c
			LEFT JOIN character_clients cc ON c.id = cc.character_id
			LEFT JOIN character_lore cl ON c.id = cl.character_id
			LEFT JOIN character_posts cp ON c.id = cp.character_id
			LEFT JOIN character_topics ct ON c.id = ct.character_id
			LEFT JOIN character_adjectives ca ON c.id = ca.character_id
			WHERE c.author = ?
			GROUP BY c.id
			ORDER BY c.updated_at DESC
		  `, author).toArray();

			return Promise.all(characters.map(async (char) => {
				const messages = await this.sql.exec(`
			  SELECT conversation_id, user, content, message_order
			  FROM character_messages
			  WHERE character_id = ?
			  ORDER BY conversation_id, message_order
			`, char.id).toArray();

				const styles = await this.sql.exec(`
			  SELECT category, style_text
			  FROM character_styles
			  WHERE character_id = ?
			`, char.id).toArray();

				const stylesByCategory = {
					all: styles.filter(s => s.category === 'all').map(s => s.style_text),
					chat: styles.filter(s => s.category === 'chat').map(s => s.style_text),
					post: styles.filter(s => s.category === 'post').map(s => s.style_text)
				};

				return {
					name: char.name,
					slug: char.slug,     /* Add slug to return object */
					status: char.status || 'private',
					modelProvider: char.model_provider,
					clients: char.clients ? char.clients.split(',') : ['DIRECT'],
					bio: char.bio,
					vrmUrl: char.vrm_url,
					profileImg: char.profile_img,
					bannerImg: char.banner_img,
					lore: char.lore ? char.lore.split(',').filter(Boolean) : [],
					messageExamples: this.groupMessages(messages),
					postExamples: char.posts ? char.posts.split(',').filter(Boolean) : [],
					topics: char.topics ? char.topics.split(',').filter(Boolean) : [],
					style: stylesByCategory,
					adjectives: char.adjectives ? char.adjectives.split(',').filter(Boolean) : [],
					settings: JSON.parse(char.settings || '{}'),
					created_at: char.created_at,
					updated_at: char.updated_at
				};
			}));
		} catch (error) {
			console.error("Error fetching characters for author:", error);
			throw error;
		}
	}




	async getCharacter(author, slug) {  // Changed parameter name from 'name' to 'slug'
		try {
			const characterCheck = await this.sql.exec(`
			SELECT id FROM characters 
			WHERE author = ? AND slug = ?   /* Changed from name to slug */
		  `, author, slug).toArray();

			if (characterCheck.length === 0) {
				return null;
			}

			const characterId = characterCheck[0].id;

			const character = await this.sql.exec(`
			SELECT c.*, 
			  c.vrm_url,           
			  c.model_provider,
			  c.profile_img,
			  c.banner_img,
			  c.bio,
			  c.status,
			  c.settings,
			  c.slug,
			  c.created_at,
			  c.updated_at,
			  GROUP_CONCAT(DISTINCT cc.client) as clients,
			  GROUP_CONCAT(DISTINCT cl.lore_text) as lore,
			  GROUP_CONCAT(DISTINCT cp.post_text) as posts,
			  GROUP_CONCAT(DISTINCT ct.topic) as topics,
			  GROUP_CONCAT(DISTINCT ca.adjective) as adjectives
			FROM characters c
			LEFT JOIN character_clients cc ON c.id = cc.character_id
			LEFT JOIN character_lore cl ON c.id = cl.character_id
			LEFT JOIN character_posts cp ON c.id = cp.character_id
			LEFT JOIN character_topics ct ON c.id = ct.character_id
			LEFT JOIN character_adjectives ca ON c.id = ca.character_id
			WHERE c.author = ? AND c.slug = ?
			GROUP BY c.id
			LIMIT 1
		  `, author, slug).toArray();

			if (character.length === 0) {
				return null;
			}

			const char = character[0];

			// Rest remains the same
			const messages = await this.sql.exec(`
			SELECT conversation_id, user, content, message_order
			FROM character_messages
			WHERE character_id = ?
			ORDER BY conversation_id, message_order
		  `, characterId).toArray();

			const styles = await this.sql.exec(`
			SELECT category, style_text
			FROM character_styles
			WHERE character_id = ?
		  `, characterId).toArray();

			const stylesByCategory = {
				all: styles.filter(s => s.category === 'all').map(s => s.style_text),
				chat: styles.filter(s => s.category === 'chat').map(s => s.style_text),
				post: styles.filter(s => s.category === 'post').map(s => s.style_text)
			};

			return {
				id: characterId,
				name: char.name,
				slug: char.slug,
				status: char.status || 'private',
				modelProvider: char.model_provider,
				clients: char.clients ? char.clients.split(',') : ['DIRECT'],
				bio: char.bio,
				vrmUrl: char.vrm_url,
				profileImg: char.profile_img,
				bannerImg: char.banner_img,
				lore: char.lore ? char.lore.split(',').filter(Boolean) : [],
				messageExamples: this.groupMessages(messages),
				postExamples: char.posts ? char.posts.split(',').filter(Boolean) : [],
				topics: char.topics ? char.topics.split(',').filter(Boolean) : [],
				style: stylesByCategory,
				adjectives: char.adjectives ? char.adjectives.split(',').filter(Boolean) : [],
				settings: JSON.parse(char.settings || '{}'),
				created_at: char.created_at,
				updated_at: char.updated_at
			};
		} catch (error) {
			console.error("Error fetching character:", error);
			throw error;
		}
	}


	// Add to CharacterRegistryDO class
	async getFeaturedCharacters(authors) {
		const featuredAuthors = ['antpb'];
		try {
			const featuredCharacters = [];
			for (const author of featuredAuthors) {
				const characters = await this.sql.exec(`
			  SELECT c.*, 
				c.vrm_url,  
				c.profile_img,
				c.banner_img,         
				c.model_provider,
				c.bio,
				c.status,
				c.slug,           /* Add slug to selection */
				c.settings,
				c.created_at,
				c.updated_at
			  FROM characters c
			  WHERE c.author = ?
			  ORDER BY c.updated_at ASC
			`, author).toArray();

				featuredCharacters.push(...characters.map(char => ({
					author,
					name: char.name,
					slug: char.slug,     /* Add slug to return object */
					bio: char.bio,
					status: char.status || 'private',
					vrmUrl: char.vrm_url,
					profileImg: char.profile_img,
					bannerImg: char.banner_img,
					modelProvider: char.model_provider,
					created_at: char.created_at,
					updated_at: char.updated_at
				})));
			}

			return featuredCharacters;
		} catch (error) {
			console.error('Error fetching featured characters:', error);
			throw error;
		}
	}


	groupMessages(messages) {
		const conversations = {};
		for (const msg of messages) {
			if (!conversations[msg.conversation_id]) {
				conversations[msg.conversation_id] = [];
			}
			conversations[msg.conversation_id].push({
				user: msg.user,
				content: JSON.parse(msg.content)
			});
		}
		return Object.values(conversations);
	}

	groupStyles(styles) {
		const grouped = {};
		for (const style of styles) {
			if (!grouped[style.category]) {
				grouped[style.category] = [];
			}
			grouped[style.category].push(style.style_text);
		}
		return grouped;
	}

	// Add method to handle secrets
	async getCharacterSecrets(characterId) {
		try {
			console.log('Getting secrets for character ID:', characterId);

			if (!characterId) {
				throw new Error('Character ID is required');
			}

			// Verify character exists first
			const chars = await this.sql.exec(`
			SELECT * FROM characters WHERE id = ?
		  `, characterId).toArray();

			if (!chars.length) {
				throw new Error(`Character with ID ${characterId} not found`);
			}

			const character = chars[0];
			console.log('Found character:', character.name, character.slug);

			// Get existing secrets
			const secrets = await this.sql.exec(`
				SELECT * FROM character_secrets 
				WHERE character_id = ?
			`, characterId).toArray();

			if (!secrets.length) {
				console.log('No secrets found, creating new ones');
				// Initialize with all possible secret fields
				const salt = crypto.randomUUID();
				const modelKeys = {
					openai: this.env.OPENAI_API_KEY,
					anthropic: this.env.ANTHROPIC_API_KEY,
					discord_token: null,
					discord_public_key: null,
					discord_app_id: null,
					twitter_username: null,
					twitter_cookies: null,
					telegram_token: null
				};

				const encrypted = await this.encryptSecrets(modelKeys, salt);

				await this.sql.exec(`
					INSERT INTO character_secrets (
						character_id,
						salt,
						model_keys
					) VALUES (?, ?, ?)
				`, characterId, salt, encrypted);

				return { salt, modelKeys };
			}

			// Decrypt existing secrets
			const decrypted = await this.decryptSecrets(secrets[0].model_keys, secrets[0].salt);
			return {
				salt: secrets[0].salt,
				modelKeys: decrypted
			};
		} catch (error) {
			console.error('Error in getCharacterSecrets:', error);
			throw error;
		}
	}


	async getOrCreateRoom(roomId, characterId) {
		try {
			// First check if room exists
			const existingRoom = await this.sql.exec(`
			SELECT r.*, cs.id as current_session_id 
			FROM rooms r
			LEFT JOIN character_sessions cs ON cs.id = r.current_session_id
			WHERE r.id = ? 
			LIMIT 1
		  `, roomId).toArray();

			if (existingRoom.length) {
				// Update last_active timestamp
				await this.sql.exec(`
			  UPDATE rooms 
			  SET last_active = CURRENT_TIMESTAMP 
			  WHERE id = ?
			`, roomId);

				return existingRoom[0];
			}

			// Create new room if it doesn't exist
			console.log('Creating new room:', roomId);
			await this.sql.exec(`
			INSERT INTO rooms (
			  id,
			  character_id,
			  created_at,
			  last_active
			) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		  `, roomId, characterId);

			// Return the newly created room
			const newRoom = await this.sql.exec(`
			SELECT * FROM rooms WHERE id = ? LIMIT 1
		  `, roomId).toArray();

			return newRoom[0] || null;
		} catch (error) {
			console.error('Error in getOrCreateRoom:', error);
			if (error.message.includes('FOREIGN KEY constraint failed')) {
				console.error('Character ID not found:', characterId);
			}
			throw error;
		}
	}

	// async initializeCharacterRoom(author, name, roomId) {
	// 	try {
	// 		console.log('Initializing session for:', author, name, 'in room:', roomId);
	// 		const character = await this.getCharacter(author, name);
	// 		console.log('Character data:', character);
	// 		if (!character) {
	// 			throw new Error('Character not found');
	// 		}

	// 		if (!roomId) {
	// 			throw new Error('Room ID is required');
	// 		}

	// 		// Get or create room with provided ID
	// 		const roomExists = await this.sql.exec(`
	// 		SELECT id FROM rooms WHERE id = ? LIMIT 1
	// 	  `, roomId).toArray();

	// 		if (!roomExists.length) {
	// 			console.log('Creating new room:', roomId);
	// 			await this.sql.exec(`
	// 		  INSERT INTO rooms (
	// 			id,
	// 			character_id,
	// 			created_at,
	// 			last_active
	// 		  ) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	// 		`, roomId, character.id);
	// 		}

	// 		// Initialize runtime
	// 		const secrets = await this.getCharacterSecrets(character.id);
	// 		const runtime = await this.initializeRuntime(character, secrets);

	// 		// Create session
	// 		const sessionId = crypto.randomUUID();
	// 		console.log('Creating session with ID:', sessionId);

	// 		// Create session record with room ID
	// 		await this.sql.exec(`
	// 		INSERT INTO character_sessions (
	// 		  id,
	// 		  character_id,
	// 		  room_id,
	// 		  created_at,
	// 		  last_active
	// 		) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	// 	  `, sessionId, character.id, roomId);

	// 		// Update room's current session
	// 		await this.sql.exec(`
	// 		UPDATE rooms 
	// 		SET current_session_id = ?,
	// 			last_active = CURRENT_TIMESTAMP 
	// 		WHERE id = ?
	// 	  `, sessionId, roomId);

	// 		// Create nonce for security
	// 		const { nonce } = await this.nonceManager.createNonce(roomId, sessionId);

	// 		// Store runtime in memory
	// 		this.#sessions.set(roomId, {
	// 			runtime,
	// 			character,
	// 			roomId,
	// 			lastActive: new Date()
	// 		});

	// 		return {
	// 			roomId,
	// 			sessionId,
	// 			nonce,
	// 			config: {
	// 				name: character.name,
	// 				status: character.status || 'private',
	// 				modelProvider: character.modelProvider,
	// 				bio: character.bio,
	// 				vrmUrl: character.vrmUrl,
	// 				lore: character.lore,
	// 				style: character.style,
	// 				adjectives: character.adjectives,
	// 				topics: character.topics,
	// 				settings: {
	// 					...character.settings,
	// 					secrets: undefined
	// 				}
	// 			}
	// 		};
	// 	} catch (error) {
	// 		console.error('Room initialization error:', error);
	// 		throw error;
	// 	}
	// }


	// First, add the token estimation utility
	async estimateTokens(text) {
		if (!text) return 0;
		// Basic estimation: roughly 4 characters per token
		return Math.ceil(text.length / 4);
	}

	async trimText(text, maxTokens) {
		if (!text) return "";
		const estimatedTokens = estimateTokens(text);
		if (estimatedTokens <= maxTokens) return text;

		// Approximate characters needed
		const targetLength = Math.floor((maxTokens / estimatedTokens) * text.length);

		// Try to break at sentence boundary
		const truncated = text.slice(0, targetLength);
		const lastPeriod = truncated.lastIndexOf('.');
		if (lastPeriod > targetLength * 0.7) { // Only use sentence break if it's not too short
			return truncated.slice(0, lastPeriod + 1);
		}

		// Fall back to word boundary
		const lastSpace = truncated.lastIndexOf(' ');
		return truncated.slice(0, lastSpace);
	}

	async initializeSession(sessionId, updatedCharacter) {
		try {
			// Get session with room_id
			const dbSessions = await this.sql.exec(`
				SELECT cs.*, c.author, c.name, c.slug, cs.room_id
				FROM character_sessions cs
				JOIN characters c ON cs.character_id = c.id
				WHERE cs.id = ?
			`, sessionId).toArray();

			if (!dbSessions.length) {
				throw new Error('Session not found');
			}
			const dbSession = dbSessions[0];

			// Check if we already have an active session for this room
			let activeSession = this.#sessions.get(dbSession.room_id);

			// If we have an active session with a runtime, return it
			if (activeSession?.runtime) {
				if (updatedCharacter) {
					activeSession.runtime.settings = updatedCharacter.settings;
				}
				return activeSession;
			}

			// If we have a session but no runtime, or no session at all, we need to initialize
			const characters = await this.sql.exec(`
				SELECT * 
				FROM characters
				WHERE id = ?
			`, dbSession.character_id).toArray();

			if (!characters.length) {
				throw new Error('Character not found');
			}

			const character = characters[0];
			if (updatedCharacter) {
				character.settings = updatedCharacter.settings;
			}

			// Create active session
			activeSession = {
				id: dbSession.id,
				sessionId: dbSession.id,
				character,
				roomId: dbSession.room_id,
				createdAt: new Date(dbSession.created_at),
				lastActive: new Date()
			};

			// Get secrets and initialize runtime
			const secrets = await this.getCharacterSecrets(character.id);
			const runtime = await this.initializeRuntime(character, secrets);
			activeSession.runtime = runtime;

			// Store session using room ID as key
			this.#sessions.set(dbSession.room_id, activeSession);

			return activeSession;

		} catch (error) {
			console.error('Session initialization error:', error);
			throw error;
		}
	}

	async initializeRuntime(character, secrets) {
		try {
			globalThis.encoding_for_model = () => ({
				encode: (text) => {
					if (!text) return [];
					// Simple character-based estimation
					return new Array(Math.ceil(text.length / 4)).fill(1);
				},
				decode: () => "",
			});

			globalThis.trimTokens = (text, maxTokens) => {
				if (!text) return "";
				const approxCharsPerToken = 4;
				const targetLength = maxTokens * approxCharsPerToken;

				if (text.length <= targetLength) {
					return text;
				}

				// Try to break at sentence
				const truncated = text.slice(0, targetLength);
				const lastPeriod = truncated.lastIndexOf('.');
				if (lastPeriod > targetLength * 0.7) {
					return truncated.slice(0, lastPeriod + 1);
				}

				// Fall back to word boundary
				const lastSpace = truncated.lastIndexOf(' ');
				return truncated.slice(0, lastSpace);
			};

			const { AgentRuntime, embed, generateMessageResponse, models } = await import('./eliza-core/index.js');
			console.log("id and id", this.env.CF_ACCOUNT_ID, this.env.CF_GATEWAY_ID);
			const self = this; // Store reference to the class instance

			const messageAction = {
				name: "RESPOND",
				similes: ["REPLY", "CHAT", "TALK", "SAY"],
				description: "Send a normal chat message response",
				validate: async (runtime, message, state) => true,
				handler: async (runtime, message, state, options = {}, callback) => {
					console.log("Executing message action handler");
					try {
						const modelProvider = runtime.modelProvider.toLowerCase();
						runtime.modelProvider = modelProvider;
						runtime.settings.USE_SIMPLE_TOKENIZER = true;
						runtime.character.settings.useSimpleTokenizer = true;

						// Get conversation history
						const conversationHistory = await runtime.messageManager.getMemories({
							roomId: message.roomId,
							count: 10,
							type: 'message',
							unique: false
						}) || [];

						// Get user memories
						const userMemories = await runtime.messageManager.getMemoriesByRoomIds({
							agentId: message.userId,
							roomIds: [message.roomId],
							count: 5
						}) || [];

						// Format the memory sections
						const memoriesSection = `
			Recent Interactions with User:
			${userMemories.map(m => {
							const speaker = m.userId === runtime.agentId ? 'Agent' : 'User';
							return `- ${speaker}: ${m.content?.text || 'Unknown message'}`;
						}).join('\n')}`;

						// Create system message
						const systemMessage = `You are ${runtime.character.name}. ${runtime.character.bio}
			
			Key Character Traits:
			${runtime.character.adjectives.map(adj => `- ${adj}`).join('\n')}
			
			Style Guidelines:
			${runtime.character.style?.all.map(style => `- ${style}`).join('\n')}
			${runtime.character.style?.chat.map(style => `- ${style}`).join('\n')}
			
			${memoriesSection}
			
			Remember these previous interactions and maintain your character's personality.`;

						// Build conversation messages
						const messages = [
							{
								role: "system",
								content: systemMessage
							},
							...conversationHistory.reverse().map(msg => ({
								role: msg.userId === runtime.agentId ? "assistant" : "user",
								content: msg.content?.text || '',
								name: msg.userName
							})),
							{
								role: "user",
								content: message.text,
								name: message.userName
							}
						];

						// Make API call with proper timeout
						const response = await fetch(`https://gateway.ai.cloudflare.com/v1/${self.env.CF_ACCOUNT_ID}/${self.env.CF_GATEWAY_ID}/openai/chat/completions`, {
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
								'Authorization': `Bearer ${runtime.settings?.openai_api_key || self.env.OPENAI_API_KEY}`
							},
							body: JSON.stringify({
								model: runtime.settings?.model || 'gpt-4',
								messages: messages,
								max_tokens: 150,
								temperature: 0.7,
								presence_penalty: 0.6
							})
						});

						if (!response.ok) {
							throw new Error(`API call failed: ${response.status}`);
						}

						const result = await response.json();
						const responseText = result.choices[0].message.content;

						const responseMessage = {
							id: crypto.randomUUID(),
							text: responseText,
							createdAt: Date.now(),
							userId: runtime.agentId,
							roomId: message.roomId,
							content: {
								text: responseText,
								action: "RESPOND"
							}
						};

						await runtime.databaseAdapter.createMemory({
							...responseMessage,
							type: 'message',
							isUnique: false
						});

						if (callback) {
							await callback([responseMessage]);
						}

						return [responseMessage];

					} catch (error) {
						console.error("Error in message action handler:", error);
						const errorMessage = {
							id: crypto.randomUUID(),
							text: "I apologize, but I encountered an error processing your message.",
							createdAt: Date.now(),
							userId: runtime.agentId,
							roomId: message.roomId,
							content: {
								text: "I apologize, but I encountered an error processing your message.",
								action: "RESPOND"
							}
						};

						if (callback) {
							await callback([errorMessage]);
						}

						return [errorMessage];
					}
				}
			};

			const databaseAdapter = new EnhancedSQLiteMemoryAdapter(this.sql);
			await databaseAdapter.initializeSchema();

			// const model = character.settings?.model || 'gpt-4o-mini';
			// const modelProvider = model.toLowerCase().includes('claude') ? 'ANTHROPIC' : 'OPENAI';
			const model = 'gpt-4o-mini';
			const modelProvider = 'openai';
			const token = modelProvider === 'ANTHROPIC' ? secrets.modelKeys.anthropic : secrets.modelKeys.openai;
			console.log("character in init is", character);
			const config = {
				agentId: character.id || crypto.randomUUID(),
				serverUrl: 'http://localhost:7998',
				token: token,
				model: model,
				modelProvider: modelProvider,
				character: {
					...character,
					modelProvider: modelProvider,
					settings: {
						...character.settings,
						model: model,
						modelProvider: modelProvider,
						useSimpleTokenizer: true
					}
				},
				settings: {
					model: model,
					voice: character.settings?.voice,
					modelProvider: modelProvider,
					USE_OPENAI_EMBEDDING: false,
					USE_SIMPLE_TOKENIZER: true
				},
				databaseAdapter,
				conversationLength: 10,
				embed: embed,
				actions: [messageAction]
			};

			// Create the runtime with the base configuration
			console.log("Creating runtime with config:", {
				model: config.model,
				modelProvider: config.modelProvider,
				hasSettings: !!config.settings,
				settings: config.settings
			});

			const runtime = new AgentRuntime({
				...config,
				character: {
					...config.character,
					modelProvider: modelProvider,
					model: model,  // Move this into character
					settings: {
						...config.character.settings,
						model,
						modelProvider,
						// These seem to be what the core wants
						USE_OPENAI_EMBEDDING: false,
						embeddingModel: model
					}
				}
			});

			console.log("Post-update runtime state:", {
				hasModels: !!runtime.models,
				modelsKeys: Object.keys(runtime.models || {}),
				characterModelProvider: runtime.character.modelProvider,
				modelProvider: runtime.modelProvider
			});

			// Instead of proxying the entire runtime, just override the specific methods we need
			// runtime.trimTokens = (text, maxTokens) => {
			// 	// Simple and safe character-based trimming
			// 	const approxCharsPerToken = 4;
			// 	const targetLength = maxTokens * approxCharsPerToken;

			// 	if (text.length <= targetLength) {
			// 		return text;
			// 	}

			// 	// Try to break at sentence
			// 	const truncated = text.slice(0, targetLength);
			// 	const lastPeriod = truncated.lastIndexOf('.');
			// 	if (lastPeriod > targetLength * 0.7) {
			// 		return truncated.slice(0, lastPeriod + 1);
			// 	}

			// 	// Fall back to word boundary
			// 	const lastSpace = truncated.lastIndexOf(' ');
			// 	return truncated.slice(0, lastSpace);
			// };
			// // Override the encoding_for_model function at the module level
			// const originalGenerateText = runtime.generateText;
			// runtime.generateText = async (...args) => {
			// 	// Replace any calls to encoding_for_model with our estimation
			// 	global.encoding_for_model = () => ({
			// 		encode: (text) => new Array(estimateTokens(text)).fill(1),
			// 		decode: () => "",
			// 	});

			// 	try {
			// 		return await originalGenerateText.apply(runtime, args);
			// 	} finally {
			// 		delete global.encoding_for_model;
			// 	}
			// };
			// Important: Set these properties explicitly on the runtime instance
			// runtime.model = config.model;
			// runtime.modelProvider = config.modelProvider;
			runtime.databaseAdapter = databaseAdapter;
			runtime.settings = {
				...config.settings,
				USE_SIMPLE_TOKENIZER: true  // New flag
			};

			runtime.databaseAdapter = databaseAdapter;

			// Add embed function directly to runtime
			runtime.embed = embed;

			// Add a safe version of vector search to the knowledgeManager
			runtime.knowledgeManager = {
				...runtime.knowledgeManager,
				searchMemoriesByEmbedding: async (embedding, options = {}) => {
					try {
						const { roomId, count = 5 } = options;
						// Just return recent memories since we can't do real vector search
						const memories = await databaseAdapter.getMemories({
							roomId,
							count,
							type: 'message',
							unique: false
						});
						return memories;
					} catch (error) {
						console.error('Error in searchMemoriesByEmbedding:', error);
						return [];
					}
				}
			};

			return runtime;
		} catch (error) {
			console.error('Runtime initialization error:', error);
			throw error;
		}
	}

	async createEmptyEmbedding() {
		// Return a zero vector or null depending on your needs
		return null;
	}

	async searchMemoriesByEmbedding(embedding, options = {}) {
		try {
			// For now, just return recent messages since we can't do vector search
			const { roomId, count = 5 } = options;
			return await this.getMemories({ roomId, count, unique: false });
		} catch (error) {
			console.error('Error in searchMemoriesByEmbedding:', error);
			return [];
		}
	}
	async handleWorldMessage(sessionId, message, nonce = null, apiKey = null) { // Add apiKey parameter
		try {
			console.log("Starting message handling with:", { sessionId, nonce });

			// If we have an API key, verify it and get user info
			let userInfo = null;
			if (apiKey) {
				const id = this.env.USER_AUTH.idFromName("global");
				const auth = this.env.USER_AUTH.get(id);

				// Verify API key for thing
				const verifyResponse = await auth.fetch(new Request('http://internal/verify-key', {
					method: 'POST',
					body: JSON.stringify({ apiKey })
				}));

				const verifyResult = await verifyResponse.json();

				console.log("verified reponse is", verifyResult);

				if (verifyResult.valid) {
					const username = verifyResult.username;
					if (username) {
						userInfo = { userId: username, userName: username };
					}
				}
			}

			// Rest of your existing nonce validation code...
			if (nonce) {
				const isValid = await this.nonceManager.validateNonce(sessionId, nonce);
				if (!isValid) {
					const newSession = await this.initializeSession(sessionId);
					if (!newSession) {
						throw new Error('Session initialization failed');
					}
					sessionId = newSession.sessionId || newSession.id;
				}
			}

			let activeSession = await this.initializeSession(sessionId);
			if (!activeSession?.roomId) {
				throw new Error('Session initialization failed - no roomId');
			}

			// Use authenticated user info if available, otherwise generate guest info
			const userMemoryData = {
				id: crypto.randomUUID(),
				type: 'message',
				content: {
					text: message,
					model: 'gpt-4o-mini'
				},
				userId: userInfo?.userId || null,  // Only set for authenticated users
				userName: userInfo?.userName || `guest-${crypto.randomUUID().slice(0, 8)}`,
				roomId: activeSession.roomId,
				agentId: activeSession.character.id,
				createdAt: Date.now()
			};

			await this.state.storage.transaction(async (txn) => {
				await activeSession.runtime.databaseAdapter.createMemory(userMemoryData);
			});

			// Process AI response
			const aiResponse = await new Promise((resolve, reject) => {
				const timeout = setTimeout(() => reject(new Error('Response timeout')), 30000);

				try {
					activeSession.runtime.processActions(
						{
							id: userMemoryData.id,
							text: message,
							createdAt: userMemoryData.createdAt,
							userId: userMemoryData.userId,
							userName: userMemoryData.userName,
							roomId: activeSession.roomId,
							model: 'gpt-4o-mini',
							modelProvider: 'openai',
							content: userMemoryData.content
						},
						[{
							user: activeSession.character.name,
							model: 'gpt-4o-mini',
							modelProvider: 'openai',
							content: {
								text: message,
								action: 'RESPOND',
								model: 'gpt-4o-mini'
							}
						}],
						{
							model: 'gpt-4o-mini',
							modelProvider: 'openai'
						},
						(response) => {
							clearTimeout(timeout);
							resolve(response);
						}
					).catch(reject);
				} catch (error) {
					clearTimeout(timeout);
					reject(error);
				}
			});
			console.log("response is", aiResponse);
			const responseText = aiResponse?.[0]?.content?.text || 'No response generated';

			// Store AI response
			const aiMemoryData = {
				id: crypto.randomUUID(),
				type: 'message',
				content: {
					text: responseText,
					model: 'gpt-4o-mini',
					action: 'RESPOND'
				},
				userId: null,
				userName: activeSession.character.slug,
				roomId: activeSession.roomId,
				agentId: activeSession.character.id,
				createdAt: Date.now()
			};

			await this.state.storage.transaction(async (txn) => {
				await activeSession.runtime.databaseAdapter.createMemory(aiMemoryData);
			});

			// Create new nonce
			const { nonce: newNonce } = await this.nonceManager.createNonce(activeSession.roomId, sessionId);

			return {
				text: responseText,
				nonce: newNonce,
				sessionId: sessionId,
				roomId: activeSession.roomId
			};

		} catch (error) {
			console.error('Message handling error:', error);
			throw error;
		}
	}

	async handleMessage(sessionId, message, nonce = null, apiKey = null) {
		try {
			console.log("Starting message handling with:", { sessionId, nonce });

			let activeSession = await this.initializeSession(sessionId);
			if (!activeSession?.roomId) {
				throw new Error('Session initialization failed - no roomId');
			}

			// Store user message
			const userMemoryData = {
				id: crypto.randomUUID(),
				type: 'message',
				content: {
					text: message,
					model: 'gpt-4o-mini'
				},
				userId: apiKey ? userInfo?.userId : null,
				userName: apiKey ? userInfo?.userName : `guest-${crypto.randomUUID().slice(0, 8)}`,
				roomId: activeSession.roomId,
				agentId: activeSession.character.id,
				createdAt: Date.now()
			};

			await this.state.storage.transaction(async (txn) => {
				await activeSession.runtime.databaseAdapter.createMemory(userMemoryData);
			});

			// Prepare API call parameters
			const messages = [
				{
					role: "system",
					content: `You are ${activeSession.character.name}. ${activeSession.character.bio}\n\nStyle: ${activeSession.character.style.all.join(", ")}`
				},
				{
					role: "user",
					content: message
				}
			];

			console.log("Attempting OpenAI API call with:", {
				accountId: this.env.CF_ACCOUNT_ID,
				gatewayId: this.env.CF_GATEWAY_ID,
				messageCount: messages.length
			});

			// Make API call with explicit timeout
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 25000);

			try {
				const response = await fetch(
					`https://gateway.ai.cloudflare.com/v1/${this.env.CF_ACCOUNT_ID}/${this.env.CF_GATEWAY_ID}/openai/chat/completions`,
					{
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${this.env.OPENAI_API_KEY}`
						},
						body: JSON.stringify({
							model: 'gpt-4o-mini',
							messages,
							max_tokens: 150,
							temperature: 0.7,
							presence_penalty: 0.6
						}),
						signal: controller.signal
					}
				);

				clearTimeout(timeout);

				if (!response.ok) {
					const errorText = await response.text();
					console.error("OpenAI API error:", {
						status: response.status,
						statusText: response.statusText,
						error: errorText
					});
					throw new Error(`API call failed: ${response.status} - ${errorText}`);
				}

				const result = await response.json();
				console.log("API response received:", {
					hasChoices: !!result.choices,
					choiceCount: result.choices?.length
				});

				const responseText = result.choices[0].message.content;

				// Store AI response
				const aiMemoryData = {
					id: crypto.randomUUID(),
					type: 'message',
					content: {
						text: responseText,
						model: 'gpt-4o-mini',
						action: 'RESPOND'
					},
					userId: null,
					userName: activeSession.character.slug,
					roomId: activeSession.roomId,
					agentId: activeSession.character.id,
					createdAt: Date.now()
				};

				await this.state.storage.transaction(async (txn) => {
					await activeSession.runtime.databaseAdapter.createMemory(aiMemoryData);
				});

				// Create new nonce
				const { nonce: newNonce } = await this.nonceManager.createNonce(
					activeSession.roomId,
					sessionId
				);

				return {
					text: responseText,
					nonce: newNonce,
					sessionId: sessionId,
					roomId: activeSession.roomId
				};
			} catch (error) {
				if (error.name === 'AbortError') {
					throw new Error('API request timed out after 25 seconds');
				}
				throw error;
			} finally {
				clearTimeout(timeout);
			}
		} catch (error) {
			console.error('Message handling error:', {
				error: error.message,
				stack: error.stack,
				type: error.constructor.name
			});
			throw error;
		}
	}


	async deleteCharacter(author, slug) {  // Changed from name to slug
		try {
			// First, get the character ID
			const characters = await this.sql.exec(`
				SELECT id FROM characters 
				WHERE author = ? AND slug = ?  // Changed from name to slug
			  `, author, slug).toArray();

			if (!characters.length) {
				throw new Error('Character not found');
			}

			const characterId = characters[0].id;

			// Rest remains the same...
			await this.state.storage.transaction(async () => {
				await this.sql.exec('DELETE FROM character_secrets WHERE character_id = ?', characterId);
				await this.sql.exec('DELETE FROM character_clients WHERE character_id = ?', characterId);
				await this.sql.exec('DELETE FROM character_lore WHERE character_id = ?', characterId);
				await this.sql.exec('DELETE FROM character_messages WHERE character_id = ?', characterId);
				await this.sql.exec('DELETE FROM character_posts WHERE character_id = ?', characterId);
				await this.sql.exec('DELETE FROM character_topics WHERE character_id = ?', characterId);
				await this.sql.exec('DELETE FROM character_styles WHERE character_id = ?', characterId);
				await this.sql.exec('DELETE FROM character_adjectives WHERE character_id = ?', characterId);
				await this.sql.exec('DELETE FROM character_sessions WHERE character_id = ?', characterId);
				await this.sql.exec('DELETE FROM characters WHERE id = ?', characterId);
			});

			return true;
		} catch (error) {
			console.error('Delete character error:', error);
			throw error;
		}
	}

	// Add scheduled cleanup
	async scheduled(controller, env, ctx) {
		await this.nonceManager.cleanupExpiredNonces();
	}

	async updateCharacterMetadata(author, character) {
		try {
			const bio = Array.isArray(character.bio) ? character.bio.join('\n') : character.bio;
			const settingsWithoutSecrets = {
				...character.settings,
				secrets: undefined
			};

			const result = await this.sql.exec(`
				UPDATE characters 
				SET 
				  model_provider = ?,
				  bio = ?,
				  vrm_url = ?,
				  settings = ?,
				  status = ?,
				  updated_at = CURRENT_TIMESTAMP
				WHERE author = ? AND slug = ?  // Changed from name to slug
				RETURNING *
			  `,
				character.modelProvider || 'LLAMALOCAL',
				bio,
				character.vrmUrl,
				JSON.stringify(settingsWithoutSecrets),
				character.status || 'private',
				author,
				character.slug  // Changed from character.name
			).toArray();

			if (!result.length) {
				throw new Error('Character not found');
			}

			const characterId = result[0].id;

			// Clear existing related data
			await this.sql.exec("DELETE FROM character_clients WHERE character_id = ?", characterId);
			await this.sql.exec("DELETE FROM character_lore WHERE character_id = ?", characterId);
			await this.sql.exec("DELETE FROM character_messages WHERE character_id = ?", characterId);
			await this.sql.exec("DELETE FROM character_posts WHERE character_id = ?", characterId);
			await this.sql.exec("DELETE FROM character_topics WHERE character_id = ?", characterId);
			await this.sql.exec("DELETE FROM character_styles WHERE character_id = ?", characterId);
			await this.sql.exec("DELETE FROM character_adjectives WHERE character_id = ?", characterId);

			const cleanedData = await this.cleanCharacterData(character);

			// Insert clients with default if not provided
			const clients = cleanedData.clients || ['DIRECT'];
			for (const client of clients) {
				await this.sql.exec(
					"INSERT INTO character_clients (character_id, client) VALUES (?, ?)",
					characterId, client
				);
			}

			// Insert lore with empty array fallback
			const lore = cleanedData.lore || [];
			for (let i = 0; i < lore.length; i++) {
				await this.sql.exec(
					"INSERT INTO character_lore (character_id, lore_text, order_index) VALUES (?, ?, ?)",
					characterId, lore[i], i
				);
			}

			// Insert message examples with empty array fallback
			const messageExamples = cleanedData.messageExamples || [];
			for (let i = 0; i < messageExamples.length; i++) {
				const conversation = messageExamples[i];
				for (let j = 0; j < conversation.length; j++) {
					const message = conversation[j];
					await this.sql.exec(
						"INSERT INTO character_messages (character_id, conversation_id, user, content, message_order) VALUES (?, ?, ?, ?, ?)",
						characterId, i, message.user, JSON.stringify(message.content), j
					);
				}
			}

			// Insert post examples with empty array fallback
			const postExamples = cleanedData.postExamples || [];
			for (const post of postExamples) {
				await this.sql.exec(
					"INSERT INTO character_posts (character_id, post_text) VALUES (?, ?)",
					characterId, post
				);
			}

			// Insert topics with empty array fallback
			const topics = cleanedData.topics || [];
			for (const topic of topics) {
				await this.sql.exec(
					"INSERT INTO character_topics (character_id, topic) VALUES (?, ?)",
					characterId, topic
				);
			}

			// Insert style settings with default empty categories
			const style = cleanedData.style || { all: [], chat: [], post: [] };
			for (const [category, styles] of Object.entries(style)) {
				for (const styleText of styles) {
					await this.sql.exec(
						"INSERT INTO character_styles (character_id, category, style_text) VALUES (?, ?, ?)",
						characterId, category, styleText
					);
				}
			}

			// Insert adjectives with empty array fallback
			const adjectives = cleanedData.adjectives || [];
			for (const adjective of adjectives) {
				await this.sql.exec(
					"INSERT INTO character_adjectives (character_id, adjective) VALUES (?, ?)",
					characterId, adjective
				);
			}

			return characterId;
		} catch (error) {
			console.error("Error updating character metadata:", error);
			throw error;
		}
	}

	async updateCharacterImages(author, slug, updates) {  // Changed from characterName to slug
		try {
			const updateFields = [];
			const params = [];

			if (updates.profileImg !== undefined) {
				updateFields.push('profile_img = ?');
				params.push(updates.profileImg);
			}
			if (updates.bannerImg !== undefined) {
				updateFields.push('banner_img = ?');
				params.push(updates.bannerImg);
			}

			if (!updateFields.length) {
				throw new Error('No image updates provided');
			}

			params.push(author, slug);  // Changed from characterName to slug

			const result = await this.sql.exec(`
				UPDATE characters 
				SET ${updateFields.join(', ')},
					updated_at = CURRENT_TIMESTAMP
				WHERE author = ? AND slug = ?  // Changed from name to slug
				RETURNING *
			  `, ...params).toArray();

			if (!result.length) {
				throw new Error('Character not found');
			}

			return result[0];
		} catch (error) {
			console.error("Error updating character images:", error);
			throw error;
		}
	}

	async updateCharacterSecrets(author, slug, secrets) {  // Changed from characterName to slug
		try {
			// First get the character ID
			const characters = await this.sql.exec(`
				SELECT id FROM characters 
				WHERE author = ? AND slug = ?  // Changed from name to slug
			`, author, slug).toArray();
	
			if (!characters.length) {
				throw new Error('Character not found');
			}
	
			// Rest of the function remains the same...
			const characterId = characters[0].id;
			const existingSecrets = await this.getCharacterSecrets(characterId);
			const salt = crypto.randomUUID();
			const mergedSecrets = {
				...existingSecrets.modelKeys,
				...secrets
			};
			
			const encryptedSecrets = await this.encryptSecrets(mergedSecrets, salt);
	
			await this.sql.exec(`
				INSERT INTO character_secrets (
					character_id,
					salt,
					model_keys
				) VALUES (?, ?, ?)
				ON CONFLICT(character_id) DO UPDATE SET
					salt = EXCLUDED.salt,
					model_keys = EXCLUDED.model_keys
			`, characterId, salt, encryptedSecrets);
	
			return true;
		} catch (error) {
			console.error("Error updating character secrets:", error);
			throw error;
		}
	}	

	async handleCreateMemory(request) {
		try {
			const { sessionId, memory } = await request.json();

			const session = await this.initializeSession(sessionId);
			if (!session?.runtime?.databaseAdapter) {
				throw new Error('Session not initialized');
			}

			await session.runtime.databaseAdapter.createMemory(memory);

			return new Response(JSON.stringify({
				success: true,
				message: 'Memory created'
			}), {
				headers: { 'Content-Type': 'application/json' }
			});
		} catch (error) {
			console.error('Create memory error:', error);
			return new Response(JSON.stringify({
				error: 'Failed to create memory',
				details: error.message
			}), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	}

	async handleGetMemories(request) {
		try {
			const { sessionId, roomId, count, type, unique } = await request.json();

			const session = await this.initializeSession(sessionId);
			if (!session?.runtime?.databaseAdapter) {
				throw new Error('Session not initialized');
			}

			const memories = await session.runtime.databaseAdapter.getMemories({
				roomId,
				count,
				type,
				unique
			});

			return new Response(JSON.stringify(memories), {
				headers: { 'Content-Type': 'application/json' }
			});
		} catch (error) {
			console.error('Get memories error:', error);
			return new Response(JSON.stringify({
				error: 'Failed to get memories',
				details: error.message
			}), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	}

	async handleGetMemoriesByRooms(request) {
		try {
			const { sessionId, agentId, roomIds, count } = await request.json();

			const session = await this.initializeSession(sessionId);
			if (!session?.runtime?.databaseAdapter) {
				throw new Error('Session not initialized');
			}

			const memories = await session.runtime.databaseAdapter.getMemoriesByRoomIds({
				agentId,
				roomIds,
				count
			});

			return new Response(JSON.stringify(memories), {
				headers: { 'Content-Type': 'application/json' }
			});
		} catch (error) {
			console.error('Get memories by rooms error:', error);
			return new Response(JSON.stringify({
				error: 'Failed to get memories by rooms',
				details: error.message
			}), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	}

	async handleInternalTwitterPost(request) {
		try {
			const { userId, characterName, tweet, sessionId, roomId, nonce, character } = await request.json();
			console.log("handle post", userId, characterName, sessionId, roomId, nonce, character, tweet);
			// Get character and verify it exists
			// const character = await this.getCharacter(userId, characterName);
			if (!character) {
				throw new Error('Character not found');
			}
			const updatedCharacter = character;
			// Get the existing session
			const session = await this.initializeSession(sessionId, updatedCharacter);
			if (!session?.runtime) {
				throw new Error('Session not initialized');
			}

			// Get secrets and set credentials
			const secrets = await this.getCharacterSecrets(character.id);
			session.runtime.settings = {
				...session.runtime.settings,
				TWITTER_USERNAME: secrets.modelKeys.twitter_username,
				TWITTER_PASSWORD: secrets.modelKeys.twitter_password,
				TWITTER_EMAIL: secrets.modelKeys.TWITTER_EMAIL,
				TWITTER_COOKIES: secrets.modelKeys.twitter_cookies,
				TWITTER_DRY_RUN: 'false'
			};

			console.log("session twitter post", JSON.stringify(session.runtime.settings));

			// Initialize Twitter client 
			const { TwitterClientInterface } = await import('./twitter-client/index.js');
			const twitterClient = await TwitterClientInterface.start(session.runtime);
			console.log("twitter client", twitterClient);
			console.log("tweet is", tweet);
			// Send tweet
			const result = await twitterClient.sendTweet(tweet);

			// Generate new nonce for next request
			const newNonce = await this.nonceManager.createNonce(roomId, sessionId);

			return new Response(JSON.stringify({
				success: true,
				tweet: result,
				nonce: newNonce.nonce
			}), {
				headers: {
					...CORS_HEADERS,
					'Content-Type': 'application/json'
				}
			});
		} catch (error) {
			console.error('Internal Twitter post error:', error);
			return new Response(JSON.stringify({
				error: error.message
			}), {
				status: error.message.includes('not found') ? 404 : 500,
				headers: {
					...CORS_HEADERS,
					'Content-Type': 'application/json'
				}
			});
		}
	}



	async handleTwitterNotifications(request) {
		try {
			const { userId, characterName, sessionId, roomId, nonce, updatedCharacter } = await request.json();

			// Get character and verify it exists
			const character = await this.getCharacter(userId, characterName);
			if (!character) {
				throw new Error('Character not found');
			}

			// Get the existing session
			const session = await this.initializeSession(sessionId, updatedCharacter);
			if (!session?.runtime) {
				throw new Error('Session not initialized');
			}

			// Get secrets and set credentials
			const secrets = await this.getCharacterSecrets(character.id);
			session.runtime.settings = {
				...session.runtime.settings,
				TWITTER_USERNAME: secrets.modelKeys.twitter_username,
				TWITTER_PASSWORD: secrets.modelKeys.twitter_password,
				TWITTER_EMAIL: secrets.modelKeys.TWITTER_EMAIL,
				TWITTER_COOKIES: secrets.modelKeys.twitter_cookies,
				TWITTER_DRY_RUN: 'true'
			};

			// Initialize Twitter client 
			const { TwitterClientInterface } = await import('./twitter-client/index.js');
			const twitterClient = await TwitterClientInterface.start(session.runtime);

			// Fetch notifications directly using new client
			const notifications = await twitterClient.getNotifications(20);

			// Generate new nonce
			const newNonce = await this.nonceManager.createNonce(roomId, sessionId);

			return new Response(JSON.stringify({
				notifications,
				nonce: newNonce.nonce
			}), {
				headers: {
					...CORS_HEADERS,
					'Content-Type': 'application/json'
				}
			});
		} catch (error) {
			console.error('Twitter notifications error:', error);
			return new Response(JSON.stringify({
				error: error.message
			}), {
				status: error.message.includes('not found') ? 404 : 500,
				headers: { ...CORS_HEADERS }
			});
		}
	}




	async handleTwitterRetweet(request) {
		try {
			const { userId, characterName, tweetId, quoteText } = await request.json();

			// Get character
			const character = await this.getCharacter(userId, characterName);
			if (!character) {
				throw new Error('Character not found');
			}

			// Get secrets and initialize client
			const secrets = await this.getCharacterSecrets(character.id);
			const { TwitterClientInterface } = await import('./twitter-client/index.js');
			const twitterClient = await TwitterClientInterface.start({
				settings: {
					TWITTER_USERNAME: secrets.modelKeys.twitter_username,
					TWITTER_PASSWORD: secrets.modelKeys.twitter_password,
					TWITTER_EMAIL: secrets.modelKeys.TWITTER_EMAIL,
					TWITTER_COOKIES: secrets.modelKeys.twitter_cookies,
					TWITTER_DRY_RUN: 'true'
				}
			});

			const result = await twitterClient.retweet(tweetId, quoteText);

			return new Response(JSON.stringify(result), {
				headers: { ...CORS_HEADERS }
			});
		} catch (error) {
			console.error('Twitter retweet error:', error);
			return new Response(JSON.stringify({
				error: 'Failed to retweet',
				details: error.message
			}), {
				status: 500,
				headers: { ...CORS_HEADERS }
			});
		}
	}


	async handleTwitterReply(request) {
		try {
			const { userId, characterName, tweetId, replyText } = await request.json();

			// Get character
			const character = await this.getCharacter(userId, characterName);
			if (!character) {
				throw new Error('Character not found');
			}

			// Get secrets and initialize client
			const secrets = await this.getCharacterSecrets(character.id);
			const { TwitterClientInterface } = await import('./twitter-client/index.js');
			const twitterClient = await TwitterClientInterface.start({
				settings: {
					TWITTER_USERNAME: secrets.modelKeys.twitter_username,
					TWITTER_PASSWORD: secrets.modelKeys.twitter_password,
					TWITTER_EMAIL: secrets.modelKeys.TWITTER_EMAIL,
					TWITTER_COOKIES: secrets.modelKeys.twitter_cookies,
					TWITTER_DRY_RUN: 'true'
				}
			});

			const result = await twitterClient.reply(tweetId, replyText);

			return new Response(JSON.stringify(result), {
				headers: { ...CORS_HEADERS }
			});
		} catch (error) {
			console.error('Twitter reply error:', error);
			return new Response(JSON.stringify({
				error: 'Failed to send reply',
				details: error.message
			}), {
				status: 500,
				headers: { ...CORS_HEADERS }
			});
		}
	}


	async handleTwitterLike(request) {
		try {
			const { userId, characterName, tweetId } = await request.json();

			// Get character
			const character = await this.getCharacter(userId, characterName);
			if (!character) {
				throw new Error('Character not found');
			}

			// Get secrets and initialize client
			const secrets = await this.getCharacterSecrets(character.id);
			const { TwitterClientInterface } = await import('./twitter-client/index.js');
			const twitterClient = await TwitterClientInterface.start({
				settings: {
					TWITTER_USERNAME: secrets.modelKeys.twitter_username,
					TWITTER_PASSWORD: secrets.modelKeys.twitter_password,
					TWITTER_EMAIL: secrets.modelKeys.TWITTER_EMAIL,
					TWITTER_COOKIES: secrets.modelKeys.twitter_cookies,
					TWITTER_DRY_RUN: 'true'
				}
			});

			const result = await twitterClient.likeTweet(tweetId);

			return new Response(JSON.stringify(result), {
				headers: { ...CORS_HEADERS }
			});
		} catch (error) {
			console.error('Twitter like error:', error);
			return new Response(JSON.stringify({
				error: 'Failed to like tweet',
				details: error.message
			}), {
				status: 500,
				headers: { ...CORS_HEADERS }
			});
		}
	}


	// Helper method to get runtime from token
	async getRuntimeFromToken(token) {
		try {
			// Find session with matching Twitter token
			const sessions = await this.sql.exec(`
			SELECT s.*, c.* 
			FROM character_sessions s
			JOIN characters c ON s.character_id = c.id
			JOIN character_secrets cs ON c.id = cs.character_id
			WHERE cs.model_keys LIKE ?
		  `, `%${token}%`).toArray();

			if (!sessions.length) {
				return null;
			}

			const session = sessions[0];
			const secrets = await this.getCharacterSecrets(session.character_id);

			// Initialize and return runtime
			return await this.initializeRuntime({
				...session,
				settings: {
					...session.settings,
					secrets
				}
			});
		} catch (error) {
			console.error('Error getting runtime from token:', error);
			return null;
		}
	}
	async getSessionFromToken(request) {
		try {
			const token = request.headers.get('Authorization');
			if (!token) return null;

			// Find session with matching Twitter token
			const sessions = await this.sql.exec(`
			SELECT s.*, c.* 
			FROM character_sessions s
			JOIN characters c ON s.character_id = c.id
			JOIN character_secrets cs ON c.id = cs.character_id
			WHERE cs.model_keys LIKE ?
		  `, `%${token}%`).toArray();

			if (!sessions.length) {
				return null;
			}

			const session = sessions[0];

			// Get secrets
			const secrets = await this.getCharacterSecrets(session.character_id);
			if (!secrets?.modelKeys?.twitter_token === token) {
				return null;
			}

			return {
				...session,
				settings: {
					...session.settings,
					secrets
				}
			};
		} catch (error) {
			console.error('Error getting session from token:', error);
			return null;
		}
	}


	async fetch(request) {
		if (request.method === "GET") {
			return new Response("Method not allowed", { status: 405 });
		}

		if (request.method === "POST") {
			const url = new URL(request.url);

			switch (url.pathname) {
				case '/migrate-schema': {
					return await this.handleMigrateSchema();
				}
				case '/send-chat-message': {
					const { sessionId, message, nonce, apiKey } = await request.json();
					console.log("Received message: in fetch:", message);
					if (!sessionId || !message) {
						return new Response(JSON.stringify({
							error: 'Missing required fields'
						}), {
							status: 400,
							headers: { 'Content-Type': 'application/json' }
						});
					}

					try {

						if (!apiKey) {
							const response = await this.handleMessage(sessionId, message, nonce);
							return new Response(JSON.stringify(response), {
								headers: { 'Content-Type': 'application/json' }
							});

						} else {
							const [authType, authToken] = apiKey.split(' ');

							console.log("trying to handle message with auth:", { hasAuth: authToken });
							const response = await this.handleMessage(sessionId, message, nonce, authToken);
							return new Response(JSON.stringify(response), {
								headers: { 'Content-Type': 'application/json' }
							});
						}
					} catch (error) {
						return new Response(JSON.stringify({
							error: 'Message handling failed',
							details: error.message
						}), {
							status: error.message.includes('Invalid or expired nonce') ? 401 : 500,
							headers: { 'Content-Type': 'application/json' }
						});
					}
				}
				case '/send-message': {
					const { sessionId, message, nonce, apiKey } = await request.json();
					console.log("Received message: in fetch:", message);
					if (!sessionId || !message) {
						return new Response(JSON.stringify({
							error: 'Missing required fields'
						}), {
							status: 400,
							headers: { 'Content-Type': 'application/json' }
						});
					}

					try {

						if (!apiKey) {
							const response = await this.handleMessage(sessionId, message, nonce);
							return new Response(JSON.stringify(response), {
								headers: { 'Content-Type': 'application/json' }
							});

						} else {
							const [authType, authToken] = apiKey.split(' ');

							console.log("trying to handle message with auth:", { hasAuth: authToken });
							const response = await this.handleMessage(sessionId, message, nonce, authToken);
							return new Response(JSON.stringify(response), {
								headers: { 'Content-Type': 'application/json' }
							});
						}
					} catch (error) {
						return new Response(JSON.stringify({
							error: 'Message handling failed',
							details: error.message
						}), {
							status: error.message.includes('Invalid or expired nonce') ? 401 : 500,
							headers: { 'Content-Type': 'application/json' }
						});
					}
				}
				case '/create-character': {
					try {
						const { author, character } = await request.json();

						if (!author || !character) {
							return new Response(JSON.stringify({
								error: 'Missing required fields'
							}), {
								status: 400,
								headers: { 'Content-Type': 'application/json' }
							});
						}

						const characterId = await this.createOrUpdateCharacter(author, character);

						return new Response(JSON.stringify({
							success: true,
							characterId,
							message: 'Character created successfully'
						}), {
							headers: { 'Content-Type': 'application/json' }
						});
					} catch (error) {
						console.error('Create character error:', error);
						return new Response(JSON.stringify({
							error: 'Failed to create character',
							details: error.message
						}), {
							status: 500,
							headers: { 'Content-Type': 'application/json' }
						});
					}
				}

				case '/update-character-metadata': {
					const { author, character } = await request.json();
					const characterId = await this.updateCharacterMetadata(author, character);
					return new Response(JSON.stringify({
						success: true,
						characterId,
						message: 'Character metadata updated successfully'
					}), {
						headers: { 'Content-Type': 'application/json' }
					});
				}

				case '/update-character-images': {
					const { author, characterName, updates } = await request.json();
					const result = await this.updateCharacterImages(author, characterName, updates);
					return new Response(JSON.stringify({
						success: true,
						result,
						message: 'Character images updated successfully'
					}), {
						headers: { 'Content-Type': 'application/json' }
					});
				}

				case '/update-character-secrets': {
					const { author, character } = await request.json();
					await this.updateCharacterSecrets(author, character.name, character.settings.secrets);
					return new Response(JSON.stringify({
						success: true,
						message: 'Character secrets updated successfully'
					}), {
						headers: { 'Content-Type': 'application/json' }
					});
				}


				case '/update-character': {
					try {
						const { author, character } = await request.json();

						if (!author || !character) {
							return new Response(JSON.stringify({
								error: 'Missing required fields'
							}), {
								status: 400,
								headers: { 'Content-Type': 'application/json' }
							});
						}

						const characterId = await this.createOrUpdateCharacter(author, character);

						return new Response(JSON.stringify({
							success: true,
							characterId,
							message: 'Character updated successfully'
						}), {
							headers: { 'Content-Type': 'application/json' }
						});
					} catch (error) {
						console.error('Update character error:', error);
						return new Response(JSON.stringify({
							error: 'Failed to update character',
							details: error.message
						}), {
							status: 500,
							headers: { 'Content-Type': 'application/json' }
						});
					}
				}
				case '/get-discord-credentials': {
					try {
						const { characterId, env } = await request.json();

						if (!characterId) {
							return new Response(JSON.stringify({
								error: 'Missing characterId'
							}), {
								status: 400,
								headers: { 'Content-Type': 'application/json' }
							});
						}

						// Use existing secrets infrastructure 
						const secrets = await this.getCharacterSecrets(characterId);
						// Extract just Discord-specific credentials
						const discordCreds = {
							appId: secrets.modelKeys.discord_app_id,
							token: secrets.modelKeys.discord_token,
							publicKey: secrets.modelKeys.discord_public_key,
						};

						return new Response(JSON.stringify(discordCreds), {
							headers: { 'Content-Type': 'application/json' }
						});

					} catch (error) {
						console.error('Error getting Discord credentials:', error);
						return new Response(JSON.stringify({
							error: 'Internal server error',
							details: error.message
						}), {
							status: 500,
							headers: { 'Content-Type': 'application/json' }
						});
					}
				}
				case '/get-twitter-credentials': {
					try {
						const { characterId } = await request.json();

						if (!characterId) {
							return new Response(JSON.stringify({
								error: 'Missing characterId'
							}), {
								status: 400,
								headers: { 'Content-Type': 'application/json' }
							});
						}

						// Use existing secrets infrastructure 
						const secrets = await this.getCharacterSecrets(characterId);
						console.log("secrets are", secrets);
						// Extract just Discord-specific credentials
						const discordCreds = {
							TWITTER_USERNAME: secrets.modelKeys.TWITTER_USERNAME,
							TWITTER_EMAIL: secrets.modelKeys.TWITTER_EMAIL,
							TWITTER_PASSWORD: secrets.modelKeys.TWITTER_PASSWORD,
							twitter_cookies: secrets.modelKeys.twitter_cookies
						};

						return new Response(JSON.stringify(discordCreds), {
							headers: { 'Content-Type': 'application/json' }
						});

					} catch (error) {
						console.error('Error getting twitter credentials:', error);
						return new Response(JSON.stringify({
							error: 'Internal server error',
							details: error.message
						}), {
							status: 500,
							headers: { 'Content-Type': 'application/json' }
						});
					}
				}
				case '/twitter-post': {
					try {
						return await this.handleInternalTwitterPost(request);
					} catch (error) {
						console.error('Twitter notifications handler error:', error);
						return new Response(JSON.stringify({
							error: `Failed to post: ${error.message}`,
							details: error.message
						}), {
							status: 500,
							headers: { 'Content-Type': 'application/json' }
						});
					}
				}

				case '/twitter-notifications': {
					try {
						return await this.handleTwitterNotifications(request);
					} catch (error) {
						console.error('Twitter notifications handler error:', error);
						return new Response(JSON.stringify({
							error: 'Failed to fetch notifications',
							details: error.message
						}), {
							status: 500,
							headers: { 'Content-Type': 'application/json' }
						});
					}
				}

				case '/twitter-retweet': {
					try {
						return await this.handleTwitterRetweet(request);
					} catch (error) {
						console.error('Twitter retweet handler error:', error);
						return new Response(JSON.stringify({
							error: 'Failed to retweet',
							details: error.message
						}), {
							status: 500,
							headers: { 'Content-Type': 'application/json' }
						});
					}
				}

				case '/twitter-reply': {
					try {
						return await this.handleTwitterReply(request);
					} catch (error) {
						console.error('Twitter reply handler error:', error);
						return new Response(JSON.stringify({
							error: 'Failed to send reply',
							details: error.message
						}), {
							status: 500,
							headers: { 'Content-Type': 'application/json' }
						});
					}
				}

				case '/twitter-like': {
					try {
						return await this.handleTwitterLike(request);
					} catch (error) {
						console.error('Twitter like handler error:', error);
						return new Response(JSON.stringify({
							error: 'Failed to like tweet',
							details: error.message
						}), {
							status: 500,
							headers: { 'Content-Type': 'application/json' }
						});
					}
				}

				case '/create-memory': {
					return await this.handleCreateMemory(request);
				}

				case '/get-memories': {
					return await this.handleGetMemories(request);
				}

				case '/get-memories-by-rooms': {
					return await this.handleGetMemoriesByRooms(request);
				}

				case '/delete-character': {
					const { author, name } = await request.json();
					try {
						await this.deleteCharacter(author, name);
						return new Response(JSON.stringify({
							success: true,
							message: 'Character deleted successfully'
						}), {
							headers: { 'Content-Type': 'application/json' }
						});
					} catch (error) {
						console.error('Delete character error:', error);
						return new Response(JSON.stringify({
							error: 'Failed to delete character',
							details: error.message
						}), {
							status: 500,
							headers: { 'Content-Type': 'application/json' }
						});
					}
				}
				case '/get-character': {
					try {
						const { author, name } = await request.json();
						// Get character config
						console.log('Getting character:', author, name);

						const character = await this.getCharacter(author, name);

						if (!character) {
							return new Response(JSON.stringify({ error: 'Character not found' }), {
								status: 404,
								headers: { 'Content-Type': 'application/json' }
							});
						}

						return new Response(JSON.stringify(character), {
							headers: { 'Content-Type': 'application/json' }
						});
					} catch (error) {
						console.error('Get character error:', error);
						return new Response(JSON.stringify({
							error: 'Internal server error',
							details: error.message
						}), {
							status: 500,
							headers: { 'Content-Type': 'application/json' }
						});
					}
				}
				case '/get-featured-characters': {
					try {
						const { authors } = await request.json();
						const characters = await this.getFeaturedCharacters(authors);
						return new Response(JSON.stringify(characters), {
							headers: { 'Content-Type': 'application/json' }
						});
					} catch (error) {
						console.error('Get featured characters error:', error);
						return new Response(JSON.stringify({
							error: 'Internal server error',
							details: error.message
						}), {
							status: 500,
							headers: { 'Content-Type': 'application/json' }
						});
					}
				}
				case '/get-author-characters': {
					const { author } = await request.json();
					const characters = await this.getCharactersByAuthor(author);
					return new Response(JSON.stringify(characters), {
						headers: { 'Content-Type': 'application/json' }
					});
				}
				case '/initialize-session': {
					const { author, slug, personality, roomId } = await request.json();

					if (!author || !slug || !roomId) {
						return new Response(JSON.stringify({
							error: 'Missing required fields'
						}), {
							status: 400,
							headers: { 'Content-Type': 'application/json' }
						});
					}

					try {
						const session = await this.initializeCharacterRoom(author, slug, roomId);
						return new Response(JSON.stringify(session), {
							headers: { 'Content-Type': 'application/json' }
						});
					} catch (error) {
						console.error('Init Char Room Failure Session initialization error:', error);
						return new Response(JSON.stringify({
							error: 'Failed to initialize session',
							details: error.message
						}), {
							status: 500,
							headers: { 'Content-Type': 'application/json' }
						});
					}
				}
				default:
					return new Response('Not found', { status: 404 });
			}
		}

		return new Response('Method not allowed', { status: 405 });
	}
}