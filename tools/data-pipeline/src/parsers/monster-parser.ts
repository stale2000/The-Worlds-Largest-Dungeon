/**
 * Monster Parser for SRD 5.2 Markdown Files
 * 
 * Parses monster entries from markdown files into structured data.
 * Handles various stat block formats in the SRD 5.2.
 */

export interface ParsedMonster {
  name: string;
  cr: string;
  cr_numeric: number;  // Convert "1/4" → 0.25, "1/2" → 0.5
  type: string;
  size: string;
  alignment: string | null;
  ac: number;
  hp: number;
  speed: string;
  abilities: string;  // JSON: {str, dex, con, int, wis, cha}
  skills: string | null;
  senses: string | null;
  languages: string | null;
  traits: string | null;
  actions: string | null;
  legendary_actions: string | null;
  source: string;
}

interface AbilityScores {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

// Monster sizes
const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];

// Monster types
const CREATURE_TYPES = [
  'Aberration',
  'Beast',
  'Celestial',
  'Construct',
  'Dragon',
  'Elemental',
  'Fey',
  'Fiend',
  'Giant',
  'Humanoid',
  'Monstrosity',
  'Ooze',
  'Plant',
  'Undead',
];

/**
 * Convert CR string to numeric value
 */
function crToNumeric(cr: string): number {
  cr = cr.trim();
  if (cr === '0') return 0;
  if (cr === '1/8') return 0.125;
  if (cr === '1/4') return 0.25;
  if (cr === '1/2') return 0.5;
  const num = parseFloat(cr);
  return isNaN(num) ? 0 : num;
}

/**
 * Extract a field value from content
 */
function extractField(content: string, fieldName: string): string | null {
  const patterns = [
    new RegExp(`\\*\\*${fieldName}\\*\\*\\s+(.+?)(?:\\s{2,}|\\n|$)`, 'i'),
    new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*(.+?)(?:\\s{2,}|\\n|$)`, 'i'),
    new RegExp(`\\*\\*${fieldName}\\*\\*:\\s*(.+?)(?:\\s{2,}|\\n|$)`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  return null;
}

/**
 * Parse AC from string like "17 (natural armor)" or "15"
 */
function parseAC(acString: string | null): number {
  if (!acString) return 10;
  const match = acString.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 10;
}

/**
 * Parse HP from string like "150 (20d10 + 40)" or "45"
 */
function parseHP(hpString: string | null): number {
  if (!hpString) return 0;
  const match = hpString.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Parse ability scores from a markdown table row
 * Format: | 21 (+5) | 9 (−1) | 15 (+2) | 18 (+4) | 15 (+2) | 18 (+4) |
 */
function parseAbilityTable(content: string): AbilityScores | null {
  // Look for ability score table - find the row with numbers in parentheses
  const tableRowMatch = content.match(/\|\s*(\d+)\s*\([^)]+\)\s*\|\s*(\d+)\s*\([^)]+\)\s*\|\s*(\d+)\s*\([^)]+\)\s*\|\s*(\d+)\s*\([^)]+\)\s*\|\s*(\d+)\s*\([^)]+\)\s*\|\s*(\d+)\s*\([^)]+\)\s*\|/);
  
  if (tableRowMatch) {
    return {
      str: parseInt(tableRowMatch[1], 10),
      dex: parseInt(tableRowMatch[2], 10),
      con: parseInt(tableRowMatch[3], 10),
      int: parseInt(tableRowMatch[4], 10),
      wis: parseInt(tableRowMatch[5], 10),
      cha: parseInt(tableRowMatch[6], 10),
    };
  }

  // Alternative format: just numbers
  const simpleMatch = content.match(/\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|/);
  if (simpleMatch) {
    return {
      str: parseInt(simpleMatch[1], 10),
      dex: parseInt(simpleMatch[2], 10),
      con: parseInt(simpleMatch[3], 10),
      int: parseInt(simpleMatch[4], 10),
      wis: parseInt(simpleMatch[5], 10),
      cha: parseInt(simpleMatch[6], 10),
    };
  }

  return null;
}

/**
 * Parse size, type, and alignment from a line like "*Large Aberration, Lawful Evil*"
 */
function parseSizeTypeAlignment(line: string): { size: string; type: string; alignment: string | null } | null {
  // Remove asterisks and clean up
  const cleaned = line.replace(/^\*+|\*+$/g, '').trim();
  
  // Try to find size
  let size = 'Medium';
  for (const s of SIZES) {
    if (cleaned.toLowerCase().includes(s.toLowerCase())) {
      size = s;
      break;
    }
  }

  // Try to find type
  let type = 'Unknown';
  for (const t of CREATURE_TYPES) {
    if (cleaned.toLowerCase().includes(t.toLowerCase())) {
      type = t;
      break;
    }
  }

  // Try to find alignment
  let alignment: string | null = null;
  const alignmentMatch = cleaned.match(/,\s*(.+?)$/);
  if (alignmentMatch) {
    alignment = alignmentMatch[1].trim();
    // Validate it looks like an alignment
    if (!alignment.toLowerCase().match(/(lawful|neutral|chaotic|good|evil|unaligned|any)/)) {
      alignment = null;
    }
  }

  return { size, type, alignment };
}

/**
 * Extract CR from content
 */
function extractCR(content: string): string {
  // Look for CR pattern: **CR** 10 or CR 1/4 or (CR 5)
  const patterns = [
    /\*\*CR\*\*\s*(\d+(?:\/\d+)?)/i,
    /CR\s+(\d+(?:\/\d+)?)\s*\(/i,
    /CR\s+(\d+(?:\/\d+)?)/i,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return '0';
}

/**
 * Extract a section by header (#### Actions, etc.)
 */
function extractSection(content: string, sectionName: string): string | null {
  const pattern = new RegExp(`(?:^|\\n)#{3,4}\\s*${sectionName}\\s*\\n([\\s\\S]*?)(?=\\n#{2,4}\\s|$)`, 'i');
  const match = content.match(pattern);
  if (match) {
    return match[1].trim();
  }
  return null;
}

/**
 * Extract traits (content between ability table and Actions section)
 */
function extractTraits(content: string): string | null {
  // Find content after CR line and before Actions
  const crMatch = content.match(/\*\*CR\*\*[^\n]+\n\n?([\s\S]*?)(?=\n#{3,4}\s*Actions|$)/i);
  if (crMatch) {
    const traits = crMatch[1].trim();
    if (traits.length > 0) {
      return traits;
    }
  }
  return null;
}

/**
 * Parse all monsters from a markdown content string
 */
export function parseMonsters(markdownContent: string, source: string = 'SRD 5.2'): ParsedMonster[] {
  const monsters: ParsedMonster[] = [];
  
  // Normalize line endings (Windows CRLF -> LF)
  const normalizedContent = markdownContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Split by monster headers (## Monster Name or ### Monster Name)
  // But not #### sections which are sub-sections like Actions
  const monsterSections = normalizedContent.split(/(?=^##(?!#) )/m);

  for (const section of monsterSections) {
    // Must start with ## (monster header)
    if (!section.startsWith('## ')) {
      continue;
    }

    try {
      const monster = parseMonsterSection(section, source);
      if (monster) {
        monsters.push(monster);
      }
    } catch (error) {
      // Log error but continue parsing
      const nameMatch = section.match(/^## (.+?)(?:\n|$)/);
      const monsterName = nameMatch ? nameMatch[1] : 'Unknown';
      console.warn(`Warning: Failed to parse monster "${monsterName}": ${error}`);
    }
  }

  return monsters;
}

/**
 * Parse a single monster section
 */
function parseMonsterSection(section: string, source: string): ParsedMonster | null {
  // Extract monster name from header
  const nameMatch = section.match(/^## (.+?)(?:\n|$)/);
  if (!nameMatch) {
    return null;
  }
  const name = nameMatch[1].trim();

  // Skip headers that are section titles
  const skipHeaders = ['Actions', 'Traits', 'Reactions', 'Legendary Actions', 'Lair Actions', 'Regional Effects'];
  if (skipHeaders.includes(name)) {
    return null;
  }

  // Get the rest of the content
  const content = section.substring(nameMatch[0].length);

  // Look for subsection with actual stat block (### Monster Name format)
  let statBlockContent = content;
  const subHeaderMatch = content.match(/^### (.+?)(?:\n)([\s\S]*)/m);
  if (subHeaderMatch) {
    statBlockContent = subHeaderMatch[2];
  }

  // Parse size, type, alignment from the first italicized line
  const typeLineMatch = statBlockContent.match(/^\s*\*([^*]+)\*/m);
  let sizeTypeAlign = { size: 'Medium', type: 'Unknown', alignment: null as string | null };
  if (typeLineMatch) {
    const parsed = parseSizeTypeAlignment(typeLineMatch[1]);
    if (parsed) {
      sizeTypeAlign = parsed;
    }
  }

  // Extract stat line (AC, HP, Speed often on one line in new format)
  const statLine = extractField(statBlockContent, 'AC');
  let acString = statLine;
  let hpString = extractField(statBlockContent, 'HP');
  let speedString = extractField(statBlockContent, 'Speed');

  // Handle combined stat line format: **AC** 17 | **HP** 150 | **Speed** 10 ft.
  if (statLine && statLine.includes('|')) {
    const parts = statLine.split('|').map(p => p.trim());
    acString = parts[0];
    for (const part of parts) {
      if (part.toLowerCase().includes('hp')) {
        hpString = part.replace(/\*\*HP\*\*/i, '').trim();
      }
      if (part.toLowerCase().includes('speed')) {
        speedString = part.replace(/\*\*Speed\*\*/i, '').trim();
      }
    }
  }

  const ac = parseAC(acString);
  const hp = parseHP(hpString);
  const speed = speedString || '';

  // Parse ability scores
  const abilities = parseAbilityTable(statBlockContent);
  const abilitiesJson = abilities 
    ? JSON.stringify(abilities) 
    : JSON.stringify({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });

  // Extract other fields
  const skills = extractField(statBlockContent, 'Skills');
  const senses = extractField(statBlockContent, 'Senses');
  const languages = extractField(statBlockContent, 'Languages');
  const cr = extractCR(statBlockContent);

  // Extract traits, actions, legendary actions
  const traits = extractTraits(statBlockContent);
  const actions = extractSection(statBlockContent, 'Actions');
  const legendaryActions = extractSection(statBlockContent, 'Legendary Actions');

  // Validate we have enough data to create a monster
  if (!name || (hp === 0 && ac === 10 && !abilities)) {
    // Might be a section header, not a monster
    return null;
  }

  return {
    name,
    cr,
    cr_numeric: crToNumeric(cr),
    type: sizeTypeAlign.type,
    size: sizeTypeAlign.size,
    alignment: sizeTypeAlign.alignment,
    ac,
    hp,
    speed,
    abilities: abilitiesJson,
    skills,
    senses,
    languages,
    traits,
    actions,
    legendary_actions: legendaryActions,
    source,
  };
}

/**
 * CLI entry point for testing
 */
async function main() {
  const fs = await import('fs');
  const path = await import('path');
  
  // Test with a monster file
  const testFile = path.join(process.cwd(), '../../Resources/markdown/SRD 5.2/11a-Monsters-Part1.md');
  
  if (fs.existsSync(testFile)) {
    const content = fs.readFileSync(testFile, 'utf-8');
    const monsters = parseMonsters(content, 'SRD 5.2');
    
    console.log(`Parsed ${monsters.length} monsters from ${path.basename(testFile)}`);
    console.log('\nFirst 3 monsters:');
    monsters.slice(0, 3).forEach(monster => {
      console.log(`\n- ${monster.name} (CR ${monster.cr})`);
      console.log(`  Type: ${monster.size} ${monster.type}`);
      console.log(`  AC: ${monster.ac}, HP: ${monster.hp}`);
      console.log(`  Speed: ${monster.speed}`);
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
