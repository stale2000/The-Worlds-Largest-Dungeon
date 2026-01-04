import { Router, Request, Response } from 'express';
import { db } from '../db.js';

const router = Router();

interface RoomRow {
  id: number;
  room_id: string;
  region: string;
  name: string | null;
  description: string | null;
  dimensions: string | null;
  features: string | null;
  monsters: string | null;
  treasure: string | null;
  traps: string | null;
  notes: string | null;
}

interface RoomQueryParams {
  region?: string;
  id?: string;
  search?: string;
  has_monsters?: string;
  has_traps?: string;
  has_treasure?: string;
  limit?: string;
  offset?: string;
}

/**
 * GET /rooms
 * Query parameters:
 * - region: Filter by region (A, B, C, D)
 * - id: Filter by room_id (e.g., "A42", "B17")
 * - search: Full-text search on name, description, features, and notes
 * - has_monsters: Filter rooms with monsters ("true" or "false")
 * - has_traps: Filter rooms with traps ("true" or "false")
 * - has_treasure: Filter rooms with treasure ("true" or "false")
 * - limit: Number of results (default 100)
 * - offset: Pagination offset (default 0)
 */
router.get('/', (req: Request<object, object, object, RoomQueryParams>, res: Response) => {
  try {
    const { 
      region, 
      id: roomId, 
      search, 
      has_monsters, 
      has_traps, 
      has_treasure,
      limit = '100', 
      offset = '0' 
    } = req.query;
    
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    
    if (region) {
      conditions.push('UPPER(region) = UPPER(?)');
      params.push(region);
    }
    
    if (roomId) {
      conditions.push('UPPER(room_id) = UPPER(?)');
      params.push(roomId);
    }
    
    if (search) {
      conditions.push(`(
        LOWER(name) LIKE LOWER(?) OR 
        LOWER(description) LIKE LOWER(?) OR 
        LOWER(features) LIKE LOWER(?) OR 
        LOWER(notes) LIKE LOWER(?)
      )`);
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    if (has_monsters === 'true') {
      conditions.push("monsters IS NOT NULL AND monsters != '' AND monsters != '[]'");
    } else if (has_monsters === 'false') {
      conditions.push("(monsters IS NULL OR monsters = '' OR monsters = '[]')");
    }
    
    if (has_traps === 'true') {
      conditions.push("traps IS NOT NULL AND traps != ''");
    } else if (has_traps === 'false') {
      conditions.push("(traps IS NULL OR traps = '')");
    }
    
    if (has_treasure === 'true') {
      conditions.push("treasure IS NOT NULL AND treasure != ''");
    } else if (has_treasure === 'false') {
      conditions.push("(treasure IS NULL OR treasure = '')");
    }
    
    let sql = 'SELECT * FROM rooms';
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY region ASC, room_id ASC';
    sql += ' LIMIT ? OFFSET ?';
    
    const limitNum = Math.min(parseInt(limit, 10) || 100, 500);
    const offsetNum = parseInt(offset, 10) || 0;
    params.push(limitNum, offsetNum);
    
    const stmt = db.prepare(sql);
    const rows = stmt.all(...params) as RoomRow[];
    
    // Parse JSON fields
    const rooms = rows.map(row => ({
      ...row,
      monsters: row.monsters ? safeJsonParse(row.monsters, []) : [],
    }));
    
    res.json({
      count: rooms.length,
      limit: limitNum,
      offset: offsetNum,
      data: rooms,
    });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({
      error: 'Database error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /rooms/:roomId
 * Get a single room by room_id (e.g., "A42")
 */
router.get('/:roomId', (req: Request<{ roomId: string }>, res: Response) => {
  try {
    const { roomId } = req.params;
    const stmt = db.prepare('SELECT * FROM rooms WHERE UPPER(room_id) = UPPER(?)');
    const row = stmt.get(roomId) as RoomRow | undefined;
    
    if (!row) {
      res.status(404).json({
        error: 'Not found',
        message: `Room with id ${roomId} not found`,
      });
      return;
    }
    
    const room = {
      ...row,
      monsters: row.monsters ? safeJsonParse(row.monsters, []) : [],
    };
    
    res.json(room);
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({
      error: 'Database error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /rooms/region/:region
 * Get all rooms in a specific region
 */
router.get('/region/:region', (req: Request<{ region: string }>, res: Response) => {
  try {
    const { region } = req.params;
    const stmt = db.prepare('SELECT * FROM rooms WHERE UPPER(region) = UPPER(?) ORDER BY room_id ASC');
    const rows = stmt.all(region) as RoomRow[];
    
    const rooms = rows.map(row => ({
      ...row,
      monsters: row.monsters ? safeJsonParse(row.monsters, []) : [],
    }));
    
    res.json({
      region: region.toUpperCase(),
      count: rooms.length,
      data: rooms,
    });
  } catch (error) {
    console.error('Error fetching rooms by region:', error);
    res.status(500).json({
      error: 'Database error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Safely parse JSON with a fallback value
 */
function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

export { router as roomsRouter };
