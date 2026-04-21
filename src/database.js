'use strict';

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'comics.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS comics (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT    NOT NULL,
      series      TEXT,
      issue_number TEXT,
      publisher   TEXT,
      year        INTEGER,
      status      TEXT    NOT NULL DEFAULT 'unread'
                          CHECK(status IN ('unread','reading','read')),
      cover_url   TEXT,
      notes       TEXT,
      created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    );

    CREATE TRIGGER IF NOT EXISTS comics_updated_at
    AFTER UPDATE ON comics
    BEGIN
      UPDATE comics SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
      WHERE id = NEW.id;
    END;
  `);
}

// ── CRUD helpers ──────────────────────────────────────────────────────────────

function listComics({ search, status, publisher, series } = {}) {
  const db = getDb();
  let sql = 'SELECT * FROM comics WHERE 1=1';
  const params = [];

  if (search) {
    sql += ' AND (title LIKE ? OR series LIKE ? OR notes LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (publisher) {
    sql += ' AND publisher = ?';
    params.push(publisher);
  }
  if (series) {
    sql += ' AND series = ?';
    params.push(series);
  }

  sql += ' ORDER BY series, CAST(issue_number AS REAL), title';
  return db.prepare(sql).all(...params);
}

function getComic(id) {
  return getDb().prepare('SELECT * FROM comics WHERE id = ?').get(id);
}

function createComic(data) {
  const { title, series, issue_number, publisher, year, status, cover_url, notes } = data;
  const result = getDb()
    .prepare(
      `INSERT INTO comics (title, series, issue_number, publisher, year, status, cover_url, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      title,
      series || null,
      issue_number || null,
      publisher || null,
      year || null,
      status || 'unread',
      cover_url || null,
      notes || null
    );
  return getComic(result.lastInsertRowid);
}

function updateComic(id, data) {
  const current = getComic(id);
  if (!current) return null;

  const merged = { ...current, ...data };
  getDb()
    .prepare(
      `UPDATE comics
          SET title = ?, series = ?, issue_number = ?, publisher = ?,
              year = ?, status = ?, cover_url = ?, notes = ?
        WHERE id = ?`
    )
    .run(
      merged.title,
      merged.series || null,
      merged.issue_number || null,
      merged.publisher || null,
      merged.year || null,
      merged.status,
      merged.cover_url || null,
      merged.notes || null,
      id
    );
  return getComic(id);
}

function deleteComic(id) {
  const result = getDb().prepare('DELETE FROM comics WHERE id = ?').run(id);
  return result.changes > 0;
}

function getStats() {
  const db = getDb();
  const total     = db.prepare("SELECT COUNT(*) as n FROM comics").get().n;
  const read      = db.prepare("SELECT COUNT(*) as n FROM comics WHERE status='read'").get().n;
  const reading   = db.prepare("SELECT COUNT(*) as n FROM comics WHERE status='reading'").get().n;
  const unread    = db.prepare("SELECT COUNT(*) as n FROM comics WHERE status='unread'").get().n;
  const publishers = db.prepare(
    "SELECT DISTINCT publisher FROM comics WHERE publisher IS NOT NULL ORDER BY publisher"
  ).all().map(r => r.publisher);
  const series = db.prepare(
    "SELECT DISTINCT series FROM comics WHERE series IS NOT NULL ORDER BY series"
  ).all().map(r => r.series);
  return { total, read, reading, unread, publishers, series };
}

// Allow tests to inject a custom db path / reset
function _reset(customPath) {
  if (db) {
    db.close();
    db = null;
  }
  if (customPath !== undefined) {
    process.env.DB_PATH = customPath;
  }
}

module.exports = { getDb, listComics, getComic, createComic, updateComic, deleteComic, getStats, _reset };
