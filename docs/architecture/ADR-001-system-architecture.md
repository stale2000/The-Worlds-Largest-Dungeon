# ADR-001: System Architecture

**Status:** Proposed  
**Date:** 2026-01-04  
**Decision Makers:** Project Team

## Context

We are building a D&D 5E rules retrieval web application that combines:
- **The World's Largest Dungeon** - Adventure module content (rooms, encounters, monsters)
- **SRD 5.2** - Core D&D 5E rules (spells, classes, equipment, monsters)

Users need both:
1. **Natural language search** - "How does grappling work?" → semantic retrieval
2. **Structured queries** - "Show all 3rd-level wizard spells" → database lookup

## Decision

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Railway Deployment                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                     Frontend (Static Site)                         │ │
│  │                     - Chat Interface                               │ │
│  │                     - Search Bar                                   │ │
│  │                     - Results Display                              │ │
│  └────────────────────────────┬───────────────────────────────────────┘ │
│                               │                                          │
│                               ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                     API Gateway / Router                           │ │
│  │                     (Node.js / Express)                            │ │
│  └──────────┬─────────────────────────────────────┬───────────────────┘ │
│             │                                     │                      │
│             ▼                                     ▼                      │
│  ┌─────────────────────┐           ┌─────────────────────────────────┐  │
│  │   Index Foundry     │           │      SQLite MCP Server          │  │
│  │   RAG Service       │           │      (Custom Build)             │  │
│  │                     │           │                                 │  │
│  │ • Vector embeddings │           │ • Spells table                  │  │
│  │ • Semantic search   │           │ • Monsters table                │  │
│  │ • Context retrieval │           │ • Equipment table               │  │
│  │ • Chunk management  │           │ • Rooms table                   │  │
│  └─────────────────────┘           └─────────────────────────────────┘  │
│             │                                     │                      │
│             └──────────────┬──────────────────────┘                      │
│                            │                                             │
│                            ▼                                             │
│             ┌─────────────────────────────────────┐                      │
│             │         LLM (Claude API)            │                      │
│             │         Response Synthesis          │                      │
│             └─────────────────────────────────────┘                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1. Frontend (Static Site)

**Technology:** HTML/CSS/JavaScript (or React/Vue)  
**Deployment:** Railway static site or CDN

**Features:**
- Chat-style interface for natural language queries
- Structured search filters (spell level, monster CR, region)
- Markdown rendering for formatted results
- Mobile-responsive design

**API Calls:**
```typescript
POST /api/chat     // Natural language query → LLM response
GET  /api/spells   // Structured spell lookup
GET  /api/monsters // Structured monster lookup
GET  /api/rooms    // Dungeon room lookup
```

---

### 2. API Gateway (Node.js/Express)

**Responsibilities:**
- Route queries to appropriate backend (RAG vs SQLite)
- Query classification: semantic vs structured
- Rate limiting and caching
- LLM orchestration (combine context + generate response)

**Query Router Logic:**
```typescript
function routeQuery(query: string): 'rag' | 'sqlite' | 'hybrid' {
  // Structured patterns → SQLite
  if (/spell|monster|item|equipment/i.test(query) && 
      /list|all|show|by level|by cr/i.test(query)) {
    return 'sqlite';
  }
  
  // Room lookups → SQLite first, then RAG for details
  if (/room [A-Z]\d+/i.test(query)) {
    return 'hybrid';
  }
  
  // Everything else → RAG
  return 'rag';
}
```

---

### 3. Index Foundry RAG Service

**Purpose:** Semantic search over markdown content  
**Deployment:** Via Index Foundry project tools

**Data Ingestion Pipeline:**
```
Resources/markdown/SRD 5.2/*.md       ─┐
                                       ├─► Index Foundry Project
Resources/markdown/World's Largest    ─┘
         Dungeon/*.md                      │
                                           ▼
                                    ┌──────────────┐
                                    │ project_build│
                                    │   - chunk    │
                                    │   - embed    │
                                    │   - index    │
                                    └──────────────┘
                                           │
                                           ▼
                                    ┌──────────────┐
                                    │project_serve │
                                    │   /search    │
                                    │   /chat      │
                                    └──────────────┘
```

**Chunk Strategy:**
- `recursive` chunking with 1500 char max, 150 char overlap
- Hierarchical parent-child for heading structure
- Metadata: source file, region, room number, content type

**Search Endpoints:**
```
POST /search  → Top-K semantic results
POST /chat    → RAG + LLM response
```

---

### 4. SQLite MCP Server (Custom Build)

**Purpose:** Structured queries for tabular D&D data  
**Technology:** Node.js + better-sqlite3 + MCP SDK

#### Database Schema

```sql
-- Spells from SRD 5.2
CREATE TABLE spells (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  level INTEGER NOT NULL,        -- 0-9 (0 = cantrip)
  school TEXT NOT NULL,          -- Abjuration, Conjuration, etc.
  casting_time TEXT NOT NULL,
  range TEXT NOT NULL,
  components TEXT NOT NULL,      -- V, S, M (materials)
  duration TEXT NOT NULL,
  classes TEXT NOT NULL,         -- JSON array: ["Wizard", "Cleric"]
  description TEXT NOT NULL,
  higher_levels TEXT,            -- At Higher Levels text
  ritual BOOLEAN DEFAULT FALSE,
  concentration BOOLEAN DEFAULT FALSE
);

-- Monsters from SRD 5.2 + WLD Bestiaries
CREATE TABLE monsters (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  source TEXT NOT NULL,          -- 'SRD 5.2' or 'WLD-A', 'WLD-B', etc.
  size TEXT NOT NULL,
  type TEXT NOT NULL,            -- Beast, Fiend, Humanoid, etc.
  alignment TEXT,
  armor_class INTEGER NOT NULL,
  hit_points TEXT NOT NULL,      -- e.g., "52 (7d10+14)"
  speed TEXT NOT NULL,
  str INTEGER, dex INTEGER, con INTEGER,
  int INTEGER, wis INTEGER, cha INTEGER,
  challenge_rating TEXT NOT NULL, -- "1/4", "1", "21"
  xp INTEGER NOT NULL,
  abilities TEXT NOT NULL,       -- JSON: traits, actions, etc.
  UNIQUE(name, source)
);

-- Equipment from SRD 5.2
CREATE TABLE equipment (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,        -- Weapon, Armor, Adventuring Gear, Tool
  subcategory TEXT,              -- Simple Melee, Martial Ranged, etc.
  cost TEXT,
  weight TEXT,
  properties TEXT,               -- JSON array for weapons
  description TEXT
);

-- Dungeon Rooms from WLD
CREATE TABLE rooms (
  id INTEGER PRIMARY KEY,
  room_id TEXT NOT NULL UNIQUE,  -- "A1", "A42", "B17"
  region TEXT NOT NULL,          -- "A", "B", "C", "D"
  name TEXT,                     -- Room title if any
  read_aloud TEXT,               -- Boxed text
  encounter TEXT,                -- Full encounter description
  monsters TEXT,                 -- JSON array of monster refs
  treasure TEXT,
  traps TEXT,
  encounter_condition TEXT,      -- Special conditions
  scaling TEXT,                  -- Scaling notes
  source_file TEXT NOT NULL      -- Reference back to markdown
);

-- Indexes for common queries
CREATE INDEX idx_spells_level ON spells(level);
CREATE INDEX idx_spells_school ON spells(school);
CREATE INDEX idx_monsters_cr ON monsters(challenge_rating);
CREATE INDEX idx_monsters_type ON monsters(type);
CREATE INDEX idx_rooms_region ON rooms(region);
```

#### MCP Tools

```typescript
// Tool: query_spells
{
  name: "query_spells",
  description: "Search spells by level, school, class, or name",
  parameters: {
    name: { type: "string", optional: true },
    level: { type: "number", optional: true },
    school: { type: "string", optional: true },
    class: { type: "string", optional: true },
    ritual: { type: "boolean", optional: true },
    concentration: { type: "boolean", optional: true },
    limit: { type: "number", default: 20 }
  }
}

// Tool: query_monsters
{
  name: "query_monsters",
  description: "Search monsters by CR, type, source, or name",
  parameters: {
    name: { type: "string", optional: true },
    type: { type: "string", optional: true },
    cr_min: { type: "string", optional: true },
    cr_max: { type: "string", optional: true },
    source: { type: "string", optional: true },
    limit: { type: "number", default: 20 }
  }
}

// Tool: query_rooms
{
  name: "query_rooms",
  description: "Look up dungeon rooms by ID or region",
  parameters: {
    room_id: { type: "string", optional: true },
    region: { type: "string", optional: true },
    has_monsters: { type: "boolean", optional: true },
    has_treasure: { type: "boolean", optional: true }
  }
}

// Tool: query_equipment
{
  name: "query_equipment",
  description: "Search equipment by category or name",
  parameters: {
    name: { type: "string", optional: true },
    category: { type: "string", optional: true },
    subcategory: { type: "string", optional: true }
  }
}
```

---

### 5. Data Extraction Pipeline

To populate SQLite, we need parsers that extract structured data from markdown:

```
┌─────────────────────────────────────────────────────────────┐
│                  Data Extraction Pipeline                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Resources/markdown/SRD 5.2/07*.md                          │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────────┐                                        │
│  │ spell_parser.ts │ ──► spells.json ──► SQLite INSERT      │
│  └─────────────────┘                                        │
│                                                              │
│  Resources/markdown/SRD 5.2/11*.md                          │
│  Resources/markdown/WLD/05-08-Bestiary*.md                  │
│         │                                                    │
│         ▼                                                    │
│  ┌───────────────────┐                                      │
│  │ monster_parser.ts │ ──► monsters.json ──► SQLite INSERT  │
│  └───────────────────┘                                      │
│                                                              │
│  Resources/markdown/SRD 5.2/06-Equipment.md                 │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────────────┐                                    │
│  │ equipment_parser.ts │ ──► equipment.json ──► SQLite      │
│  └─────────────────────┘                                    │
│                                                              │
│  Resources/markdown/WLD/01-04*-Region*.md                   │
│         │                                                    │
│         ▼                                                    │
│  ┌────────────────┐                                         │
│  │ room_parser.ts │ ──► rooms.json ──► SQLite INSERT        │
│  └────────────────┘                                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Deployment Strategy (Railway)

### Services

| Service | Type | Resources |
|---------|------|-----------|
| `frontend` | Static | HTML/CSS/JS bundle |
| `api-gateway` | Node.js | 512MB RAM |
| `index-foundry` | Node.js | 1GB RAM (embeddings) |
| `sqlite-mcp` | Node.js | 256MB RAM |

### Environment Variables

```env
# API Gateway
ANTHROPIC_API_KEY=sk-ant-...
INDEX_FOUNDRY_URL=http://index-foundry.internal:8080
SQLITE_MCP_URL=http://sqlite-mcp.internal:3000

# Index Foundry
OPENAI_API_KEY=sk-...  # For embeddings
PORT=8080

# SQLite MCP
DATABASE_PATH=/data/dnd-rules.db
PORT=3000
```

### Railway Config (railway.toml)

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "node dist/index.js"
healthcheckPath = "/health"
healthcheckTimeout = 30

[service]
internalPort = 8080
```

---

## Query Flow Examples

### Example 1: "How does grappling work?"

```
User Query
    │
    ▼
API Gateway (classify: RAG)
    │
    ▼
Index Foundry /search
    │ Returns chunks from 01-Playing-the-Game.md
    ▼
Claude API (synthesize response)
    │
    ▼
Response to User
```

### Example 2: "List all 3rd-level Cleric spells"

```
User Query
    │
    ▼
API Gateway (classify: SQLite)
    │
    ▼
SQLite MCP: query_spells(level=3, class="Cleric")
    │ Returns structured spell data
    ▼
Format as table/list
    │
    ▼
Response to User
```

### Example 3: "What's in room A42?"

```
User Query
    │
    ▼
API Gateway (classify: Hybrid)
    │
    ├─► SQLite MCP: query_rooms(room_id="A42")
    │   Returns: monsters, treasure, conditions
    │
    └─► Index Foundry /search "room A42"
        Returns: full narrative, tactics, read-aloud
    │
    ▼
Claude API (combine structured + narrative)
    │
    ▼
Response to User
```

---

## File Structure

```
The-Worlds-Largest-Dungeon/
├── README.md
├── docs/
│   └── architecture/
│       └── ADR-001-system-architecture.md
│
├── packages/
│   ├── frontend/                # Static web app
│   │   ├── index.html
│   │   ├── styles.css
│   │   └── app.js
│   │
│   ├── api-gateway/             # Express router + LLM orchestration
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── router.ts
│   │       └── llm.ts
│   │
│   ├── sqlite-mcp/              # SQLite MCP server
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── schema.sql
│   │   │   └── tools/
│   │   │       ├── spells.ts
│   │   │       ├── monsters.ts
│   │   │       ├── equipment.ts
│   │   │       └── rooms.ts
│   │   └── data/
│   │       └── dnd-rules.db
│   │
│   └── data-pipeline/           # Extract structured data from markdown
│       ├── package.json
│       ├── src/
│       │   ├── parsers/
│       │   │   ├── spell-parser.ts
│       │   │   ├── monster-parser.ts
│       │   │   ├── equipment-parser.ts
│       │   │   └── room-parser.ts
│       │   └── seed-database.ts
│       └── output/
│           ├── spells.json
│           ├── monsters.json
│           ├── equipment.json
│           └── rooms.json
│
├── Resources/
│   ├── markdown/                # Source content (existing)
│   └── pdf/                     # Original PDFs (existing)
│
└── railway.json                 # Multi-service Railway config
```

---

## Consequences

### Positive
- Clean separation: RAG for semantic, SQLite for structured
- Index Foundry handles complex RAG pipeline
- SQLite is fast, portable, and serverless-friendly
- Railway simplifies multi-service deployment

### Negative
- Need custom parsers to extract structured data from markdown
- Two data stores to maintain (vectors + SQLite)
- Initial setup complexity for data pipeline

### Risks
- Markdown parsing may miss edge cases
- Keeping SQLite in sync with markdown changes
- Rate limits on embedding API during initial indexing

---

## Next Steps

1. [ ] Create Index Foundry project and ingest markdown
2. [ ] Build data extraction parsers (spells, monsters, equipment, rooms)
3. [ ] Implement SQLite MCP server with query tools
4. [ ] Build API gateway with query classification
5. [ ] Create frontend chat interface
6. [ ] Deploy to Railway
7. [ ] Test end-to-end query flows
