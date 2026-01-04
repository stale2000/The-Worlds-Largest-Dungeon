import { Router, Request, Response } from 'express';
import { db } from '../db.js';

const router = Router();

interface SpellRow {
  id: number;
  name: string;
  level: number;
  school: string;
  casting_time: string | null;
  range: string | null;
  components: string | null;
  duration: string | null;
  classes: string | null;
  description: string | null;
  higher_levels: string | null;
  source: string | null;
}

interface SpellQueryParams {
  level?: string;
  school?: string;
  class?: string;
  search?: string;
  limit?: string;
  offset?: string;
}

/**
 * GET /spells
 * Query parameters:
 * - level: Filter by spell level (0-9)
 * - school: Filter by school (Evocation, Abjuration, etc.)
 * - class: Filter by class (Wizard, Cleric, etc.) - searches in comma-separated classes field
 * - search: Full-text search on name and description
 * - limit: Number of results (default 100)
 * - offset: Pagination offset (default 0)
 */
router.get('/', (req: Request<object, object, object, SpellQueryParams>, res: Response) => {
  try {
    const { level, school, class: spellClass, search, limit = '100', offset = '0' } = req.query;
    
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    
    if (level !== undefined) {
      const levelNum = parseInt(level, 10);
      if (!isNaN(levelNum) && levelNum >= 0 && levelNum <= 9) {
        conditions.push('level = ?');
        params.push(levelNum);
      }
    }
    
    if (school) {
      conditions.push('LOWER(school) = LOWER(?)');
      params.push(school);
    }
    
    if (spellClass) {
      // Search for class name within comma-separated classes field
      conditions.push('LOWER(classes) LIKE LOWER(?)');
      params.push(`%${spellClass}%`);
    }
    
    if (search) {
      conditions.push('(LOWER(name) LIKE LOWER(?) OR LOWER(description) LIKE LOWER(?))');
      params.push(`%${search}%`, `%${search}%`);
    }
    
    let sql = 'SELECT * FROM spells';
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY level ASC, name ASC';
    sql += ' LIMIT ? OFFSET ?';
    
    const limitNum = Math.min(parseInt(limit, 10) || 100, 500);
    const offsetNum = parseInt(offset, 10) || 0;
    params.push(limitNum, offsetNum);
    
    const stmt = db.prepare(sql);
    const rows = stmt.all(...params) as SpellRow[];
    
    // Transform classes from comma-separated to array
    const spells = rows.map(row => ({
      ...row,
      classes: row.classes ? row.classes.split(',').map(c => c.trim()) : [],
    }));
    
    res.json({
      count: spells.length,
      limit: limitNum,
      offset: offsetNum,
      data: spells,
    });
  } catch (error) {
    console.error('Error fetching spells:', error);
    res.status(500).json({
      error: 'Database error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /spells/:id
 * Get a single spell by ID
 */
router.get('/:id', (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('SELECT * FROM spells WHERE id = ?');
    const row = stmt.get(parseInt(id, 10)) as SpellRow | undefined;
    
    if (!row) {
      res.status(404).json({
        error: 'Not found',
        message: `Spell with id ${id} not found`,
      });
      return;
    }
    
    const spell = {
      ...row,
      classes: row.classes ? row.classes.split(',').map(c => c.trim()) : [],
    };
    
    res.json(spell);
  } catch (error) {
    console.error('Error fetching spell:', error);
    res.status(500).json({
      error: 'Database error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as spellsRouter };
