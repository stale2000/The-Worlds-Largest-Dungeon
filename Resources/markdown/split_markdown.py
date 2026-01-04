#!/usr/bin/env python3
"""Split large markdown files into ~1000 line chunks at heading boundaries."""
import re
from pathlib import Path

def split_by_lines(content: str, target_lines: int = 1000) -> list[tuple[int, int, str]]:
    """Split content by line count at paragraph boundaries."""
    lines = content.split('\n')
    chunks = []
    start = 0
    
    while start < len(lines):
        end = min(start + target_lines, len(lines))
        if end < len(lines):
            for i in range(end, max(start + target_lines // 2, start), -1):
                if lines[i].strip() == '':
                    end = i + 1
                    break
        chunks.append((start + 1, end, '\n'.join(lines[start:end])))
        start = end
    
    return chunks

def get_first_letter(name: str) -> str:
    """Extract first letter for alphabetical grouping."""
    name = name.strip()
    return name[0].upper() if name else 'X'

def process_srd_classes(base_dir: Path):
    """Split 03-Classes.md by class name."""
    path = base_dir / 'SRD 5.2' / '03-Classes.md'
    content = path.read_text(encoding='utf-8')
    
    # Get header before first class
    header_match = re.match(r'^(.*?)(?=^## [A-Z])', content, re.MULTILINE | re.DOTALL)
    header = header_match.group(1) if header_match else ''
    
    # Find all ## headings
    sections = []
    current_name = None
    current_content = []
    
    for line in content.split('\n'):
        match = re.match(r'^## ([A-Z][a-z]+)', line)
        if match:
            if current_name:
                sections.append((current_name, '\n'.join(current_content)))
            current_name = match.group(1)
            current_content = [line]
        else:
            current_content.append(line)
    if current_name:
        sections.append((current_name, '\n'.join(current_content)))
    
    # Group to ~1000 lines
    chunks = []
    chunk_names = []
    chunk_content = []
    chunk_lines = 0
    
    for name, section in sections:
        section_lines = section.count('\n') + 1
        if chunk_lines + section_lines > 1000 and chunk_content:
            chunks.append((chunk_names[0], chunk_names[-1], '\n'.join(chunk_content)))
            chunk_names = []
            chunk_content = []
            chunk_lines = 0
        chunk_names.append(name)
        chunk_content.append(section)
        chunk_lines += section_lines
    
    if chunk_content:
        chunks.append((chunk_names[0], chunk_names[-1], '\n'.join(chunk_content)))
    
    for i, (start, end, chunk) in enumerate(chunks):
        suffix = chr(ord('a') + i)
        fname = f'03{suffix}-Classes-{start}-{end}.md' if start != end else f'03{suffix}-Classes-{start}.md'
        prefix = header if i == 0 else '# Classes (continued)\n\n'
        out = base_dir / 'SRD 5.2' / fname
        out.write_text(prefix + chunk, encoding='utf-8')
        print(f'  Created: {fname} ({chunk.count(chr(10))+1} lines)')

def process_srd_spells(base_dir: Path):
    """Split 07-Spells.md alphabetically with ~1000 line chunks."""
    path = base_dir / 'SRD 5.2' / '07-Spells.md'
    if not path.exists():
        print('  SKIPPED: 07-Spells.md not found (file was deleted)')
        return
    content = path.read_text(encoding='utf-8')
    
    # Find start of spell descriptions
    desc_match = re.search(r'^(## Spell Descriptions\s*\n)', content, re.MULTILINE)
    if not desc_match:
        print('  Could not find spell descriptions section')
        return
    
    header = content[:desc_match.end()]
    spell_content = content[desc_match.end():]
    
    # Parse individual spells - skip duplicates and stop at raw PDF text
    spells = []
    current_spell = None
    current_content = []
    seen_spells = set()
    lines_without_heading = 0
    
    for line in spell_content.split('\n'):
        match = re.match(r"^### ([A-Z][A-Za-z'/ -]+)$", line.strip())
        if match:
            spell_name = match.group(1)
            if spell_name in seen_spells:
                continue
            if current_spell:
                spells.append((current_spell, '\n'.join(current_content)))
            seen_spells.add(spell_name)
            current_spell = spell_name
            current_content = [line]
            lines_without_heading = 0
        else:
            current_content.append(line)
            lines_without_heading += 1
            if lines_without_heading > 200 and current_spell:
                while current_content and not current_content[-1].strip():
                    current_content.pop()
                spells.append((current_spell, '\n'.join(current_content)))
                current_spell = None
                break
    
    if current_spell:
        spells.append((current_spell, '\n'.join(current_content)))
    
    # Group spells to ~1000 lines
    chunks = []
    chunk_spells = []
    chunk_content = []
    chunk_lines = 0
    
    for name, spell_text in spells:
        spell_lines = spell_text.count('\n') + 1
        if chunk_lines + spell_lines > 1000 and chunk_content:
            first = get_first_letter(chunk_spells[0])
            last = get_first_letter(chunk_spells[-1])
            label = f'{first}-{last}' if first != last else first
            chunks.append((label, chunk_spells[0], chunk_spells[-1], '\n'.join(chunk_content)))
            chunk_spells = []
            chunk_content = []
            chunk_lines = 0
        chunk_spells.append(name)
        chunk_content.append(spell_text)
        chunk_lines += spell_lines
    
    if chunk_content:
        first = get_first_letter(chunk_spells[0])
        last = get_first_letter(chunk_spells[-1])
        label = f'{first}-{last}' if first != last else first
        chunks.append((label, chunk_spells[0], chunk_spells[-1], '\n'.join(chunk_content)))
    
    for i, (label, first_spell, last_spell, chunk) in enumerate(chunks):
        suffix = chr(ord('a') + i)
        fname = f'07{suffix}-Spells-{label}.md'
        prefix = header if i == 0 else f'# Spells (continued)\n\n## Spell Descriptions ({label})\n\n'
        out = base_dir / 'SRD 5.2' / fname
        out.write_text(prefix + chunk, encoding='utf-8')
        print(f'  Created: {fname} ({chunk.count(chr(10))+1} lines, {first_spell} to {last_spell})')

def process_srd_generic(base_dir: Path, filename: str, num: str, name: str, target_chunks: int = 5):
    """Split raw PDF-extracted files by line count."""
    path = base_dir / 'SRD 5.2' / filename
    content = path.read_text(encoding='utf-8')
    lines = content.split('\n')
    target_lines = len(lines) // target_chunks + 100
    
    chunks = split_by_lines(content, target_lines)
    
    for i, (start, end, chunk) in enumerate(chunks):
        suffix = chr(ord('a') + i)
        fname = f'{num}{suffix}-{name}-Part{i+1}.md'
        out = base_dir / 'SRD 5.2' / fname
        header = f'# {name} (Part {i+1})\n\n' if i > 0 else ''
        out.write_text(header + chunk, encoding='utf-8')
        print(f'  Created: {fname} ({chunk.count(chr(10))+1} lines)')

def process_wld_region(base_dir: Path, filename: str, region_letter: str, num: str):
    """Split WLD region files by room ranges."""
    path = base_dir / "World's Largest Dungeon" / filename
    content = path.read_text(encoding='utf-8')
    
    # Find room headings like "A1 . ENTRANCE" or "A2-A20 . ORC STRONGHOLD"
    room_pattern = rf'^({region_letter}\d+(?:-{region_letter}\d+)?) \. (.+)$'
    
    sections = []
    current_room = None
    current_content = []
    header_content = []
    in_header = True
    
    for line in content.split('\n'):
        match = re.match(room_pattern, line)
        if match:
            in_header = False
            if current_room:
                sections.append((current_room, '\n'.join(current_content)))
            current_room = match.group(1)
            current_content = [line]
        elif in_header:
            header_content.append(line)
        else:
            current_content.append(line)
    
    if current_room:
        sections.append((current_room, '\n'.join(current_content)))
    
    header = '\n'.join(header_content)
    
    # Group sections to ~1000 lines
    chunks = []
    chunk_rooms = []
    chunk_content = []
    chunk_lines = 0
    
    for room, section in sections:
        section_lines = section.count('\n') + 1
        if chunk_lines + section_lines > 1000 and chunk_content:
            chunks.append((chunk_rooms[0], chunk_rooms[-1], '\n'.join(chunk_content)))
            chunk_rooms = []
            chunk_content = []
            chunk_lines = 0
        chunk_rooms.append(room)
        chunk_content.append(section)
        chunk_lines += section_lines
    
    if chunk_content:
        chunks.append((chunk_rooms[0], chunk_rooms[-1], '\n'.join(chunk_content)))
    
    for i, (start, end, chunk) in enumerate(chunks):
        suffix = chr(ord('a') + i)
        fname = f'{num}{suffix}-Region-{region_letter}-{start}-to-{end}.md'
        prefix = header + '\n\n' if i == 0 else f'# Region {region_letter} (continued)\n\n'
        out = base_dir / "World's Largest Dungeon" / fname
        out.write_text(prefix + chunk, encoding='utf-8')
        print(f'  Created: {fname} ({chunk.count(chr(10))+1} lines)')

def main():
    base = Path('.')
    
    print('\nProcessing SRD 5.2 files...')
    print('\n03-Classes.md:')
    process_srd_classes(base)
    
    print('\n07-Spells.md:')
    process_srd_spells(base)
    
    print('\n10-Magic-Items.md:')
    process_srd_generic(base, '10-Magic-Items.md', '10', 'Magic-Items', 5)
    
    print('\n11-Monsters.md:')
    process_srd_generic(base, '11-Monsters.md', '11', 'Monsters', 9)
    
    print('\n12-Animals.md:')
    process_srd_generic(base, '12-Animals.md', '12', 'Animals', 2)
    
    print('\nProcessing WLD files...')
    print('\n01-Region-A.md:')
    process_wld_region(base, '01-Region-A.md', 'A', '01')
    
    print('\n02-Region-B.md:')
    process_wld_region(base, '02-Region-B.md', 'B', '02')
    
    print('\n03-Region-C.md:')
    process_wld_region(base, '03-Region-C.md', 'C', '03')
    
    print('\n04-Region-D.md:')
    process_wld_region(base, '04-Region-D.md', 'D', '04')
    
    print('\nDone!')

if __name__ == '__main__':
    main()
