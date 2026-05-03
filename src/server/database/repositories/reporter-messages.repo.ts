import { randomUUID } from 'crypto';
import { getDb } from '../database.js';
import type { ReporterMessage } from '@shared/types';
import type { IReporterMessagesRepository } from './interfaces.js';

// Database Row Types

interface ReporterMessageRow {
  id: string;
  report_id: string;
  user_id: string;
  user_name: string | null;
  message: string;
  sent_at: string;
  created_at: string;
}

// Row Mapping

function mapRowToMessage(row: ReporterMessageRow): ReporterMessage {
  return {
    id: row.id,
    reportId: row.report_id,
    userId: row.user_id,
    userName: row.user_name ?? undefined,
    message: row.message,
    sentAt: row.sent_at,
    createdAt: row.created_at,
  };
}

// Repository

export const reporterMessagesRepo: IReporterMessagesRepository = {
  async create(reportId: string, userId: string, message: string): Promise<ReporterMessage> {
    const db = getDb();
    const id = randomUUID();
    const now = new Date().toISOString();

    db.run(
      `INSERT INTO reporter_messages (id, report_id, user_id, message, sent_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, reportId, userId, message, now, now]
    );

    const row = db
      .query(
        `SELECT rm.*, u.name as user_name
         FROM reporter_messages rm
         JOIN users u ON u.id = rm.user_id
         WHERE rm.id = ?`
      )
      .get(id) as ReporterMessageRow;

    return mapRowToMessage(row);
  },

  async findByReportId(reportId: string): Promise<ReporterMessage[]> {
    const db = getDb();
    const rows = db
      .query(
        `SELECT rm.*, u.name as user_name
         FROM reporter_messages rm
         JOIN users u ON u.id = rm.user_id
         WHERE rm.report_id = ?
         ORDER BY rm.created_at ASC`
      )
      .all(reportId) as ReporterMessageRow[];

    return rows.map(mapRowToMessage);
  },

  async findLatestByReportId(reportId: string): Promise<ReporterMessage | null> {
    const db = getDb();
    const row = db
      .query(
        `SELECT rm.*, u.name as user_name
         FROM reporter_messages rm
         JOIN users u ON u.id = rm.user_id
         WHERE rm.report_id = ?
         ORDER BY rm.created_at DESC
         LIMIT 1`
      )
      .get(reportId) as ReporterMessageRow | null;

    return row ? mapRowToMessage(row) : null;
  },
};
