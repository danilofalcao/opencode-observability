import { Database } from "bun:sqlite";
import type { EventRecord, FilterOptions } from "./types";

const DB_PATH = process.env.DB_PATH || "./data/events.db";

export class DatabaseManager {
  private db: Database;

  constructor() {
    this.db = new Database(DB_PATH);
    this.init();
  }

  private init() {
    this.db.exec("PRAGMA journal_mode = WAL;");
    
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        source_app TEXT NOT NULL,
        session_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        tool_name TEXT,
        tool_input TEXT,
        tool_output TEXT,
        summary TEXT,
        chat_transcript TEXT,
        payload TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
      CREATE INDEX IF NOT EXISTS idx_events_source ON events(source_app);
      CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
      CREATE INDEX IF NOT EXISTS idx_events_composite ON events(source_app, session_id, timestamp);
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        source_app TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        status TEXT DEFAULT 'active',
        event_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  insertEvent(event: EventRecord): number {
    const stmt = this.db.prepare(`
      INSERT INTO events (timestamp, source_app, session_id, event_type, tool_name, tool_input, tool_output, summary, chat_transcript, payload)
      VALUES ($timestamp, $sourceApp, $sessionId, $eventType, $toolName, $toolInput, $toolOutput, $summary, $chatTranscript, $payload)
    `);

    const result = stmt.run({
      $timestamp: event.timestamp,
      $sourceApp: event.sourceApp,
      $sessionId: event.sessionId,
      $eventType: event.eventType,
      $toolName: event.toolName || null,
      $toolInput: event.toolInput ? JSON.stringify(event.toolInput) : null,
      $toolOutput: event.toolOutput ? JSON.stringify(event.toolOutput) : null,
      $summary: event.summary || null,
      $chatTranscript: event.chatTranscript ? JSON.stringify(event.chatTranscript) : null,
      $payload: event.payload ? JSON.stringify(event.payload) : null,
    });

    this.updateSessionEventCount(event.sessionId);

    return result.lastInsertRowid as number;
  }

  private updateSessionEventCount(sessionId: string) {
    const stmt = this.db.prepare(`
      INSERT INTO sessions (session_id, source_app, start_time, status)
      VALUES ($sessionId, 'unknown', $timestamp, 'active')
      ON CONFLICT(session_id) DO UPDATE SET
        event_count = event_count + 1,
        status = CASE WHEN end_time IS NOT NULL THEN 'completed' ELSE 'active' END
    `);
    stmt.run({ $sessionId: sessionId, $timestamp: Date.now() });
  }

  getRecentEvents(limit: number = 100, offset: number = 0, filters?: FilterOptions): EventRecord[] {
    let query = `
      SELECT * FROM events
      WHERE 1=1
    `;
    const params: any = { $limit: limit, $offset: offset };

    if (filters?.sourceApp) {
      query += ` AND source_app = $sourceApp`;
      params.$sourceApp = filters.sourceApp;
    }
    if (filters?.sessionId) {
      query += ` AND session_id = $sessionId`;
      params.$sessionId = filters.sessionId;
    }
    if (filters?.eventTypes && filters.eventTypes.length > 0) {
      query += ` AND event_type IN (${filters.eventTypes.map((_, i) => `$type${i}`).join(',')})`;
      filters.eventTypes.forEach((type, i) => {
        params[`$type${i}`] = type;
      });
    }

    query += ` ORDER BY timestamp DESC LIMIT $limit OFFSET $offset`;

    const stmt = this.db.prepare(query);
    const rows = stmt.all(params) as any[];

    return rows.map(this.rowToEvent);
  }

  getFilterOptions(): FilterOptions {
    const sourceApps = this.db.prepare("SELECT DISTINCT source_app FROM events ORDER BY source_app").all() as { source_app: string }[];
    const sessionIds = this.db.prepare("SELECT DISTINCT session_id FROM events ORDER BY session_id").all() as { session_id: string }[];
    const eventTypes = this.db.prepare("SELECT DISTINCT event_type FROM events ORDER BY event_type").all() as { event_type: string }[];

    return {
      sourceApps: sourceApps.map(r => r.source_app),
      sessionIds: sessionIds.map(r => r.session_id),
      eventTypes: eventTypes.map(r => r.event_type),
    };
  }

  updateSummary(eventId: number, summary: string) {
    const stmt = this.db.prepare("UPDATE events SET summary = $summary WHERE id = $id");
    stmt.run({ $id: eventId, $summary: summary });
  }

  getEventsNeedingSummary(limit: number = 50): EventRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM events 
      WHERE summary IS NULL 
      ORDER BY timestamp DESC 
      LIMIT $limit
    `);
    const rows = stmt.all({ $limit: limit }) as any[];
    return rows.map(this.rowToEvent);
  }

  private rowToEvent(row: any): EventRecord {
    return {
      id: row.id,
      timestamp: row.timestamp,
      sourceApp: row.source_app,
      sessionId: row.session_id,
      eventType: row.event_type,
      toolName: row.tool_name,
      toolInput: row.tool_input ? JSON.parse(row.tool_input) : undefined,
      toolOutput: row.tool_output ? JSON.parse(row.tool_output) : undefined,
      summary: row.summary,
      chatTranscript: row.chat_transcript ? JSON.parse(row.chat_transcript) : undefined,
      payload: row.payload ? JSON.parse(row.payload) : undefined,
    };
  }

  getActiveSessions(): { sessionId: string; sourceApp: string; eventCount: number; startTime: number }[] {
    const stmt = this.db.prepare(`
      SELECT session_id, source_app, event_count, start_time
      FROM sessions
      WHERE status = 'active'
      ORDER BY start_time DESC
    `);
    return stmt.all() as any[];
  }

  close() {
    this.db.close();
  }
}