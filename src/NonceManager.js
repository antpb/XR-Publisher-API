export class NonceManager {
    constructor(sql) {
        this.sql = sql;
    }

    async createNonce(roomId, sessionId, expiresInSeconds = 300) {
        const nonce = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + (expiresInSeconds * 1000));

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