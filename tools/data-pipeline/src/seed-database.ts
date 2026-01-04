/**
 * Seed Database Script
 * 
 * Main entry point for populating the SQLite database with parsed data
 * from SRD 5.2 and World's Largest Dungeon markdown files.
 * 
 * Usage: npm run seed
 */

import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { glob } from 'glob';
import fs from 'fs';
import path from 'path';

import { parseSpells, type ParsedSpell } from './parsers/spell-parser.js';
import { parseMonsters, type ParsedMonster } from './parsers/monster-parser.js';
import { parseEquipment, type ParsedEquipment } from './parsers/equipment-parser.js';
import { parseRooms, type ParsedRoom } from './parsers/room-parser.js';

// Configuration
const PROJECT_ROOT = path.resolve(process.cwd(), '../..');
const RESOURCES_DIR = path.join(PROJECT_ROOT, 'Resources/markdown');
const SRD_DIR = path.join(RESOURCES_DIR, 'SRD 5.2');
const WLD_DIR = path.join(RESOURCES_DIR, "World's Largest Dungeon");
const DB_PATH = path.join(PROJECT_ROOT, 'services/sqlite-server/data/wld.db');

// File patterns
const SPELL_FILES = [
  '07-Spells.md',
  '07a-Spells-Part1.md',
  '07b-Spells-Part2.md',
  '07c-Spells-Part3.md',
  '07d-Spells-Part4.md',
  '07e-Spells-Part5.md',
  '07f-Spells-Part6.md',
  '07g-Spells-Part7.md',
  '07h-Spells-Part8.md',
];

const MONSTER_FILES = [
  '11-Monsters.md',
  '11a-Monsters-Part1.md',
  '11b-Monsters-Part2.md',
  '11c-Monsters-Part3.md',
  '11d-Monsters-Part4.md',
  '11e-Monsters-Part5.md',
  '11f-Monsters-Part6.md',
  '11g-Monsters-Part7.md',
  '11h-Monsters-Part8.md',
  '11i-Monsters-Part9.md',
  '12-Animals.md',
  '12a-Animals-Part1.md',
  '12b-Animals-Part2.md',
];

const EQUIPMENT_FILES = [
  '06-Equipment.md',
];

interface SeedStats {
  spells: { parsed: number; inserted: number; skipped: number; errors: number };
  monsters: { parsed: number; inserted: number; skipped: number; errors: number };
  equipment: { parsed: number; inserted: number; skipped: number; errors: number };
  rooms: { parsed: number; inserted: number; skipped: number; errors: number };
}

/**
 * Initialize database schema (same as sqlite-server)
 */
function initializeSchema(db: DatabaseType): void {
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
}

/**
 * Read and parse all files matching a pattern
 */
function readFiles(directory: string, files: string[]): string[] {
  const contents: string[] = [];
  
  for (const file of files) {
    const filePath = path.join(directory, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      contents.push(content);
      console.log(`  Read: ${file}`);
    } else {
      console.warn(`  Warning: File not found: ${file}`);
    }
  }
  
  return contents;
}

/**
 * Get all WLD region files
 */
async function getWLDFiles(): Promise<string[]> {
  const pattern = path.join(WLD_DIR, '*.md').replace(/\\/g, '/');
  const files = await glob(pattern);
  
  // Filter to only region files (contain room data)
  return files.filter(f => {
    const basename = path.basename(f);
    return basename.match(/^\d{2}[a-z]?-Region-/);
  });
}

/**
 * Seed spells into database
 */
function seedSpells(db: DatabaseType, stats: SeedStats): void {
  console.log('\n📜 Parsing Spells...');
  
  const contents = readFiles(SRD_DIR, SPELL_FILES);
  const allSpells: ParsedSpell[] = [];
  
  for (const content of contents) {
    const spells = parseSpells(content, 'SRD 5.2');
    allSpells.push(...spells);
  }
  
  stats.spells.parsed = allSpells.length;
  console.log(`  Parsed ${allSpells.length} spells total`);
  
  // Deduplicate by name
  const uniqueSpells = new Map<string, ParsedSpell>();
  for (const spell of allSpells) {
    const key = spell.name.toLowerCase();
    if (!uniqueSpells.has(key)) {
      uniqueSpells.set(key, spell);
    }
  }
  
  // Insert spells
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO spells 
    (name, level, school, casting_time, range, components, duration, classes, description, higher_levels, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertMany = db.transaction((spells: ParsedSpell[]) => {
    for (const spell of spells) {
      try {
        insertStmt.run(
          spell.name,
          spell.level,
          spell.school,
          spell.casting_time,
          spell.range,
          spell.components,
          spell.duration,
          spell.classes,
          spell.description,
          spell.higher_levels,
          spell.source
        );
        stats.spells.inserted++;
      } catch (error) {
        console.warn(`  Error inserting spell "${spell.name}": ${error}`);
        stats.spells.errors++;
      }
    }
  });
  
  insertMany([...uniqueSpells.values()]);
  console.log(`  Inserted ${stats.spells.inserted} spells`);
}

/**
 * Seed monsters into database
 */
function seedMonsters(db: DatabaseType, stats: SeedStats): void {
  console.log('\n👹 Parsing Monsters...');
  
  const contents = readFiles(SRD_DIR, MONSTER_FILES);
  const allMonsters: ParsedMonster[] = [];
  
  for (const content of contents) {
    const monsters = parseMonsters(content, 'SRD 5.2');
    allMonsters.push(...monsters);
  }
  
  stats.monsters.parsed = allMonsters.length;
  console.log(`  Parsed ${allMonsters.length} monsters total`);
  
  // Deduplicate by name
  const uniqueMonsters = new Map<string, ParsedMonster>();
  for (const monster of allMonsters) {
    const key = monster.name.toLowerCase();
    if (!uniqueMonsters.has(key)) {
      uniqueMonsters.set(key, monster);
    }
  }
  
  // Insert monsters
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO monsters 
    (name, cr, cr_numeric, type, size, alignment, ac, hp, speed, abilities, skills, senses, languages, traits, actions, legendary_actions, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertMany = db.transaction((monsters: ParsedMonster[]) => {
    for (const monster of monsters) {
      try {
        insertStmt.run(
          monster.name,
          monster.cr,
          monster.cr_numeric,
          monster.type,
          monster.size,
          monster.alignment,
          monster.ac,
          monster.hp,
          monster.speed,
          monster.abilities,
          monster.skills,
          monster.senses,
          monster.languages,
          monster.traits,
          monster.actions,
          monster.legendary_actions,
          monster.source
        );
        stats.monsters.inserted++;
      } catch (error) {
        console.warn(`  Error inserting monster "${monster.name}": ${error}`);
        stats.monsters.errors++;
      }
    }
  });
  
  insertMany([...uniqueMonsters.values()]);
  console.log(`  Inserted ${stats.monsters.inserted} monsters`);
}

/**
 * Seed equipment into database
 */
function seedEquipment(db: DatabaseType, stats: SeedStats): void {
  console.log('\n⚔️ Parsing Equipment...');
  
  const contents = readFiles(SRD_DIR, EQUIPMENT_FILES);
  const allEquipment: ParsedEquipment[] = [];
  
  for (const content of contents) {
    const equipment = parseEquipment(content, 'SRD 5.2');
    allEquipment.push(...equipment);
  }
  
  stats.equipment.parsed = allEquipment.length;
  console.log(`  Parsed ${allEquipment.length} equipment items total`);
  
  // Deduplicate by name
  const uniqueEquipment = new Map<string, ParsedEquipment>();
  for (const item of allEquipment) {
    const key = item.name.toLowerCase();
    if (!uniqueEquipment.has(key)) {
      uniqueEquipment.set(key, item);
    }
  }
  
  // Insert equipment
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO equipment 
    (name, category, subcategory, cost, weight, damage, damage_type, properties, ac_bonus, stealth_disadvantage, description, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertMany = db.transaction((items: ParsedEquipment[]) => {
    for (const item of items) {
      try {
        insertStmt.run(
          item.name,
          item.category,
          item.subcategory,
          item.cost,
          item.weight,
          item.damage,
          item.damage_type,
          item.properties,
          item.ac_bonus,
          item.stealth_disadvantage ? 1 : 0,
          item.description,
          item.source
        );
        stats.equipment.inserted++;
      } catch (error) {
        console.warn(`  Error inserting equipment "${item.name}": ${error}`);
        stats.equipment.errors++;
      }
    }
  });
  
  insertMany([...uniqueEquipment.values()]);
  console.log(`  Inserted ${stats.equipment.inserted} equipment items`);
}

/**
 * Seed rooms into database
 */
async function seedRooms(db: DatabaseType, stats: SeedStats): Promise<void> {
  console.log('\n🚪 Parsing Rooms...');
  
  const wldFiles = await getWLDFiles();
  console.log(`  Found ${wldFiles.length} WLD region files`);
  
  const allRooms: ParsedRoom[] = [];
  
  for (const filePath of wldFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const rooms = parseRooms(content);
    allRooms.push(...rooms);
    console.log(`  Read: ${path.basename(filePath)} (${rooms.length} rooms)`);
  }
  
  stats.rooms.parsed = allRooms.length;
  console.log(`  Parsed ${allRooms.length} rooms total`);
  
  // Deduplicate by room_id
  const uniqueRooms = new Map<string, ParsedRoom>();
  for (const room of allRooms) {
    const key = room.room_id.toLowerCase();
    if (!uniqueRooms.has(key)) {
      uniqueRooms.set(key, room);
    }
  }
  
  // Insert rooms
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO rooms 
    (room_id, region, name, description, dimensions, features, monsters, treasure, traps, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertMany = db.transaction((rooms: ParsedRoom[]) => {
    for (const room of rooms) {
      try {
        insertStmt.run(
          room.room_id,
          room.region,
          room.name,
          room.description,
          room.dimensions,
          room.features,
          room.monsters,
          room.treasure,
          room.traps,
          room.notes
        );
        stats.rooms.inserted++;
      } catch (error) {
        console.warn(`  Error inserting room "${room.room_id}": ${error}`);
        stats.rooms.errors++;
      }
    }
  });
  
  insertMany([...uniqueRooms.values()]);
  console.log(`  Inserted ${stats.rooms.inserted} rooms`);
}

/**
 * Print final statistics
 */
function printStats(stats: SeedStats): void {
  console.log('\n' + '='.repeat(60));
  console.log('📊 SEEDING COMPLETE - Statistics:');
  console.log('='.repeat(60));
  
  const table = [
    ['Category', 'Parsed', 'Inserted', 'Skipped', 'Errors'],
    ['Spells', stats.spells.parsed, stats.spells.inserted, stats.spells.skipped, stats.spells.errors],
    ['Monsters', stats.monsters.parsed, stats.monsters.inserted, stats.monsters.skipped, stats.monsters.errors],
    ['Equipment', stats.equipment.parsed, stats.equipment.inserted, stats.equipment.skipped, stats.equipment.errors],
    ['Rooms', stats.rooms.parsed, stats.rooms.inserted, stats.rooms.skipped, stats.rooms.errors],
  ];
  
  // Print header
  console.log(`\n  ${'Category'.padEnd(12)} ${'Parsed'.padStart(8)} ${'Inserted'.padStart(10)} ${'Skipped'.padStart(9)} ${'Errors'.padStart(8)}`);
  console.log(`  ${'-'.repeat(12)} ${'-'.repeat(8)} ${'-'.repeat(10)} ${'-'.repeat(9)} ${'-'.repeat(8)}`);
  
  // Print data rows
  for (let i = 1; i < table.length; i++) {
    const row = table[i];
    console.log(`  ${String(row[0]).padEnd(12)} ${String(row[1]).padStart(8)} ${String(row[2]).padStart(10)} ${String(row[3]).padStart(9)} ${String(row[4]).padStart(8)}`);
  }
  
  // Print totals
  const totalParsed = stats.spells.parsed + stats.monsters.parsed + stats.equipment.parsed + stats.rooms.parsed;
  const totalInserted = stats.spells.inserted + stats.monsters.inserted + stats.equipment.inserted + stats.rooms.inserted;
  const totalErrors = stats.spells.errors + stats.monsters.errors + stats.equipment.errors + stats.rooms.errors;
  
  console.log(`  ${'-'.repeat(12)} ${'-'.repeat(8)} ${'-'.repeat(10)} ${'-'.repeat(9)} ${'-'.repeat(8)}`);
  console.log(`  ${'TOTAL'.padEnd(12)} ${String(totalParsed).padStart(8)} ${String(totalInserted).padStart(10)} ${String(0).padStart(9)} ${String(totalErrors).padStart(8)}`);
  
  console.log('\n' + '='.repeat(60));
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log('🎲 World\'s Largest Dungeon - Database Seeder');
  console.log('='.repeat(60));
  console.log(`Project Root: ${PROJECT_ROOT}`);
  console.log(`Database Path: ${DB_PATH}`);
  console.log(`SRD Directory: ${SRD_DIR}`);
  console.log(`WLD Directory: ${WLD_DIR}`);
  
  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`\nCreated data directory: ${dataDir}`);
  }
  
  // Initialize database
  console.log('\n🗄️ Initializing database...');
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  initializeSchema(db);
  console.log('  Schema initialized');
  
  // Initialize stats
  const stats: SeedStats = {
    spells: { parsed: 0, inserted: 0, skipped: 0, errors: 0 },
    monsters: { parsed: 0, inserted: 0, skipped: 0, errors: 0 },
    equipment: { parsed: 0, inserted: 0, skipped: 0, errors: 0 },
    rooms: { parsed: 0, inserted: 0, skipped: 0, errors: 0 },
  };
  
  try {
    // Seed all data
    seedSpells(db, stats);
    seedMonsters(db, stats);
    seedEquipment(db, stats);
    await seedRooms(db, stats);
    
    // Print statistics
    printStats(stats);
    
  } finally {
    db.close();
    console.log('\n✅ Database connection closed');
  }
}

// Run main
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
