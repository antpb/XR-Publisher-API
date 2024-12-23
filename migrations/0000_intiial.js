export default {
    async migrate(db, before) {
      if (!before) {
        await db.prepare(
          "CREATE TABLE IF NOT EXISTS discord_state (key TEXT PRIMARY KEY, value TEXT)"
        ).run();
      }
    }
  }