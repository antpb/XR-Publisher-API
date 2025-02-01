export class DatabaseMigrationManager {
    constructor(sql) {
        this.sql = sql;
    }

    async migrateWalletSchema() {
        try {
            await this.sql.exec('PRAGMA foreign_keys = OFF;');

            await this.sql.exec(`
                CREATE TABLE IF NOT EXISTS character_wallets (
                    character_id INTEGER,
                    chain TEXT,
                    address TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (character_id, chain),
                    FOREIGN KEY(character_id) REFERENCES characters(id)
                )
            `);

            await this.sql.exec(`
                CREATE INDEX IF NOT EXISTS idx_character_wallets 
                ON character_wallets(character_id)
            `);

            await this.sql.exec('PRAGMA foreign_keys = ON;');
            return true;
        } catch (error) {
            console.error('Error in wallet schema migration:', error);
            await this.sql.exec('PRAGMA foreign_keys = ON;');
            throw error;
        }
    }

    async migrateMemorySchema() {
        try {
            await this.sql.exec('PRAGMA foreign_keys = OFF;');

            await this.sql.exec(`
                CREATE TABLE IF NOT EXISTS memories_new (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    content TEXT NOT NULL,
                    embedding BLOB,
                    userId TEXT,
                    userName TEXT,
                    roomId TEXT NOT NULL,
                    agentId TEXT NOT NULL,
                    isUnique INTEGER DEFAULT 0,
                    createdAt INTEGER NOT NULL,
                    importance_score FLOAT DEFAULT 0,
                    access_count INTEGER DEFAULT 0,
                    last_accessed TIMESTAMP,
                    metadata TEXT
                )
            `);

            const memoryTableExists = await this.sql.exec(`
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='memories'
            `).toArray();

            if (memoryTableExists.length > 0) {
                await this.sql.exec(`
                    INSERT INTO memories_new 
                    SELECT 
                        id,
                        type,
                        content,
                        embedding,
                        userId,
                        userId,
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

            await this.sql.exec('ALTER TABLE memories_new RENAME TO memories;');

            await this.sql.exec(`
                CREATE INDEX IF NOT EXISTS idx_memories_room ON memories(roomId, createdAt);
                CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(userId);
                CREATE INDEX IF NOT EXISTS idx_memories_username ON memories(userName);
                CREATE INDEX IF NOT EXISTS idx_memories_agent ON memories(agentId);
                CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance_score);
                CREATE INDEX IF NOT EXISTS idx_memories_access ON memories(access_count, last_accessed);
            `);

            await this.sql.exec('PRAGMA foreign_keys = ON;');
            return true;
        } catch (error) {
            console.error('Error in memory schema migration:', error);
            await this.sql.exec('PRAGMA foreign_keys = ON;');
            throw error;
        }
    }

    async migrateStatusField() {
        try {
            await this.sql.exec('PRAGMA foreign_keys = OFF;');

            const tableInfo = await this.sql.exec('PRAGMA table_info(characters)').toArray();
            const columns = tableInfo.map(col => col.name);

            if (!columns.includes('status')) {
                await this.sql.exec('ALTER TABLE characters ADD COLUMN status TEXT DEFAULT "private"');
                await this.sql.exec('UPDATE characters SET status = "private" WHERE status IS NULL');
            }

            await this.sql.exec('PRAGMA foreign_keys = ON;');
            return true;
        } catch (error) {
            console.error('Error in status field migration:', error);
            await this.sql.exec('PRAGMA foreign_keys = ON;');
            throw error;
        }
    }

    async migrateImageFields() {
        try {
            await this.sql.exec('PRAGMA foreign_keys = OFF;');

            const tableInfo = await this.sql.exec('PRAGMA table_info(characters)').toArray();
            const columns = tableInfo.map(col => col.name);

            if (!columns.includes('profile_img')) {
                await this.sql.exec('ALTER TABLE characters ADD COLUMN profile_img TEXT');
            }

            if (!columns.includes('banner_img')) {
                await this.sql.exec('ALTER TABLE characters ADD COLUMN banner_img TEXT');
            }

            await this.sql.exec('PRAGMA foreign_keys = ON;');
            return true;
        } catch (error) {
            console.error('Error in image fields migration:', error);
            await this.sql.exec('PRAGMA foreign_keys = ON;');
            throw error;
        }
    }

    async addRoomSupport() {
        try {
            await this.sql.exec('PRAGMA foreign_keys = OFF;');

            const tables = await this.sql.exec(`SELECT name FROM sqlite_master WHERE type='table'`).toArray();

            // Room table migration logic
            const roomsExists = tables.find(t => t.name === 'rooms');
            if (roomsExists) {
                const roomsColumns = await this.sql.exec('PRAGMA table_info(rooms)').toArray();
                if (!roomsColumns.find(c => c.name === 'character_id')) {
                    await this.sql.exec(`ALTER TABLE rooms ADD COLUMN character_id INTEGER`);
                }
                if (!roomsColumns.find(c => c.name === 'current_session_id')) {
                    await this.sql.exec(`ALTER TABLE rooms ADD COLUMN current_session_id TEXT`);
                }
            } else {
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

            // Add indexes and update existing data
            await this.sql.exec(`
                CREATE INDEX IF NOT EXISTS idx_rooms_character ON rooms(character_id);
                CREATE INDEX IF NOT EXISTS idx_sessions_room ON character_sessions(room_id);
                CREATE INDEX IF NOT EXISTS idx_nonces_room ON session_nonces(room_id)
            `);

            await this.sql.exec('PRAGMA foreign_keys = ON;');
            return true;
        } catch (error) {
            console.error('Error in room support migration:', error);
            await this.sql.exec('PRAGMA foreign_keys = ON;');
            throw error;
        }
    }

    async migrateAssetSchema() {
        try {
            await this.sql.exec('PRAGMA foreign_keys = OFF;');

            // Create character_assets table
            await this.sql.exec(`
                CREATE TABLE IF NOT EXISTS character_assets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    character_id INTEGER NOT NULL,
                    filename TEXT NOT NULL,
                    original_filename TEXT NOT NULL,
                    filesize INTEGER NOT NULL,
                    file_type TEXT NOT NULL,
                    file_url TEXT NOT NULL,
                    thumb_url TEXT,
                    tags TEXT,
                    categories TEXT,
                    metadata TEXT,
                    background TEXT,
                    status TEXT DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(character_id) REFERENCES characters(id),
                    UNIQUE(character_id, filename)
                )
            `);

            // Create character_asset_chunks table for handling chunked uploads
            await this.sql.exec(`
                CREATE TABLE IF NOT EXISTS character_asset_chunks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    character_id INTEGER NOT NULL,
                    upload_id TEXT NOT NULL,
                    chunk_number INTEGER NOT NULL,
                    total_chunks INTEGER NOT NULL,
                    chunk_data BLOB NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(character_id) REFERENCES characters(id),
                    UNIQUE(upload_id, chunk_number)
                )
            `);

            // Create indexes
            await this.sql.exec(`
                CREATE INDEX IF NOT EXISTS idx_assets_character ON character_assets(character_id);
                CREATE INDEX IF NOT EXISTS idx_assets_status ON character_assets(status);
                CREATE INDEX IF NOT EXISTS idx_assets_type ON character_assets(file_type);
                CREATE INDEX IF NOT EXISTS idx_asset_chunks_upload ON character_asset_chunks(upload_id);
            `);

            await this.sql.exec('PRAGMA foreign_keys = ON;');
            return true;
        } catch (error) {
            console.error('Error in asset schema migration:', error);
            await this.sql.exec('PRAGMA foreign_keys = ON;');
            throw error;
        }
    }
} 