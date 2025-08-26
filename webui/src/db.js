// webui/src/db.js
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1) Your *intended* DB in project root (../rfid_gate.sqlite3 from webui/src)
const intendedDbPath = path.resolve(__dirname, '..', '..', 'rfid_gate.sqlite3');

// 2) Fallback DB inside webui/data (almost always writable)
const fallbackDbPath = path.resolve(__dirname, '..', 'data', 'app.sqlite3');

function parentDir(p) {
    return path.dirname(p);
}

function isWritable(p) {
    try {
        fs.accessSync(p, fs.constants.W_OK);
        return true;
    } catch {
        return false;
    }
}

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function openWritableDb(preferredPath, backupPath) {
    // Ensure parent dirs exist
    ensureDir(parentDir(preferredPath));
    ensureDir(parentDir(backupPath));

    // If the file exists, check the FILE writability; otherwise check the DIR writability
    const preferredExists = fs.existsSync(preferredPath);
    const preferredCheck = preferredExists ? preferredPath : parentDir(preferredPath);

    if (isWritable(preferredCheck)) {
        // Great—use intended DB
        return { db: new Database(preferredPath), path: preferredPath, mode: 'preferred' };
    }

    // Try fallback
    const backupExists = fs.existsSync(backupPath);
    const backupCheck = backupExists ? backupPath : parentDir(backupPath);

    if (!isWritable(backupCheck)) {
        // Nothing writable—surface a clear error
        throw new Error(
            `Neither DB nor fallback are writable.
Preferred: ${preferredCheck}
Fallback:  ${backupCheck}`
        );
    }

    // If intended DB exists but is read-only, copy it once into the fallback
    if (preferredExists && !backupExists) {
        fs.copyFileSync(preferredPath, backupPath);
    }

    return { db: new Database(backupPath), path: backupPath, mode: 'fallback' };
}

let dbInfo;
try {
    dbInfo = openWritableDb(intendedDbPath, fallbackDbPath);
    console.log(`[sqlite] Using ${dbInfo.mode === 'preferred' ? 'intended' : 'fallback'} DB at: ${dbInfo.path}`);
} catch (e) {
    console.error('[sqlite] Failed to acquire a writable database:', e.message);
    process.exit(1);
}

const db = dbInfo.db;

// Pragmas for small web apps
db.pragma('journal_mode = WAL');     // allows concurrent readers
db.pragma('synchronous = NORMAL');   // performance vs durability balance
db.pragma('busy_timeout = 3000');    // wait a bit if locked
db.pragma('foreign_keys = ON');      // enforce FK constraints

// Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS cards (
    uid TEXT PRIMARY KEY,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS scans (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    uid  TEXT NOT NULL,
    ts   TEXT  DEFAULT (datetime('now','localtime')),
    FOREIGN KEY(uid) REFERENCES cards(uid)
  );
`);

// Seed (only if there are no *cards* yet)
const cardsCount = db.prepare('SELECT COUNT(*) AS c FROM cards').get().c;
if (cardsCount === 0) {
    try {
        db.prepare('INSERT INTO cards (uid) VALUES (?)').run('9A F2 A1 9E');
        console.log('[sqlite] Seeded one card (uid: 9A F2 A1 9E)');
    } catch (e) {
        // Ignore duplicates if another process seeded first
        if (e.code !== 'SQLITE_CONSTRAINT_UNIQUE' && e.code !== 'SQLITE_CONSTRAINT_PRIMARYKEY') {
            throw e;
        }
    }
}

export default db;
