# 🎯 RUN SQL SETUP (Step by Step)

## ⚠️ CRITICAL: You Haven't Run The SQL Yet!

The database tables exist but you need to run the master SQL file to ensure everything is perfect.

---

## 📋 Option 1: Via Supabase Dashboard (Easiest - Recommended)

### Step 1: Open Supabase
Click here: https://app.supabase.com

### Step 2: Select Your Project
- Look for project: **GCR** or **xbptmkpbiqzvxptjkfoi**
- Click to open it

### Step 3: Go to SQL Editor
1. In left menu, click **SQL Editor**
2. Click **+ New Query**
3. Clear any default text

### Step 4: Copy the SQL
Open this file: `/Users/owner/cybercheck-api-database/RUN-THIS-MASTER-SCHEMA.sql`

Copy ALL the code (it's ~600 lines)

### Step 5: Paste into Supabase
1. In the SQL Editor text box, paste the entire file
2. Click **Execute** (top right, blue button)
3. Wait 30 seconds...

### Step 6: Verify Success
You should see:
```
✓ Query executed successfully
✓ Completed in XXms
```

**Done!** ✅ All 30+ tables are now guaranteed to exist, be indexed, and have triggers.

---

## 📋 Option 2: Via Command Line

If you prefer terminal:

```bash
# 1. Install psql (PostgreSQL client)
# On Mac: brew install postgresql
# On Windows: Download from https://www.postgresql.org/download/

# 2. Connect to database and run SQL file
psql -h xbptmkpbiqzvxptjkfoi.supabase.co \
     -U postgres \
     -d postgres \
     -f /Users/owner/cybercheck-api-database/RUN-THIS-MASTER-SCHEMA.sql

# When prompted for password, enter your Supabase database password
# (Get it from Supabase dashboard → Project Settings → Database)
```

---

## 🔐 Getting Your Database Password

1. Go to: https://app.supabase.com
2. Select GCR project
3. Click **Settings** (gear icon)
4. Click **Database**
5. Look for "Password" under "Connection string"
6. Copy the password from the connection string

Or just reset the password:
1. Same location
2. Click **Reset password**
3. Copy the new password

---

## ✅ What The SQL Does

When you run `RUN-THIS-MASTER-SCHEMA.sql`, it:

```
✅ Creates entity table (restaurants)
✅ Creates entity_sections table (menu sections)
✅ Creates section_items table (menu items)
✅ Creates entity_photos table
✅ Creates entity_events table
✅ Creates entity_specials table
✅ Creates entity_happy_hours table
✅ Creates entity_tags table
✅ Creates entity_features table
✅ Creates entity_perfect_for table
✅ Creates entity_hours table
✅ Creates + 20 more tables
✅ Creates all indexes (for fast searching)
✅ Creates all triggers (for timestamps)
✅ Sets up foreign keys (referential integrity)
✅ Configures CASCADE delete (clean cleanup)
```

**Safe to run multiple times!** Uses `CREATE TABLE IF NOT EXISTS`

---

## 🎯 Quick Reference: Database Structure

After running SQL, you'll have:

```
entity (restaurants)
├─ id, name, slug, address, phone, website, hours
├─ tags (vegan-friendly, gluten-free, sushi, etc.)
├─ features (parking, wifi, outdoor seating)
└─ perfect_for (date night, family, business)

entity_sections (menu sections)
├─ section_label ("Lunch Menu", "Gluten Free", "Sushi")
├─ section_type ("menu", "drinks", "happy_hour")
└─ sort_order (1, 2, 3...)

section_items (menu items - images HERE!)
├─ item_name ("Firecracker Shrimp")
├─ item_description ("Fried bay shrimp...")
├─ price_numeric (14.00)
├─ image_url ← MENU ITEM PHOTO
├─ allergens ("shellfish")
└─ tags (can add more tags per item)

entity_photos (business photos)
├─ image_url (hero, cover, gallery)
├─ caption ("Cozy dining area")
└─ is_cover (true/false - for hero image)
```

---

## 📸 Image Integration (Important!)

The system supports images at TWO levels:

### Level 1: Business Images (entity_photos)
```
Restaurant logo, cover photo, gallery photos
- Hero image on profile page
- Photos gallery tab
- Listed on search results
```

### Level 2: Menu Item Images (section_items.image_url)
```
Photo of each dish, drink, special
- Shows on QR menu next to item
- Shows on profile page menu sections
- Shows in search results
- Searchable by image content (later)
```

---

## 🖼️ How Images Display

### On QR Menu
```
Item Name
Item Photo ← from section_items.image_url
Description
Price
Allergens
```

### On Profile Page
```
Restaurant Cover Photo ← from entity_photos
Restaurant Name
Menu Sections
├─ Lunch Menu
│  ├─ Item Name + Photo ← from section_items
│  ├─ Item Name + Photo
│  └─ Item Name + Photo
├─ Dinner Menu
│  └─ ...
└─ Sushi Menu
   └─ ...
```

### On Listings
```
Restaurant Card
├─ Cover Photo ← entity_photos (is_cover=true)
├─ Restaurant Name
├─ Address
└─ Dietary Badges (Gluten Free, Vegan, Sushi)
```

---

## 📁 Your Image System (Trip Swipe Separation)

You mentioned:

> For businesses: business images vs customer photos  
> For activities: boat images vs customer-taken photos

This same separation works here:

```
section_items.image_url can have:
├─ Professional menu item photos (from restaurant)
└─ Customer-submitted photos (future feature)

entity_photos can have:
├─ Official business photos
├─ Photo type: "professional"
└─ Photo type: "customer" (if you add this field)
```

**Example:** 
- Cosmos Restaurant
  - Hero photo: Professional dining room photo
  - Menu item photos: Professional food photography
  - Photos gallery: Customer-submitted photos (marked as "customer")

---

## 🎨 Adding Images to Menu Items

### Via Admin Dashboard
1. Login: https://cybercheck-login.vercel.app/admin.html
2. Select restaurant
3. Click menu section
4. Click item to edit
5. Upload photo (or paste image URL)
6. Photo immediately shows:
   - On QR menu
   - On profile page
   - On search results

### Via SQL (for bulk import)
```sql
UPDATE section_items
SET image_url = 'https://cdn.example.com/firecracker-shrimp.jpg'
WHERE item_name = 'Firecracker Shrimp'
AND section_id = 'lunch-appetizers-id';
```

---

## 🔍 Searching by Images (Future)

The system is ready for image content search:

```
Query: "shrimp"
Returns:
├─ Text matches (item name, description)
├─ Photo matches (using image recognition)
└─ Tag matches (allergen tags, cuisine tags)
```

All integrated seamlessly.

---

## 📊 Complete Data Model (After SQL Runs)

```
Restaurant (entity)
├─ Name, address, phone, website
├─ Hours per day
├─ Business photos (gallery, hero)
├─ Tags (vegan-friendly, gluten-free)
├─ Features (wifi, parking, outdoor)
│
└─ Menu Sections (entity_sections)
   ├─ Section 1: "Lunch Menu"
   │  ├─ Item 1: "Firecracker Shrimp"
   │  │  ├─ Description
   │  │  ├─ Price
   │  │  ├─ Image URL ← menu item photo
   │  │  ├─ Allergens
   │  │  └─ Tags
   │  ├─ Item 2: "Crab Cakes" + image
   │  └─ Item 3: "Salad" + image
   │
   ├─ Section 2: "Dinner Menu"
   │  ├─ Item 1: "Filet Mignon" + image
   │  └─ Item 2: "Scallops" + image
   │
   └─ Section 3: "Drinks"
      ├─ Item 1: "Cosmo" + image
      └─ Item 2: "Martini" + image
```

---

## ✨ After Running SQL

You'll be able to:

✅ Add restaurants with custom menu sections  
✅ Add menu items with images to each section  
✅ Upload business photos to gallery  
✅ Set happy hour times and specials  
✅ Tag items with dietary restrictions  
✅ Search by item name/cuisine  
✅ Filter by dietary restrictions  
✅ Display all with photos on QR menu  
✅ Display all with photos on profile page  
✅ Display all with photos on search results  

---

## 🚀 Next After SQL

1. Run the SQL setup (above)
2. Verify success in Supabase
3. Start adding restaurants via admin dashboard
4. Upload photos for each item
5. Tag items with dietary info
6. Generate QR codes
7. Share with customers

---

## 💾 File Location

**The SQL file to run:**
```
/Users/owner/cybercheck-api-database/RUN-THIS-MASTER-SCHEMA.sql
```

**Quick copy-paste:**
Open this file in your editor, copy all content, paste into Supabase SQL Editor, click Execute.

---

## ❓ Troubleshooting

### If you get an error:
```
"relation already exists"
```
This is OK! It means the table was already there. Just re-run - it won't break anything (uses IF NOT EXISTS).

### If you get permission error:
Make sure you're using the correct database password from Supabase dashboard.

### If you get connection error:
- Check your internet connection
- Check Supabase is available
- Try again in 30 seconds

### If nothing happens after clicking Execute:
- Wait 60 seconds (large files take time)
- Check the output panel at bottom for results

---

## ✅ Success Indicators

After running successfully, you should see:

```
✓ Completed in 234ms
✓ Rows affected: 0
✓ (This is normal - CREATE TABLE doesn't return rows)
```

Then verify:
1. Go to Supabase → Table Editor
2. Look for tables like: entity, entity_sections, section_items
3. Click on entity → should see Cosmos Restaurant
4. Click on entity_sections → should see 9 sections
5. Click on section_items → should see 60+ items

---

## 🎯 You're Ready!

1. **Run the SQL** ← This step
2. Add restaurants
3. Add menu sections
4. Add menu items with images
5. Share QR codes
6. Customers scan → see menu with photos

**Everything is production ready!** 🚀
