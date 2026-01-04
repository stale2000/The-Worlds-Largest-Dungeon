/**
 * Equipment Parser for SRD 5.2 Markdown Files
 * 
 * Parses equipment entries from markdown tables into structured data.
 * Handles weapons, armor, and adventuring gear.
 */

export interface ParsedEquipment {
  name: string;
  category: string;  // Weapon, Armor, Adventuring Gear, Tool
  subcategory: string | null;
  cost: string | null;
  weight: string | null;
  damage: string | null;
  damage_type: string | null;
  properties: string | null;  // comma-separated
  ac_bonus: number | null;
  stealth_disadvantage: boolean;
  description: string | null;
  source: string;
}

// Categories and subcategories
// WEAPON_TYPES and ARMOR_TYPES used for reference but categories determined dynamically in determineTableType()
const DAMAGE_TYPES = ['Bludgeoning', 'Piercing', 'Slashing'];

/**
 * Parse a markdown table into rows
 */
function parseMarkdownTable(tableContent: string): string[][] {
  const lines = tableContent.trim().split('\n');
  const rows: string[][] = [];
  
  for (const line of lines) {
    // Skip separator lines (|---|---|)
    if (line.match(/^\|[-:\s|]+\|$/)) {
      continue;
    }
    
    // Parse table row
    if (line.includes('|')) {
      const cells = line
        .split('|')
        .slice(1, -1)  // Remove empty first/last elements
        .map(cell => cell.trim());
      
      if (cells.length > 0 && cells.some(c => c.length > 0)) {
        rows.push(cells);
      }
    }
  }
  
  return rows;
}

/**
 * Extract damage and damage type from a damage string like "1d8 Slashing"
 */
function parseDamage(damageStr: string | null): { damage: string | null; damageType: string | null } {
  if (!damageStr || damageStr === '—' || damageStr === '-') {
    return { damage: null, damageType: null };
  }

  // Look for damage dice pattern
  const diceMatch = damageStr.match(/(\d+d\d+(?:\s*\+\s*\d+)?)/i);
  const damage = diceMatch ? diceMatch[1] : null;

  // Look for damage type
  let damageType: string | null = null;
  for (const type of DAMAGE_TYPES) {
    if (damageStr.toLowerCase().includes(type.toLowerCase())) {
      damageType = type;
      break;
    }
  }

  return { damage, damageType };
}

/**
 * Parse AC from armor strings like "11 + Dex modifier" or "+2"
 */
function parseArmorAC(acStr: string | null): number | null {
  if (!acStr || acStr === '—' || acStr === '-') {
    return null;
  }

  // Look for base AC number
  const acMatch = acStr.match(/(\d+)/);
  if (acMatch) {
    return parseInt(acMatch[1], 10);
  }

  return null;
}

/**
 * Check if armor has stealth disadvantage
 */
function hasSteatlthDisadvantage(propertiesOrNotes: string | null): boolean {
  if (!propertiesOrNotes) return false;
  return propertiesOrNotes.toLowerCase().includes('stealth') && 
         propertiesOrNotes.toLowerCase().includes('disadvantage');
}

/**
 * Parse weapons table
 */
function parseWeaponsTable(tableContent: string, subcategory: string, source: string): ParsedEquipment[] {
  const items: ParsedEquipment[] = [];
  const rows = parseMarkdownTable(tableContent);
  
  // Skip header row
  const dataRows = rows.slice(1);
  
  for (const row of dataRows) {
    if (row.length < 3) continue;
    
    const name = row[0]?.replace(/\*+/g, '').trim();
    if (!name || name.toLowerCase() === 'name') continue;
    
    const cost = row[1]?.trim() || null;
    const damageStr = row[2]?.trim() || null;
    const weight = row[3]?.trim() || null;
    const properties = row[4]?.trim() || null;
    
    const { damage, damageType } = parseDamage(damageStr);
    
    items.push({
      name,
      category: 'Weapon',
      subcategory,
      cost: cost && cost !== '—' ? cost : null,
      weight: weight && weight !== '—' ? weight : null,
      damage,
      damage_type: damageType,
      properties: properties && properties !== '—' ? properties : null,
      ac_bonus: null,
      stealth_disadvantage: false,
      description: null,
      source,
    });
  }
  
  return items;
}

/**
 * Parse armor table
 */
function parseArmorTable(tableContent: string, subcategory: string, source: string): ParsedEquipment[] {
  const items: ParsedEquipment[] = [];
  const rows = parseMarkdownTable(tableContent);
  
  // Skip header row
  const dataRows = rows.slice(1);
  
  for (const row of dataRows) {
    if (row.length < 2) continue;
    
    const name = row[0]?.replace(/\*+/g, '').trim();
    if (!name || name.toLowerCase() === 'armor') continue;
    
    const acStr = row[1]?.trim() || null;
    const cost = row.length > 2 ? row[2]?.trim() : null;
    const weight = row.length > 3 ? row[3]?.trim() : null;
    const properties = row.length > 4 ? row[4]?.trim() : null;
    
    const acBonus = parseArmorAC(acStr);
    const stealthDisadv = hasSteatlthDisadvantage(properties || acStr);
    
    items.push({
      name,
      category: 'Armor',
      subcategory,
      cost: cost && cost !== '—' ? cost : null,
      weight: weight && weight !== '—' ? weight : null,
      damage: null,
      damage_type: null,
      properties: properties && properties !== '—' ? properties : null,
      ac_bonus: acBonus,
      stealth_disadvantage: stealthDisadv,
      description: acStr, // Store full AC description
      source,
    });
  }
  
  return items;
}

/**
 * Parse adventuring gear table
 */
function parseGearTable(tableContent: string, subcategory: string | null, source: string): ParsedEquipment[] {
  const items: ParsedEquipment[] = [];
  const rows = parseMarkdownTable(tableContent);
  
  // Skip header row
  const dataRows = rows.slice(1);
  
  for (const row of dataRows) {
    if (row.length < 2) continue;
    
    const name = row[0]?.replace(/\*+/g, '').trim();
    if (!name || name.toLowerCase() === 'item' || name.toLowerCase() === 'name') continue;
    
    const cost = row[1]?.trim() || null;
    const weight = row.length > 2 ? row[2]?.trim() : null;
    
    items.push({
      name,
      category: 'Adventuring Gear',
      subcategory,
      cost: cost && cost !== '—' ? cost : null,
      weight: weight && weight !== '—' ? weight : null,
      damage: null,
      damage_type: null,
      properties: null,
      ac_bonus: null,
      stealth_disadvantage: false,
      description: null,
      source,
    });
  }
  
  return items;
}

/**
 * Parse tools table
 */
function parseToolsTable(tableContent: string, subcategory: string | null, source: string): ParsedEquipment[] {
  const items: ParsedEquipment[] = [];
  const rows = parseMarkdownTable(tableContent);
  
  // Skip header row
  const dataRows = rows.slice(1);
  
  for (const row of dataRows) {
    if (row.length < 2) continue;
    
    const name = row[0]?.replace(/\*+/g, '').trim();
    if (!name || name.toLowerCase() === 'item' || name.toLowerCase() === 'tool') continue;
    
    const cost = row[1]?.trim() || null;
    const weight = row.length > 2 ? row[2]?.trim() : null;
    
    items.push({
      name,
      category: 'Tool',
      subcategory,
      cost: cost && cost !== '—' ? cost : null,
      weight: weight && weight !== '—' ? weight : null,
      damage: null,
      damage_type: null,
      properties: null,
      ac_bonus: null,
      stealth_disadvantage: false,
      description: null,
      source,
    });
  }
  
  return items;
}

/**
 * Determine table type from section headers
 */
function determineTableType(precedingContent: string): { category: string; subcategory: string | null } {
  const lowerContent = precedingContent.toLowerCase();
  
  // Check for weapon types
  if (lowerContent.includes('simple melee weapon')) {
    return { category: 'Weapon', subcategory: 'Simple Melee' };
  }
  if (lowerContent.includes('simple ranged weapon')) {
    return { category: 'Weapon', subcategory: 'Simple Ranged' };
  }
  if (lowerContent.includes('martial melee weapon')) {
    return { category: 'Weapon', subcategory: 'Martial Melee' };
  }
  if (lowerContent.includes('martial ranged weapon')) {
    return { category: 'Weapon', subcategory: 'Martial Ranged' };
  }
  if (lowerContent.includes('weapon')) {
    return { category: 'Weapon', subcategory: null };
  }
  
  // Check for armor types
  if (lowerContent.includes('light armor')) {
    return { category: 'Armor', subcategory: 'Light Armor' };
  }
  if (lowerContent.includes('medium armor')) {
    return { category: 'Armor', subcategory: 'Medium Armor' };
  }
  if (lowerContent.includes('heavy armor')) {
    return { category: 'Armor', subcategory: 'Heavy Armor' };
  }
  if (lowerContent.includes('shield')) {
    return { category: 'Armor', subcategory: 'Shield' };
  }
  if (lowerContent.includes('armor')) {
    return { category: 'Armor', subcategory: null };
  }
  
  // Check for tools
  if (lowerContent.includes('artisan') || lowerContent.includes('tool')) {
    return { category: 'Tool', subcategory: null };
  }
  
  // Default to adventuring gear
  return { category: 'Adventuring Gear', subcategory: null };
}

/**
 * Parse all equipment from a markdown content string
 */
export function parseEquipment(markdownContent: string, source: string = 'SRD 5.2'): ParsedEquipment[] {
  const equipment: ParsedEquipment[] = [];
  
  // Normalize line endings (Windows CRLF -> LF)
  const normalizedContent = markdownContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Find all tables in the content
  const tablePattern = /(\|[^\n]+\|\n\|[-:\s|]+\|\n(?:\|[^\n]+\|\n?)+)/g;
  const sections = normalizedContent.split(tablePattern);
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    
    // Check if this section is a table
    if (section.match(/^\|[^\n]+\|\n\|[-:\s|]+\|/)) {
      // Get preceding content to determine table type
      const precedingContent = sections.slice(Math.max(0, i - 3), i).join('\n');
      const { category, subcategory } = determineTableType(precedingContent);
      
      try {
        let items: ParsedEquipment[] = [];
        
        switch (category) {
          case 'Weapon':
            items = parseWeaponsTable(section, subcategory || 'Weapon', source);
            break;
          case 'Armor':
            items = parseArmorTable(section, subcategory || 'Armor', source);
            break;
          case 'Tool':
            items = parseToolsTable(section, subcategory, source);
            break;
          default:
            items = parseGearTable(section, subcategory, source);
        }
        
        equipment.push(...items);
      } catch (error) {
        console.warn(`Warning: Failed to parse ${category} table: ${error}`);
      }
    }
  }
  
  // Deduplicate by name (keeping first occurrence)
  const seen = new Set<string>();
  const deduped: ParsedEquipment[] = [];
  for (const item of equipment) {
    const key = item.name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(item);
    }
  }
  
  return deduped;
}

/**
 * CLI entry point for testing
 */
async function main() {
  const fs = await import('fs');
  const path = await import('path');
  
  // Test with equipment file
  const testFile = path.join(process.cwd(), '../../Resources/markdown/SRD 5.2/06-Equipment.md');
  
  if (fs.existsSync(testFile)) {
    const content = fs.readFileSync(testFile, 'utf-8');
    const items = parseEquipment(content, 'SRD 5.2');
    
    console.log(`Parsed ${items.length} equipment items from ${path.basename(testFile)}`);
    
    // Group by category
    const byCategory = items.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('\nBy category:');
    Object.entries(byCategory).forEach(([cat, count]) => {
      console.log(`  ${cat}: ${count}`);
    });
    
    console.log('\nFirst 5 items:');
    items.slice(0, 5).forEach(item => {
      console.log(`\n- ${item.name} (${item.category}/${item.subcategory || 'General'})`);
      console.log(`  Cost: ${item.cost || 'N/A'}, Weight: ${item.weight || 'N/A'}`);
      if (item.damage) console.log(`  Damage: ${item.damage} ${item.damage_type || ''}`);
      if (item.ac_bonus) console.log(`  AC: ${item.ac_bonus}`);
    });
  } else {
    console.log(`Test file not found: ${testFile}`);
    console.log('Run from tools/data-pipeline directory');
  }
}

// Run CLI if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
