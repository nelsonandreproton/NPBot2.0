import { getDatabase } from "./database";
import { StoredMessage } from "../agent/types";

export class ConversationStore {
  addMessage(conversationId: string, message: StoredMessage): void {
    const db = getDatabase();
    db.prepare(
      `INSERT INTO conversations (conversation_id, role, content, user_id, user_name, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      conversationId,
      message.role,
      message.content,
      message.userId ?? null,
      message.userName ?? null,
      message.timestamp,
    );
  }

  /**
   * Get conversation history scoped to a specific user.
   * Each user has their own session history, even in shared channels.
   */
  getUserHistory(userId: string, limit: number = 20): StoredMessage[] {
    const db = getDatabase();
    const rows = db
      .prepare(
        `SELECT role, content, user_id, user_name, timestamp, conversation_id
         FROM conversations
         WHERE user_id = ? OR (role = 'assistant' AND conversation_id IN (
           SELECT DISTINCT conversation_id FROM conversations WHERE user_id = ?
         ))
         ORDER BY id DESC
         LIMIT ?`,
      )
      .all(userId, userId, limit) as any[];

    return rows.reverse().map((row) => ({
      role: row.role,
      content: row.content,
      userId: row.user_id ?? undefined,
      userName: row.user_name ?? undefined,
      timestamp: row.timestamp,
    }));
  }

  /**
   * Get history for a specific conversation (e.g. for channel context).
   */
  getHistory(conversationId: string, limit: number = 20): StoredMessage[] {
    const db = getDatabase();
    const rows = db
      .prepare(
        `SELECT role, content, user_id, user_name, timestamp
         FROM conversations
         WHERE conversation_id = ?
         ORDER BY id DESC
         LIMIT ?`,
      )
      .all(conversationId, limit) as any[];

    return rows.reverse().map((row) => ({
      role: row.role,
      content: row.content,
      userId: row.user_id ?? undefined,
      userName: row.user_name ?? undefined,
      timestamp: row.timestamp,
    }));
  }

  clearConversation(conversationId: string): void {
    const db = getDatabase();
    db.prepare("DELETE FROM conversations WHERE conversation_id = ?").run(
      conversationId,
    );
  }

  clearUserHistory(userId: string): void {
    const db = getDatabase();
    db.prepare("DELETE FROM conversations WHERE user_id = ?").run(userId);
  }

  getConversationCount(conversationId: string): number {
    const db = getDatabase();
    const row = db
      .prepare(
        "SELECT COUNT(*) as count FROM conversations WHERE conversation_id = ?",
      )
      .get(conversationId) as any;
    return row?.count ?? 0;
  }
}
