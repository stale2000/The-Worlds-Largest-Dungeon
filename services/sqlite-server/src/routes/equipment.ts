import { Router, Request, Response } from 'express';
import { db } from '../db.js';

const router = Router();

interface EquipmentRow {
  id: number;
  name: string;
  category: string;
  subcategory: string | null;
  cost: string | null;
  weight: string | null;
  damage: string | null;
  damage_type: string | null;
  properties: string | null;
  ac_bonus: number | null;
  stealth_disadvantage: number | null;
  description: string | null;
  source: string | null;
}

interface EquipmentQueryParams {
  category?: string;
  subcategory?: string;
  damage_type?: string;
  search?: string;
  limit?: string;
  offset?: string;
}

/**
 * GET /equipment
 * Query parameters:
 * - category: Filter by category (Weapon, Armor, Adventuring Gear, Tool)
 * - subcategory: Filter by subcategory (Simple, Martial, Light, Medium, Heavy)
 * - damage_type: Filter weapons by damage type (Slashing, Piercing, Bludgeoning)
 * - search: Full-text search on name and description
 * - limit: Number of results (default 100)
 * - offset: Pagination offset (default 0)
 */
router.get('/', (req: Request<object, object, object, EquipmentQueryParams>, res: Response) => {
  try {
    const { category, subcategory, damage_type, search, limit = '100', offset = '0' } = req.query;
    
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    
    if (category) {
      conditions.push('LOWER(category) = LOWER(?)');
      params.push(category);
    }
    
    if (subcategory) {
      conditions.push('LOWER(subcategory) = LOWER(?)');
      params.push(subcategory);
    }
    
    if (damage_type) {
      conditions.push('LOWER(damage_type) = LOWER(?)');
      params.push(damage_type);
    }
    
    if (search) {
      conditions.push('(LOWER(name) LIKE LOWER(?) OR LOWER(description) LIKE LOWER(?))');
      params.push(`%${search}%`, `%${search}%`);
    }
    
    let sql = 'SELECT * FROM equipment';
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY category ASC, subcategory ASC, name ASC';
    sql += ' LIMIT ? OFFSET ?';
    
    const limitNum = Math.min(parseInt(limit, 10) || 100, 500);
    const offsetNum = parseInt(offset, 10) || 0;
    params.push(limitNum, offsetNum);
    
    const stmt = db.prepare(sql);
    const rows = stmt.all(...params) as EquipmentRow[];
    
    // Transform properties from comma-separated to array and stealth_disadvantage to boolean
    const equipment = rows.map(row => ({
      ...row,
      properties: row.properties ? row.properties.split(',').map(p => p.trim()) : [],
      stealth_disadvantage: row.stealth_disadvantage === 1,
    }));
    
    res.json({
      count: equipment.length,
      limit: limitNum,
      offset: offsetNum,
      data: equipment,
    });
  } catch (error) {
    console.error('Error fetching equipment:', error);
    res.status(500).json({
      error: 'Database error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /equipment/:id
 * Get a single equipment item by ID
 */
router.get('/:id', (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('SELECT * FROM equipment WHERE id = ?');
    const row = stmt.get(parseInt(id, 10)) as EquipmentRow | undefined;
    
    if (!row) {
      res.status(404).json({
        error: 'Not found',
        message: `Equipment with id ${id} not found`,
      });
      return;
    }
    
    const equipment = {
      ...row,
      properties: row.properties ? row.properties.split(',').map(p => p.trim()) : [],
      stealth_disadvantage: row.stealth_disadvantage === 1,
    };
    
    res.json(equipment);
  } catch (error) {
    console.error('Error fetching equipment:', error);
    res.status(500).json({
      error: 'Database error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as equipmentRouter };
