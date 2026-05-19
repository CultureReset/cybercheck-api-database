# GCR Business Entities Export - Complete Audit

## Files Created

### 1. **GCR-ACTIVE-ENTITIES-AUDIT.xlsx** ⭐ RECOMMENDED
- **921 ACTIVE entities** currently displaying on launching-gcr
- **2 sheets:**
  - **Summary** - Quick reference (Name, Type, City, Phone, Email, Address, Counts)
  - **Full Details** - All information including events, specials, tags, sections, hours, social links
- **Use this for:** Adding menus and managing entities that are live
- **Size:** 1.6MB

### 2. **GCR-ENTITIES-FULL-AUDIT.xlsx**
- **1000 total entities** (all, including inactive)
- **Single sheet** with complete data
- **Use this for:** Comprehensive inventory of all entities
- **Size:** 1.2MB

### 3. **ALL-ENTITIES-COMPLETE.xlsx**
- **1000 total entities** (optimized earlier export)
- **Use this as:** Backup/alternative format
- **Size:** 1.7MB

---

## Data Included (Excluding Images)

✓ Entity UUID
✓ Name, Type, Subtype
✓ Description
✓ Full Address (Street, City, State, Zip)
✓ Phone, Email, Website
✓ Hours (Monday-Sunday with Open/Close times)
✓ Social Media (Instagram, Facebook, Twitter, TikTok, YouTube)
✓ Google Business ID
✓ Event Count + Full Event List (Name, Date, Description)
✓ Special Count + Full Specials List (Name, Type, Description)
✓ Content Sections + Section Types
✓ Tags (All tags for each entity)
✓ Status (ACTIVE/INACTIVE)
✓ Created/Updated Dates

❌ Photos/Images (excluded as requested)

---

## Summary Statistics

### Active Entities (921):
- 58 with Events
- 12 with Specials
- 129 with Tags
- 69 with Content Sections
- **0 with Menus** (no menu data in system yet)

### All Entities (1000):
- 524 ACTIVE
- 476 INACTIVE

---

## How to Use for Adding Menus

### Option 1: Add Menus One at a Time
1. Open **GCR-ACTIVE-ENTITIES-AUDIT.xlsx**
2. Go to **Summary** sheet
3. Pick an entity by Name
4. Find it in **Full Details** sheet to verify address/details
5. Use the entity UUID to add menu items via admin dashboard or API

### Option 2: Bulk Import (via script)
We can create a script that:
- Reads menu data from your source
- Maps entities by name/address/UUID
- Bulk imports menu items to the correct entity_id
- Contact me for this script if needed

### Option 3: CSV Template
We can create a template CSV for menu uploads with the format:
```
Entity UUID | Entity Name | Menu Section | Item Name | Description | Price
```

---

## Scripts Available

```bash
# Create all 3 exports (takes ~30 seconds)
node agents/export-entities-with-data.js          # 1000 all entities
node agents/export-active-entities-only.js        # 921 active only

# Other available scripts
node agents/export-entities-optimized.js          # Batch query version
```

---

## Database Summary

### Tables with Data:
- `entity` - 1000 total, 921 active
- `entity_events` - 1000 events total
- `entity_specials` - 77 specials
- `entity_tags` - 32,070 tags
- `entity_sections` - 158 content sections
- `entity_features` - 0 features

### Tables Empty:
- `menu_sections` - 0 (no menus)
- `menu_items` - 0 (no menus)
- `drink_sections` - 0 (no drinks)
- `drink_items` - 0 (no drinks)
- `happy_hour_sections` - 0
- `entity_photos` - 0 (images excluded)

---

## Next Steps

1. **Review the data** in GCR-ACTIVE-ENTITIES-AUDIT.xlsx
2. **Identify missing information** (descriptions, phone, hours, etc.)
3. **Plan menu import strategy** - do you have menu data to import?
4. **Let me know:** What's your workflow for adding menus? (CSV import, manual, bulk API?)

---

**Generated:** 2026-05-18
**Database:** GCR Supabase
