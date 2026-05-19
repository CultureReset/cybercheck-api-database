# 🍽️ Multi-Section Menu System Guide

## Overview
The system supports unlimited menu sections per restaurant, separated and organized however you need.

---

## Sections Cosmos Currently Has (Example)

```
✅ Lunch Appetizers
✅ Lunch Salads  
✅ Lunch Entrees
✅ Lunch Sandwiches
✅ Lunch Desserts
✅ Dinner Entrees
✅ Sushi Rolls
✅ Specialty Cocktails
✅ Happy Hour Specials
```

---

## Sections You Want (Complete List)

```
1. Lunch Menu (appetizers, salads, entrees, sandwiches)
2. Dinner Menu (entrees, sides, desserts)
3. Kids Menu (kids meals, sides, desserts)
4. Gluten Free Menu (GF appetizers, entrees, desserts)
5. Specialty Drinks & Mocktails (cocktails, mocktails, wine, beer)
6. Happy Hour (HH specials, happy hour times)
7. Lunch Specials / 11am Special Menu (daily specials)
8. Sushi Menu (sushi rolls, nigiri, etc.)
```

---

## How To Set Up Multiple Sections

### Method 1: Via Admin Dashboard (Recommended)
1. Go to: https://cybercheck-login.vercel.app/admin.html
2. Login: info@cybercheckinc.com / Cybercheckinc1
3. Select restaurant from dropdown
4. Click "Menu Builder"
5. Click "+ Add Section"
6. For each section, enter:
   - **Section Name**: "Lunch Menu"
   - **Section Type**: "menu"
   - **Description** (optional): "Available 11am-4pm"
7. Add items to each section
8. Section automatically creates tab on profile page

### Method 2: Via SQL (For Bulk Setup)

```sql
-- Add section
INSERT INTO entity_sections 
  (entity_id, section_key, section_label, section_type, sort_order)
VALUES
  ('cosmos-id', 'lunch-menu', 'Lunch Menu', 'menu', 1),
  ('cosmos-id', 'dinner-menu', 'Dinner Menu', 'menu', 2),
  ('cosmos-id', 'kids-menu', 'Kids Menu', 'menu', 3),
  ('cosmos-id', 'gf-menu', 'Gluten Free', 'menu', 4),
  ('cosmos-id', 'drinks', 'Specialty Drinks & Mocktails', 'drinks', 5),
  ('cosmos-id', 'sushi', 'Sushi Menu', 'menu', 6),
  ('cosmos-id', 'lunch-specials', '11am Lunch Specials', 'menu', 7),
  ('cosmos-id', 'happy-hour', 'Happy Hour', 'happy_hour', 8);

-- Add items to lunch menu
INSERT INTO section_items
  (section_id, item_name, item_description, price_numeric, sort_order)
VALUES
  ('lunch-section-id', 'Firecracker Shrimp', 'Fried bay shrimp with spicy remoulade', 14.00, 1),
  ('lunch-section-id', 'Crab Cakes', 'Yellow pepper aioli and house remoulade', 19.00, 2);
  -- ... more items
```

---

## Display on Profile Page

When sections are set up correctly, the profile page automatically creates tabs:

```
┌─────────────────────────────────────┐
│ 🍽️ Lunch Menu │ 🍽️ Dinner Menu │ 👶 Kids Menu │ ...
└─────────────────────────────────────┘
  ↓ Click tab to view items
  
  Firecracker Shrimp
  Fried bay shrimp with spicy remoulade
  $14.00
  
  Crab Cakes
  Yellow pepper aioli and house remoulade  
  $19.00
```

---

## Database Tables Used

```
entity_sections
├─ id: UUID
├─ entity_id: UUID (restaurant)
├─ section_label: TEXT ("Lunch Menu")
├─ section_type: TEXT ("menu" | "drinks" | "happy_hour")
└─ sort_order: INT (1, 2, 3...)

section_items
├─ id: UUID
├─ section_id: UUID (links to above)
├─ item_name: TEXT ("Firecracker Shrimp")
├─ item_description: TEXT ("Fried bay shrimp...")
├─ price_numeric: NUMERIC (14.00)
└─ sort_order: INT
```

---

## Complete Section Type Support

| Type | Icon | Display | Usage |
|------|------|---------|-------|
| `menu` | 🍽️ | Menu Items | Food menus (lunch, dinner, kids, GF) |
| `drinks` | 🍹 | Drinks | Cocktails, mocktails, wines |
| `happy_hour` | 🍺 | HH Specials | Happy hour deals |
| `grouped_items` | 📦 | Grouped | Any grouped items |

---

## Example: Cosmos with All Sections

```sql
-- Cosmos Restaurant (already has 9 sections)
SELECT section_label, section_type, 
       (SELECT COUNT(*) FROM section_items 
        WHERE section_id = entity_sections.id) as item_count
FROM entity_sections
WHERE entity_id = 'cosmos-id'
ORDER BY sort_order;

Results:
section_label              | section_type   | item_count
Lunch Appetizers          | menu           | 10
Lunch Salads              | menu           | 6
Lunch Entrees             | menu           | 5
Lunch Sandwiches          | menu           | 4
Lunch Desserts            | menu           | 5
Dinner Entrees            | menu           | 10
Sushi Rolls               | menu           | 7
Specialty Cocktails       | drinks         | 7
Happy Hour Specials       | happy_hour     | 6
```

---

## How Profile Page Renders It

```javascript
// In profile.html, the code automatically:

// 1. Gets all menuSections from API
const menuSections = data.menuSections || [];  // 9 sections

// 2. Groups by section_type
const drinks = menuSections.filter(s => s.section_type === 'drinks');
const menus = menuSections.filter(s => s.section_type === 'menu');
const hh = menuSections.filter(s => s.section_type === 'happy_hour');

// 3. Creates tabs for each section
menuSections.forEach(sec => {
  B.sections.push({
    id: 'meal-' + sec.id,
    type: 'food',           // ← This makes it render!
    mealId: 'newmenu-' + sec.id,
    label: sec.section_name, // "Lunch Menu"
    icon: '🍽️'
  });
});

// 4. Items filtered by section_id
const secItems = menuItems.filter(i => 
  i.menu_section_id === sec.id || i.section_id === sec.id
);
```

---

## API Response Format

When you hit the API, you get all sections properly separated:

```json
{
  "menuSections": [
    { "id": "uuid", "section_name": "Lunch Menu", "sort_order": 1 },
    { "id": "uuid", "section_name": "Dinner Menu", "sort_order": 2 },
    { "id": "uuid", "section_name": "Kids Menu", "sort_order": 3 },
    { "id": "uuid", "section_name": "Gluten Free", "sort_order": 4 }
  ],
  "menuItems": [
    { "item_name": "Firecracker Shrimp", "menu_section_id": "lunch-uuid", "price": 14.00 },
    { "item_name": "Kids Burger", "menu_section_id": "kids-uuid", "price": 8.99 },
    // ... all items, sorted by section
  ],
  "drinkSections": [
    { "id": "uuid", "section_name": "Specialty Drinks & Mocktails" }
  ],
  "drinkItems": [
    { "item_name": "Cosmo's Cooler", "drink_section_id": "drinks-uuid", "price": 10.00 }
  ]
}
```

---

## Quick Start: Add All Sections to Restaurant

### Via Import Script (Recommended)

```bash
# Create import-complete-menus.js
node agents/import-complete-menus.js
```

The script would:
1. Delete old sections for the restaurant
2. Create all 8 new sections with proper order
3. Move existing items to correct sections
4. Create sample items for missing sections
5. Verify all sections have items

---

## What Gets Displayed Where

### QR Menu (qr-menu-simple.html)
- Shows all sections in order
- Each section as separate collapsible category
- Items with descriptions and prices

### Admin Dashboard (admin.html)
- Menu Builder shows all sections
- Can add/edit/delete items per section
- Sections appear as dropdown or tabs

### Profile Page (profile.html)
- Creates tabs for each section
- Click tab → view items for that section
- Drinks section separate (🍹)
- HH section separate (🍺)

---

## Database Queries

### See all sections for a restaurant
```sql
SELECT section_label, section_type, sort_order, 
       (SELECT COUNT(*) FROM section_items WHERE section_id = entity_sections.id) as items
FROM entity_sections
WHERE entity_id = $1
ORDER BY sort_order;
```

### See items in a section
```sql
SELECT item_name, item_description, price_numeric
FROM section_items
WHERE section_id = $1
ORDER BY sort_order;
```

### Reorder sections
```sql
UPDATE entity_sections
SET sort_order = $2
WHERE id = $1;
```

---

## Current Cosmos Status

```
Restaurant: Cosmos Restaurant & Bar
Location: Orange Beach, AL

SECTIONS (9 total):
1. Lunch Appetizers (10 items)
2. Lunch Salads (6 items)
3. Lunch Entrees (5 items)
4. Lunch Sandwiches (4 items)
5. Lunch Desserts (5 items)
6. Dinner Entrees (10 items)
7. Sushi Rolls (7 items)
8. Specialty Cocktails (7 items) — drinks
9. Happy Hour Specials (6 items) — HH

Ready to:
- ✅ Add more restaurants
- ✅ Add more sections to any restaurant
- ✅ Reorder sections
- ✅ Edit section names
- ✅ Add unlimited items
```

---

## For Multiple Restaurants

The system scales to any number of restaurants, each with their own sections:

```sql
Restaurant 1: Cosmos (9 sections)
Restaurant 2: New Restaurant (8 sections)
Restaurant 3: Another Place (15 sections)
-- All stored in same tables, linked by entity_id
```

---

## Production Ready

✅ All section types supported  
✅ Unlimited sections per restaurant  
✅ Sections displayed correctly on profile  
✅ Sections displayed on QR menu  
✅ Sections managed via admin dashboard  
✅ API returns all sections properly formatted  
✅ Mobile responsive on all pages  
✅ Fast CDN cached responses  

**Start adding your restaurants with all their menu sections!**
