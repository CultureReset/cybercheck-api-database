# Unified Database Consolidation Plan

**Branch:** `feature/unified-database-consolidation`

**Status:** In Progress

---

## File Organization

### 🆕 NEW FILES (Consolidation Logic)

These files will be CREATED from scratch:

```
cybercheck-api-database/
├── consolidation/
│   ├── merge-consolidated-db.cjs          [NEW] Master merge script - combines all data
│   ├── sync-consolidated.cjs               [NEW] Sync daemon - keeps old & new DBs in sync
│   ├── CONSOLIDATED-DB-SCHEMA.md          [NEW] Schema definition for unified DB
│   └── consolidation-mapping.json          [NEW] Field mappings from old → new structure
└── consolidated-db/
    └── CONSOLIDATED-MASTER.json           [NEW] Output file (consolidated database)
```

### ✏️ MODIFIED FILES (API Integration)

These files will be UPDATED to use consolidated DB:

```
cybercheck-api-database/
├── server.js                              [MODIFY] Add consolidated DB routes
├── .env                                   [MODIFY] Add new DB credentials/config
├── routes/
│   ├── consolidated-entities.js           [NEW] Endpoints for unified entity queries
│   ├── consolidated-bookings.js           [NEW] Endpoints for unified booking queries
│   └── consolidated-sync.js               [NEW] Endpoint to trigger manual sync
└── middleware/
    └── consolidation-middleware.js        [NEW] Middleware to handle dual-read logic
```

---

## File Changes Summary

| File | Type | Change | Reason |
|------|------|--------|--------|
| `consolidation/merge-consolidated-db.cjs` | NEW | Create from scratch | Merge all data sources |
| `consolidation/sync-consolidated.cjs` | NEW | Create from scratch | Keep DBs in sync |
| `consolidation/CONSOLIDATED-DB-SCHEMA.md` | NEW | Create from scratch | Document unified schema |
| `consolidation/consolidation-mapping.json` | NEW | Create from scratch | Map old fields to new |
| `routes/consolidated-entities.js` | NEW | Create from scratch | API endpoints for entities |
| `routes/consolidated-bookings.js` | NEW | Create from scratch | API endpoints for bookings |
| `routes/consolidated-sync.js` | NEW | Create from scratch | Manual sync trigger endpoint |
| `middleware/consolidation-middleware.js` | NEW | Create from scratch | Dual-read logic |
| `server.js` | MODIFY | Add routes + middleware | Wire up consolidated DB |
| `.env` | MODIFY | Add new config vars | Consolidated DB credentials |

---

## What Stays Unchanged

These remain untouched (old system continues working):

- ✅ `routes/` (existing endpoints)
- ✅ `agents/` folder
- ✅ All utility scripts (check-*.js, audit-*.js, etc.)
- ✅ All existing database connections
- ✅ CircleBoat integrations
- ✅ Supabase connections (GCR + Profiles)

---

## Implementation Phases

### ✅ Phase 1: Consolidate & Merge All Data (LOCAL)
**Goal:** Create consolidated database locally, no API changes yet

1. Create `consolidation/merge-consolidated-db.cjs` - merge GCR + Profiles + CultureReset
2. Run merge script → produces `CONSOLIDATED-MASTER.json`
3. Test consolidated data is complete & correct
4. **No API changes needed yet**

### ⏳ Phase 2: New Supabase Project with Consolidated Data
**Goal:** Create new Supabase DB with consolidated data

1. Create new Supabase project OR use local PostgreSQL
2. Create schema from `CONSOLIDATED-DB-SCHEMA.sql`
3. Upload consolidated data to new DB
4. Test queries work on new DB
5. Update `.env` with new DB credentials

### ⏳ Phase 3: Feature Flag/Switch
**Goal:** Add toggle to switch between old vs new

1. Add `USE_CONSOLIDATED_DB=false` to `.env`
2. Create switch logic in middleware
3. When flag=false → old DBs (current behavior)
4. When flag=true → new consolidated DB

### ⏳ Phase 4: API Routes & Integration
**Goal:** Wire up consolidated DB to API

1. Create consolidated routes
2. Update server.js with feature flag logic
3. Add sync daemon for dual-write updates
4. Full testing before production

---

## Commit Strategy

Each phase = separate commits:

**Phase 1:**
- Commit: "feat: Create consolidated database merge script"
- Commit: "feat: Generate consolidated-master.json"

**Phase 2:**
- Commit: "feat: Add new Supabase project schema"
- Commit: "feat: Load consolidated data to new DB"

**Phase 3:**
- Commit: "feat: Add USE_CONSOLIDATED_DB feature flag"
- Commit: "feat: Add feature flag middleware"

**Phase 4:**
- Commit: "feat: Add consolidated DB routes"
- Commit: "feat: Wire up API to use feature flag"
- Commit: "feat: Add sync daemon for dual-write"

---

## Ready to Proceed?

**Start with Phase 1:** Create consolidation & merge script
