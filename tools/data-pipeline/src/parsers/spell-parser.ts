/**
 * Spell Parser for SRD 5.2 Markdown Files
 * 
 * Parses spell entries from markdown files into structured data.
 * Handles both cantrips and leveled spells.
 */

export interface ParsedSpell {
  name: string;
  level: number;  // 0 for cantrips
  school: string;
  casting_time: string;
  range: string;
  components: string;
  duration: string;
  classes: string;  // comma-separated
  description: string;
  higher_levels: string | null;
  source: string;
}

// Spell schools to identify
const SPELL_SCHOOLS = [
  'Abjuration',
  'Conjuration',
  'Divination',
  'Enchantment',
  'Evocation',
  'Illusion',
  'Necromancy',
  'Transmutation',
];

/**
 * Extract field value from a line like "**Casting Time:** Action"
 */
function extractField(content: string, fieldName: string): string | null {
  // Handle multiple possible formats
  const patterns = [
    new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*(.+?)(?:\\s{2,}|$|\\n)`, 'i'),
    new RegExp(`\\*\\*${fieldName}\\*\\*:\\s*(.+?)(?:\\s{2,}|$|\\n)`, 'i'),
    new RegExp(`${fieldName}:\\s*(.+?)(?:\\s{2,}|$|\\n)`, 'i'),
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1].trim().replace(/\s+$/, '');
    }
  }
  return null;
}

/**
 * Parse the spell level and school from the subheader line
 * Examples:
 *   "**Evocation Cantrip** (Sorcerer, Wizard)" -> { level: 0, school: "Evocation", classes: "Sorcerer, Wizard" }
 *   "**Level 2 Evocation** (Wizard)" -> { level: 2, school: "Evocation", classes: "Wizard" }
 */
function parseSpellHeader(headerLine: string): { level: number; school: string; classes: string } | null {
  // Pattern 1: **Evocation Cantrip** (Classes) or **School Cantrip** (Classes)
  const cantripMatch = headerLine.match(/\*\*(\w+)\s+Cantrip\*\*\s*\(([^)]+)\)/i);
  if (cantripMatch) {
    return {
      level: 0,
      school: cantripMatch[1],
      classes: cantripMatch[2].trim(),
    };
  }

  // Pattern 2: **Level N School** (Classes)
  const leveledMatch = headerLine.match(/\*\*Level\s+(\d+)\s+(\w+)\*\*\s*\(([^)]+)\)/i);
  if (leveledMatch) {
    return {
      level: parseInt(leveledMatch[1], 10),
      school: leveledMatch[2],
      classes: leveledMatch[3].trim(),
    };
  }

  // Pattern 3: Just **School Cantrip** without class list
  const simpleCantripMatch = headerLine.match(/\*\*(\w+)\s+Cantrip\*\*/i);
  if (simpleCantripMatch) {
    return {
      level: 0,
      school: simpleCantripMatch[1],
      classes: '',
    };
  }

  // Pattern 4: Just **Level N School** without class list
  const simpleLeveledMatch = headerLine.match(/\*\*Level\s+(\d+)\s+(\w+)\*\*/i);
  if (simpleLeveledMatch) {
    return {
      level: parseInt(simpleLeveledMatch[1], 10),
      school: simpleLeveledMatch[2],
      classes: '',
    };
  }

  return null;
}

/**
 * Extract the higher levels section if present
 */
function extractHigherLevels(content: string): string | null {
  // Match "**At Higher Levels.**" or "**Using a Higher-Level Spell Slot.**"
  const patterns = [
    /\*\*At Higher Levels?\.\*\*\s*(.+?)(?=###|$)/is,
    /\*\*Using a Higher-Level Spell Slot\.\*\*\s*(.+?)(?=###|$)/is,
    /\*\*_At Higher Levels\._\*\*\s*(.+?)(?=###|$)/is,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1].trim().replace(/\n+/g, ' ').trim();
    }
  }
  return null;
}

/**
 * Extract the spell description (everything after Duration and before Higher Levels or next spell)
 */
function extractDescription(content: string): string {
  // Find where the description starts (after Duration line)
  const durationMatch = content.match(/\*\*Duration:\*\*\s*.+?\n\n?/i);
  if (!durationMatch) {
    return '';
  }

  const startIndex = (durationMatch.index || 0) + durationMatch[0].length;
  let description = content.substring(startIndex);

  // Remove higher levels section from description
  description = description
    .replace(/\*\*At Higher Levels?\.\*\*.+$/is, '')
    .replace(/\*\*Using a Higher-Level Spell Slot\.\*\*.+$/is, '')
    .replace(/\*\*_At Higher Levels\._\*\*.+$/is, '');

  // Clean up the description
  description = description
    .trim()
    .replace(/\n{3,}/g, '\n\n')  // Normalize multiple newlines
    .replace(/\s+$/, '');  // Remove trailing whitespace

  return description;
}

/**
 * Parse all spells from a markdown content string
 */
export function parseSpells(markdownContent: string, source: string = 'SRD 5.2'): ParsedSpell[] {
  const spells: ParsedSpell[] = [];
  
  // Normalize line endings (Windows CRLF -> LF)
  const normalizedContent = markdownContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Split by spell headers (### Spell Name)
  const spellSections = normalizedContent.split(/(?=^### [A-Z])/m);

  for (const section of spellSections) {
    // Must start with ### (spell header)
    if (!section.startsWith('### ')) {
      continue;
    }

    try {
      const spell = parseSpellSection(section, source);
      if (spell) {
        spells.push(spell);
      }
    } catch (error) {
      // Log error but continue parsing
      const nameMatch = section.match(/^### (.+?)(?:\n|$)/);
      const spellName = nameMatch ? nameMatch[1] : 'Unknown';
      console.warn(`Warning: Failed to parse spell "${spellName}": ${error}`);
    }
  }

  return spells;
}

/**
 * Parse a single spell section
 */
function parseSpellSection(section: string, source: string): ParsedSpell | null {
  // Extract spell name from header
  const nameMatch = section.match(/^### (.+?)(?:\n|$)/);
  if (!nameMatch) {
    return null;
  }
  const name = nameMatch[1].trim();

  // Skip if this looks like a subsection (Actions, etc.)
  if (['Actions', 'Bonus Actions', 'Reactions', 'Traits'].includes(name)) {
    return null;
  }

  // Get the rest of the content
  const content = section.substring(nameMatch[0].length);

  // Find spell level/school line (should be near the top)
  const lines = content.split('\n');
  let headerInfo: { level: number; school: string; classes: string } | null = null;

  // Check first few lines for the header info
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    headerInfo = parseSpellHeader(lines[i]);
    if (headerInfo) {
      break;
    }
  }

  if (!headerInfo) {
    // Try to extract school from content if header parsing failed
    let foundSchool = '';
    for (const school of SPELL_SCHOOLS) {
      if (content.toLowerCase().includes(school.toLowerCase())) {
        foundSchool = school;
        break;
      }
    }
    if (!foundSchool) {
      console.warn(`Warning: Could not parse header for spell "${name}"`);
      return null;
    }
    headerInfo = { level: 0, school: foundSchool, classes: '' };
  }

  // Extract spell properties
  const castingTime = extractField(content, 'Casting Time') || '';
  const range = extractField(content, 'Range') || '';
  const components = extractField(content, 'Components') || '';
  const duration = extractField(content, 'Duration') || '';

  // Extract description and higher levels
  const description = extractDescription(content);
  const higherLevels = extractHigherLevels(content);

  // Clean up classes - might need to extract from description or content if not in header
  let classes = headerInfo.classes;
  if (!classes) {
    // Try to find class list in parentheses after the level/school line
    const classMatch = content.match(/\(([^)]*(?:Bard|Cleric|Druid|Paladin|Ranger|Sorcerer|Warlock|Wizard)[^)]*)\)/i);
    if (classMatch) {
      classes = classMatch[1].trim();
    }
  }

  return {
    name,
    level: headerInfo.level,
    school: headerInfo.school,
    casting_time: castingTime,
    range,
    components,
    duration,
    classes,
    description,
    higher_levels: higherLevels,
    source,
  };
}

/**
 * CLI entry point for testing
 */
async function main() {
  const fs = await import('fs');
  const path = await import('path');
  
  // Test with a spell file
  const testFile = path.join(process.cwd(), '../../Resources/markdown/SRD 5.2/07a-Spells-Part1.md');
  
  if (fs.existsSync(testFile)) {
    const content = fs.readFileSync(testFile, 'utf-8');
    const spells = parseSpells(content, 'SRD 5.2');
    
    console.log(`Parsed ${spells.length} spells from ${path.basename(testFile)}`);
    console.log('\nFirst 3 spells:');
    spells.slice(0, 3).forEach(spell => {
      console.log(`\n- ${spell.name} (Level ${spell.level} ${spell.school})`);
      console.log(`  Classes: ${spell.classes}`);
      console.log(`  Casting Time: ${spell.casting_time}`);
      console.log(`  Range: ${spell.range}`);
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
