#!/usr/bin/env node
/**
 * Import Cosmos Restaurant & Bar menu into GCR database
 * This creates a complete test entity with full menu structure
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize GCR Supabase
const gcrUrl = process.env.GCR_SUPABASE_URL;
const gcrKey = process.env.GCR_SUPABASE_KEY;

if (!gcrUrl || !gcrKey) {
  console.error('❌ Missing GCR_SUPABASE_URL or GCR_SUPABASE_KEY');
  console.error('URL:', gcrUrl ? '✓' : '✗');
  console.error('KEY:', gcrKey ? '✓' : '✗');
  process.exit(1);
}

const gcr = createClient(gcrUrl, gcrKey);

const COSMOS_SLUG = 'cosmos-restaurant-and-bar-orange-beach';

const menuData = {
  entity: {
    name: "Cosmos Restaurant & Bar",
    slug: COSMOS_SLUG,
    entity_type: "food_beverage",
    entity_subtype: "Restaurant",
    description: "Upscale seafood restaurant with sushi bar, craft cocktails, and fine dining in Orange Beach, AL",
    hero_image_url: null,
    address_line_1: "25753 Canal Rd",
    city: "Orange Beach",
    state: "AL",
    zip: "36561",
    phone: "251-948-9663",
    website_url: "https://places.singleplatform.com/cosmos-restaurant-and-bar",
    hours_text: "Mon-Thu 11am-9:30pm, Fri-Sat 11am-10pm, Sun 11am-9:30pm",
    serves_lunch: true,
    serves_dinner: true,
    serves_cocktails: true,
    dine_in: true,
  },
  sections: [
    {
      name: "Lunch Appetizers",
      type: "menu",
      order: 1,
      items: [
        { name: "Crab Claws", description: '"BBQ" in Creole butter or fried with cocktail sauce', price: null, image: null },
        { name: "Firecracker Shrimp", description: "Fried bay shrimp with spicy remoulade", price: 14.00 },
        { name: "Savory Cheesecake", description: "Blue crab, bacon, spinach, Parmesan blend", price: 9.00 },
        { name: "Crab Cakes", description: "Yellow pepper aioli and house remoulade", price: 19.00 },
        { name: "Calamari", description: "Flash fried with housemade marinara", price: 12.00 },
        { name: "Cheese Dip", description: "Swiss, Parmesan, Gruyère blend with pita chips", price: 10.00 },
        { name: "Shrimp Toast", description: "Gulf shrimp on BuzzCatz bread, sweet chili sauce", price: 10.00 },
        { name: "Edamame", description: "Salted and steamed", price: 6.00 },
        { name: "Blue Crab and Corn Calas", description: "Rice fritters with remoulade", price: 10.00 },
        { name: "Tuna Poke Nachos", description: "Gulf tuna with tortilla chips, eel sauce", price: 16.00 },
      ]
    },
    {
      name: "Lunch Salads",
      type: "menu",
      order: 2,
      items: [
        { name: "Sesame Seared Tuna", description: "Yellowfin over greens with ginger soy vinaigrette", price: 16.00 },
        { name: "Caesar Salad", description: "Small or Large", price: 6.00 },
        { name: "Salmon Salad", description: "Grilled Atlantic salmon with honey balsamic", price: 19.00 },
        { name: "Tomato and Burrata Salad", description: "Burrata, tomatoes, basil oil", price: 12.00 },
        { name: "House Salad", description: "Small or Large", price: 5.00 },
        { name: "Cobb Salad", description: "Chicken, eggs, bacon, bleu cheese, avocado", price: 18.00 },
      ]
    },
    {
      name: "Lunch Entrées",
      type: "menu",
      order: 3,
      items: [
        { name: "Fried Gulf Seafood - Shrimp", description: "Gulf shrimp, fried until golden", price: 16.00 },
        { name: "Fried Gulf Seafood - Fish", description: "Fresh fish, fried until golden", price: 16.00 },
        { name: "Fresh Catch", description: "Market price - Grilled, blackened, or fried with rice", price: null },
        { name: "Chicken Roulade", description: "Bacon-wrapped, asparagus, Gruyère", price: 14.00 },
        { name: "Grilled Shrimp", description: "Half dozen Gulf shrimp skewers", price: 14.00 },
      ]
    },
    {
      name: "Lunch Sandwiches",
      type: "menu",
      order: 4,
      items: [
        { name: "Shrimp Po'boy", description: "Fried shrimp with remoulade sauce", price: 14.00 },
        { name: "Fish Po'boy", description: "Fried fish with tartar sauce", price: 17.00 },
        { name: "Hamburger", description: "Certified Angus Beef blend", price: 14.00 },
        { name: "Crab Cake Sandwich", description: "Two cakes with remoulade sauce", price: 16.00 },
      ]
    },
    {
      name: "Lunch Desserts",
      type: "menu",
      order: 5,
      items: [
        { name: "Cosmo's Banana Fritters", description: "Vanilla ice cream, chocolate sauce", price: 9.00 },
        { name: "Peanut Butter Pie", description: "Pretzel crust, fudge sauce", price: 9.00 },
        { name: "Crème Brûlée", description: "Caramelized sugar with berries", price: 9.00 },
        { name: "Key Lime Pie", description: "Real key lime juice, strawberry coulis", price: 9.00 },
        { name: "Bread Pudding", description: "Baked fresh daily", price: 9.00 },
      ]
    },
    {
      name: "Dinner Entrées",
      type: "menu",
      order: 6,
      items: [
        { name: "Scallops", description: "Wild mushroom risotto, spinach, tomato bacon chutney", price: 36.00 },
        { name: "Fried Gulf Seafood - Shrimp", description: "Gulf shrimp, fried until golden", price: 24.00 },
        { name: "Fried Gulf Seafood - Fish", description: "Fresh fish, fried until golden", price: 24.00 },
        { name: "Fresh Catch", description: "Market price - Grilled, blackened, or fried", price: null },
        { name: "Chicken Roulade", description: "Bacon-wrapped, asparagus, Gruyère", price: 25.00 },
        { name: "Pecan Redfish", description: "Pecan-Japanese breadcrumb crust", price: 32.00 },
        { name: "Asian Glazed Tuna", description: "Spice crusted, fried rice, eel sauce", price: 31.00 },
        { name: "Crab Cakes", description: "Two cakes with aioli and remoulade", price: 28.00 },
        { name: "Delmonico Ribeye", description: "14 oz., Yukon potatoes, green beans", price: 43.00 },
        { name: "Filet", description: "8 oz. center cut tenderloin", price: 41.00 },
      ]
    },
    {
      name: "Specialty Cocktails",
      type: "drinks",
      order: 1,
      items: [
        { name: "Cosmo's Cooler", description: "Pineapple rum, cherry, strawberry, pineapple", price: 10.00 },
        { name: "Pama Pomegranate Martini", description: "Citrus vodka, Pama liqueur", price: 11.00 },
        { name: "Sunburnt Peach Martini", description: "Peach vodka, jalapeños, pineapple", price: 12.00 },
        { name: "Espresso Martini", description: "Vanilla vodka, espresso liqueur, cold brew", price: 10.00 },
        { name: "The Orange Beach Grand Margarita", description: "Tequila, Triple Sec, citrus", price: 13.00 },
        { name: "Old Fashioned", description: "Elijah Craig Small Batch Bourbon", price: 16.00 },
        { name: "Larceny Blackberry Smash", description: "Bourbon, blackberry, lemon, mint", price: 13.00 },
      ]
    },
    {
      name: "Sushi Rolls",
      type: "menu",
      order: 7,
      items: [
        { name: "Fried Shrimp Roll", description: "Tempura shrimp, cream cheese, eel sauce", price: 10.00 },
        { name: "Volcano Roll", description: "Tuna, peppers, asparagus, spicy krab", price: 15.00 },
        { name: "Philly Roll", description: "Smoked salmon, cream cheese, avocado", price: 12.00 },
        { name: "Spicy Tuna Roll", description: "Spicy tuna, cucumber, spicy mayo", price: 12.00 },
        { name: "California Roll", description: "Krab, carrots, cucumber, avocado", price: 11.00 },
        { name: "Dragon Roll", description: "Fried shrimp, eel, eel sauce", price: 15.00 },
        { name: "The Cosmo Roll", description: "Fried shrimp, steak, spicy tuna, all toppings", price: 20.00 },
      ]
    },
    {
      name: "Happy Hour Specials",
      type: "happy_hour",
      order: 1,
      items: [
        { name: "Domestic Beers", description: "Urban South, PBR, Luna's House Brew", price: 2.50 },
        { name: "Well Drinks", description: "Classic cocktails with well spirits", price: 3.50 },
        { name: "House Wine", description: "Cabernet or Chardonnay", price: 3.00 },
        { name: "Original Cosmo", description: "House specialty cocktail", price: 5.00 },
        { name: "Firecracker Shrimp", description: "Happy Hour appetizer special", price: 8.00 },
        { name: "Cheese Dip", description: "Happy Hour appetizer special", price: 8.00 },
      ]
    },
  ]
};

async function importMenu() {
  console.log('\n' + '='.repeat(60));
  console.log('🍽️  IMPORTING COSMOS RESTAURANT MENU');
  console.log('='.repeat(60) + '\n');

  try {
    // Check if entity exists
    const { data: existing } = await gcr
      .from('entity')
      .select('id')
      .eq('slug', COSMOS_SLUG)
      .single();

    let entityId;
    if (existing) {
      entityId = existing.id;
      console.log(`✓ Entity exists: ${entityId}\n`);
    } else {
      // Create entity
      const { data, error } = await gcr
        .from('entity')
        .insert([menuData.entity])
        .select('id')
        .single();

      if (error) throw new Error(`Entity insert failed: ${error.message}`);
      entityId = data.id;
      console.log(`✓ Created entity: ${entityId}\n`);
    }

    // Insert sections and items
    let sectionCount = 0;
    let itemCount = 0;

    for (const section of menuData.sections) {
      const sectionKey = section.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      const { data: sectionData, error: sectionError } = await gcr
        .from('entity_sections')
        .insert([{
          entity_id: entityId,
          section_key: sectionKey,
          section_label: section.name,
          section_type: section.type,
          sort_order: section.order,
        }])
        .select('id')
        .single();

      if (sectionError) throw new Error(`Section insert failed: ${sectionError.message}`);
      const sectionId = sectionData.id;
      sectionCount++;

      // Insert items for this section
      const items = section.items.map((item, idx) => ({
        section_id: sectionId,
        item_name: item.name,
        item_description: item.description,
        price_numeric: item.price,
        sort_order: idx,
      }));

      const { error: itemsError } = await gcr
        .from('section_items')
        .insert(items);

      if (itemsError) throw new Error(`Items insert failed: ${itemsError.message}`);
      itemCount += items.length;
    }

    console.log(`✓ Created ${sectionCount} menu sections`);
    console.log(`✓ Created ${itemCount} menu items\n`);

    console.log('='.repeat(60));
    console.log('✅ IMPORT COMPLETE!\n');
    console.log(`Test URL:`);
    console.log(`https://cybercheck-links.vercel.app/qr-menu-simple.html?slug=${COSMOS_SLUG}`);
    console.log(`\nWith PIN (test PIN: 1234):`);
    console.log(`https://cybercheck-links.vercel.app/qr-menu-simple.html?slug=${COSMOS_SLUG}&pin=1234\n`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

importMenu();
