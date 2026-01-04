import Database, { type Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'wld.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize database connection
const db: DatabaseType = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

// Initialize schema
function initializeSchema(): void {
  // Spells table
  db.exec(`
    CREATE TABLE IF NOT EXISTS spells (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      level INTEGER NOT NULL,
      school TEXT NOT NULL,
      casting_time TEXT,
      range TEXT,
      components TEXT,
      duration TEXT,
      classes TEXT,
      description TEXT,
      higher_levels TEXT,
      source TEXT DEFAULT 'SRD 5.2'
    );
  `);

  // Monsters table
  db.exec(`
    CREATE TABLE IF NOT EXISTS monsters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      cr TEXT NOT NULL,
      cr_numeric REAL,
      type TEXT NOT NULL,
      size TEXT,
      alignment TEXT,
      ac INTEGER,
      hp INTEGER,
      speed TEXT,
      abilities TEXT,
      skills TEXT,
      senses TEXT,
      languages TEXT,
      traits TEXT,
      actions TEXT,
      legendary_actions TEXT,
      source TEXT DEFAULT 'SRD 5.2'
    );
  `);

  // Equipment table
  db.exec(`
    CREATE TABLE IF NOT EXISTS equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      subcategory TEXT,
      cost TEXT,
      weight TEXT,
      damage TEXT,
      damage_type TEXT,
      properties TEXT,
      ac_bonus INTEGER,
      stealth_disadvantage INTEGER,
      description TEXT,
      source TEXT DEFAULT 'SRD 5.2'
    );
  `);

  // Rooms table (World's Largest Dungeon specific)
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT NOT NULL UNIQUE,
      region TEXT NOT NULL,
      name TEXT,
      description TEXT,
      dimensions TEXT,
      features TEXT,
      monsters TEXT,
      treasure TEXT,
      traps TEXT,
      notes TEXT
    );
  `);

  // Create indexes for common queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_spells_level ON spells(level);
    CREATE INDEX IF NOT EXISTS idx_spells_school ON spells(school);
    CREATE INDEX IF NOT EXISTS idx_monsters_cr ON monsters(cr_numeric);
    CREATE INDEX IF NOT EXISTS idx_monsters_type ON monsters(type);
    CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category);
    CREATE INDEX IF NOT EXISTS idx_rooms_region ON rooms(region);
  `);

  console.log('Database schema initialized successfully');
}

// Get table counts for health check
interface TableCounts {
  spells: number;
  monsters: number;
  equipment: number;
  rooms: number;
}

function getTableCounts(): TableCounts {
  const spells = db.prepare('SELECT COUNT(*) as count FROM spells').get() as { count: number };
  const monsters = db.prepare('SELECT COUNT(*) as count FROM monsters').get() as { count: number };
  const equipment = db.prepare('SELECT COUNT(*) as count FROM equipment').get() as { count: number };
  const rooms = db.prepare('SELECT COUNT(*) as count FROM rooms').get() as { count: number };

  return {
    spells: spells.count,
    monsters: monsters.count,
    equipment: equipment.count,
    rooms: rooms.count,
  };
}

// Initialize schema on import
initializeSchema();

export { db, getTableCounts };
export type { TableCounts };
