import { Router, Request, Response } from 'express';
import { db } from '../db.js';

const router = Router();

interface MonsterRow {
  id: number;
  name: string;
  cr: string;
  cr_numeric: number | null;
  type: string;
  size: string | null;
  alignment: string | null;
  ac: number | null;
  hp: number | null;
  speed: string | null;
  abilities: string | null;
  skills: string | null;
  senses: string | null;
  languages: string | null;
  traits: string | null;
  actions: string | null;
  legendary_actions: string | null;
  source: string | null;
}

interface MonsterQueryParams {
  cr?: string;
  cr_min?: string;
  cr_max?: string;
  type?: string;
  size?: string;
  search?: string;
  limit?: string;
  offset?: string;
}

/**
 * Parse CR string to numeric value
 * Handles "1/8", "1/4", "1/2", and integer values
 */
function parseCR(cr: string): number | null {
  if (cr.includes('/')) {
    const [num, denom] = cr.split('/').map(Number);
    if (!isNaN(num) && !isNaN(denom) && denom !== 0) {
      return num / denom;
    }
    return null;
  }
  const parsed = parseFloat(cr);
  return isNaN(parsed) ? null : parsed;
}

/**
 * GET /monsters
 * Query parameters:
 * - cr: Exact CR match (e.g., "5", "1/4")
 * - cr_min: Minimum CR (inclusive)
 * - cr_max: Maximum CR (inclusive)
 * - type: Filter by type (Fiend, Undead, Dragon, etc.)
 * - size: Filter by size (Tiny, Small, Medium, Large, Huge, Gargantuan)
 * - search: Full-text search on name and traits
 * - limit: Number of results (default 100)
 * - offset: Pagination offset (default 0)
 */
router.get('/', (req: Request<object, object, object, MonsterQueryParams>, res: Response) => {
  try {
    const { cr, cr_min, cr_max, type, size, search, limit = '100', offset = '0' } = req.query;
    
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    
    if (cr !== undefined) {
      const crNumeric = parseCR(cr);
      if (crNumeric !== null) {
        conditions.push('cr_numeric = ?');
        params.push(crNumeric);
      }
    }
    
    if (cr_min !== undefined) {
      const crMinNumeric = parseCR(cr_min);
      if (crMinNumeric !== null) {
        conditions.push('cr_numeric >= ?');
        params.push(crMinNumeric);
      }
    }
    
    if (cr_max !== undefined) {
      const crMaxNumeric = parseCR(cr_max);
      if (crMaxNumeric !== null) {
        conditions.push('cr_numeric <= ?');
        params.push(crMaxNumeric);
      }
    }
    
    if (type) {
      conditions.push('LOWER(type) = LOWER(?)');
      params.push(type);
    }
    
    if (size) {
      conditions.push('LOWER(size) = LOWER(?)');
      params.push(size);
    }
    
    if (search) {
      conditions.push('(LOWER(name) LIKE LOWER(?) OR LOWER(traits) LIKE LOWER(?) OR LOWER(actions) LIKE LOWER(?))');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    let sql = 'SELECT * FROM monsters';
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY cr_numeric ASC, name ASC';
    sql += ' LIMIT ? OFFSET ?';
    
    const limitNum = Math.min(parseInt(limit, 10) || 100, 500);
    const offsetNum = parseInt(offset, 10) || 0;
    params.push(limitNum, offsetNum);
    
    const stmt = db.prepare(sql);
    const rows = stmt.all(...params) as MonsterRow[];
    
    // Parse JSON fields
    const monsters = rows.map(row => ({
      ...row,
      abilities: row.abilities ? JSON.parse(row.abilities) : null,
    }));
    
    res.json({
      count: monsters.length,
      limit: limitNum,
      offset: offsetNum,
      data: monsters,
    });
  } catch (error) {
    console.error('Error fetching monsters:', error);
    res.status(500).json({
      error: 'Database error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /monsters/:id
 * Get a single monster by ID
 */
router.get('/:id', (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('SELECT * FROM monsters WHERE id = ?');
    const row = stmt.get(parseInt(id, 10)) as MonsterRow | undefined;
    
    if (!row) {
      res.status(404).json({
        error: 'Not found',
        message: `Monster with id ${id} not found`,
      });
      return;
    }
    
    const monster = {
      ...row,
      abilities: row.abilities ? JSON.parse(row.abilities) : null,
    };
    
    res.json(monster);
  } catch (error) {
    console.error('Error fetching monster:', error);
    res.status(500).json({
      error: 'Database error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as monstersRouter };
