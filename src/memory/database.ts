import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { config } from "../config";
import { logger } from "../utils/logger";

let db: Database.Database;

export function getDatabase(): Database.Database {
  if (db) return db;

  const dataDir = path.resolve(config.dataDir);
  fs.mkdirSync(dataDir, { recursive: true });

  const dbPath = path.join(dataDir, "npbot.db");
  db = new Database(dbPath);

  // Enable WAL mode for better concurrent read performance
  db.pragma("journal_mode = WAL");

  initializeSchema(db);
  logger.info({ dbPath }, "Database initialized");

  return db;
}

function initializeSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      user_id TEXT,
      user_name TEXT,
      timestamp TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_conversations_conv_id
      ON conversations(conversation_id);

    CREATE INDEX IF NOT EXISTS idx_conversations_user_id
      ON conversations(user_id);

    CREATE INDEX IF NOT EXISTS idx_conversations_user_timestamp
      ON conversations(user_id, timestamp);

    CREATE INDEX IF NOT EXISTS idx_conversations_timestamp
      ON conversations(conversation_id, timestamp);

    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_memories_user
      ON memories(user_id);

    CREATE TABLE IF NOT EXISTS skill_state (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skill_name TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(skill_name, key)
    );
  `);
}

export function closeDatabase(): void {
  if (db) {
    db.close();
  }
}
