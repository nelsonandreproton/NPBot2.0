import { getDatabase } from "./database";
import { logger } from "../utils/logger";

export class LongTermMemory {
  store(userId: string, content: string, category: string = "general"): void {
    const db = getDatabase();
    db.prepare(
      "INSERT INTO memories (user_id, content, category) VALUES (?, ?, ?)",
    ).run(userId, content, category);
    logger.debug({ userId, category }, "Memory stored");
  }

  recall(userId: string, query: string, limit: number = 5): string[] {
    const db = getDatabase();

    // Simple keyword-based recall — search memories containing words from the query
    // For a production system, you'd use embeddings + vector search
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);

    if (keywords.length === 0) {
      // Return most recent memories
      const rows = db
        .prepare(
          "SELECT content FROM memories WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
        )
        .all(userId, limit) as any[];
      return rows.map((r) => r.content);
    }

    // Search for memories matching any keyword
    const conditions = keywords.map(() => "content LIKE ?").join(" OR ");
    const params = keywords.map((k) => `%${k}%`);

    const rows = db
      .prepare(
        `SELECT content FROM memories
         WHERE user_id = ? AND (${conditions})
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(userId, ...params, limit) as any[];

    return rows.map((r) => r.content);
  }

  extractAndStore(
    userId: string,
    userMessage: string,
    assistantResponse: string,
  ): void {
    // Simple heuristic: store facts the user shares about themselves
    const triggers = [
      /my name is (.+)/i,
      /i work (?:at|for|in) (.+)/i,
      /i prefer (.+)/i,
      /i(?:'m| am) (.+)/i,
      /remember that (.+)/i,
      /please remember (.+)/i,
      /note that (.+)/i,
    ];

    for (const pattern of triggers) {
      const match = userMessage.match(pattern);
      if (match) {
        this.store(userId, userMessage, "user_fact");
        return; // One memory per message is enough
      }
    }
  }

  getAll(userId: string): string[] {
    const db = getDatabase();
    const rows = db
      .prepare(
        "SELECT content FROM memories WHERE user_id = ? ORDER BY created_at DESC",
      )
      .all(userId) as any[];
    return rows.map((r) => r.content);
  }

  delete(userId: string, memoryId: number): void {
    const db = getDatabase();
    db.prepare("DELETE FROM memories WHERE id = ? AND user_id = ?").run(
      memoryId,
      userId,
    );
  }

  clear(userId: string): void {
    const db = getDatabase();
    db.prepare("DELETE FROM memories WHERE user_id = ?").run(userId);
  }
}
