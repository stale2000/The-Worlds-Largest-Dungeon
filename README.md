# The World's Largest Dungeon - Rules Retrieval

A web application for quickly searching and retrieving D&D 5E rules and adventure content from *The World's Largest Dungeon*.

## 📑 Table of Contents

- [The World's Largest Dungeon - Rules Retrieval](#the-worlds-largest-dungeon---rules-retrieval)
  - [📑 Table of Contents](#-table-of-contents)
  - [🎯 Project Goal](#-project-goal)
  - [🏗️ Architecture](#️-architecture)
    - [RAG Server](#rag-server)
    - [SQLite Server](#sqlite-server)
  - [📚 Content Sources](#-content-sources)
    - [SRD 5.2 (System Reference Document)](#srd-52-system-reference-document)
    - [World's Largest Dungeon (Book 1)](#worlds-largest-dungeon-book-1)
  - [🗂️ Repository Structure](#️-repository-structure)
  - [📜 License](#-license)
    - [SRD 5.2 Content](#srd-52-content)
    - [World's Largest Dungeon](#worlds-largest-dungeon)

---

## 🎯 Project Goal

Build a fast, intelligent rules lookup tool that can:
- Search D&D 5E rules from the SRD 5.2 (spells, monsters, classes, items, etc.)
- Retrieve room descriptions, encounters, and monster stats from The World's Largest Dungeon
- Provide natural language answers using RAG (Retrieval-Augmented Generation)

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Web Application                         │
│                   (Search Interface)                        │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          │                               │
          ▼                               ▼
┌─────────────────────┐       ┌─────────────────────┐
│    RAG Server       │       │   SQLite Server     │
│  (Vector Search)    │       │ (Structured Lookup) │
│                     │       │                     │
│ • Semantic search   │       │ • Spell tables      │
│ • Context retrieval │       │ • Monster stats     │
│ • Chunk embeddings  │       │ • Equipment lists   │
└─────────────────────┘       └─────────────────────┘
          │                               │
          └───────────────┬───────────────┘
                          │
                          ▼
            ┌─────────────────────────┐
            │     LLM (Claude)        │
            │   Response Generation   │
            └─────────────────────────┘
```

### RAG Server
- **Purpose**: Semantic search over D&D content
- **Use Cases**: 
  - "How does grappling work?"
  - "What's in room A42?"
  - "Tell me about the wererat in Region A"

### SQLite Server  
- **Purpose**: Structured data lookups
- **Use Cases**:
  - Spell details by name or level
  - Monster stats by CR or type
  - Equipment by category

## 📚 Content Sources

### SRD 5.2 (System Reference Document)
The official D&D 5th Edition rules released under Creative Commons CC-BY-4.0.

| Section | Description |
|---------|-------------|
| Playing the Game | Core mechanics, combat, exploration |
| Character Creation | Classes, origins, feats |
| Equipment | Weapons, armor, gear |
| Spells | Complete spell list A-Z |
| Magic Items | Full magic item catalog |
| Monsters | Monster stat blocks A-Z |
| Animals | Beast stat blocks |
| Rules Glossary | Conditions, terms, definitions |

### World's Largest Dungeon (Book 1)
A massive dungeon crawl adventure covering levels 1-18.

| Region | Levels | Theme |
|--------|--------|-------|
| **A** | 1-3 | Orcs, kobolds, wererat conflict |
| **B** | 4-6 | Goblin empire, traps |
| **C** | 7-9 | Puzzles, black dragon, spectre |
| **D** | 14-18 | Derro, xill, enslaved races |

## 🗂️ Repository Structure

```
The-Worlds-Largest-Dungeon/
├── README.md
├── Resources/
│   ├── markdown/
│   │   ├── SRD 5.2/                   # D&D 5E rules (42 files)
│   │   │   ├── 00-Legal-Information.md # Index
│   │   │   ├── 01-12*.md              # Split chapters
│   │   │   └── ...
│   │   │
│   │   └── World's Largest Dungeon/   # Adventure (36 files)
│   │       ├── 00-Introduction.md     # Index
│   │       ├── 01-04*.md              # Regions A-D
│   │       └── 05-08*.md              # Bestiaries
│   │
│   └── pdf/                           # Source PDFs
```

## 📜 License

### SRD 5.2 Content
This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC. Licensed under CC-BY-4.0.

### World's Largest Dungeon
Original material © AEG/Alderac Entertainment Group.

---

*"The World's Largest Dungeon represents years of adventuring. Do not tread lightly."*
