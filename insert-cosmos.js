require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const slug = 'cosmos-restaurant';

async function insert() {
  // 1. Check if already exists
  const { data: existing } = await sb
    .from('businesses')
    .select('site_id')
    .eq('subdomain', slug)
    .single();

  let siteId;

  if (existing) {
    siteId = existing.site_id;
    console.log('Updating existing business:', siteId);
    await sb.from('businesses').update({
      name: "Cosmo's Restaurant & Bar",
      type: 'restaurants',
      status: 'active',
      gcr_listed: true,
      featured: false
    }).eq('site_id', siteId);
  } else {
    console.log('Inserting new business...');
    const { data: biz, error } = await sb.from('businesses').insert({
      name: "Cosmo's Restaurant & Bar",
      type: 'restaurants',
      subdomain: slug,
      plan: 'free',
      status: 'active',
      gcr_listed: true,
      featured: false
    }).select().single();
    if (error) { console.error('Business insert error:', error); process.exit(1); }
    siteId = biz.site_id;
    console.log('Created business with site_id:', siteId);
  }

  // 2. Upsert site_content — full data using real columns
  const { error: contentErr } = await sb.from('site_content').upsert({
    site_id: siteId,
    hero_text: "Far From Ordinary",
    hero_subtext: "Fresh, eclectic dining on Canal Road in Orange Beach — hand-cut steaks, local seafood, sushi, pasta, and award-winning dishes.",
    about_text: "Off the beaten path on Canal Road in Orange Beach, Cosmo's Restaurant & Bar is far from ordinary. Serving fresh and eclectic food since day one, Cosmo's features a wide range of dining — from hand-cut steaks to local seafood and pasta. This neighborhood favorite on the Gulf Coast has taken cuisine to the cutting edge. Culinary greats such as the chicken roulade, the sesame seared tuna salad, and the traditional crab cakes done with a twist will have you wanting more. The Year of Alabama Food named their Banana Leaf Wrapped Fish as one of 'the top 100 dishes to eat before you die.' Happy Hour is served daily 3–5 PM featuring draft beer, house wines, delicious appetizers, $2 off all sushi rolls, and the famous Firecracker Shrimp.",
    seo_description: "Orange Beach's award-winning restaurant on Canal Road. Local seafood, hand-cut steaks, sushi, and pasta. Happy Hour daily 3–5 PM. Home of the Banana Leaf Wrapped Fish — named top 100 dishes to eat before you die.",
    address: '25753 Canal Rd',
    city: 'Orange Beach',
    state: 'AL',
    zip: '36561',
    contact_phone: '251-948-9663',
    website_url: 'http://www.cosmosrestaurantandbar.com/',
    logo_url: 'https://cosmosrestaurantandbar.com/wp-content/uploads/2021/07/cosmos-logo.png',
    cover_url: 'https://cosmosrestaurantandbar.com/wp-content/uploads/2021/07/cosmos-tall.jpg',
    hours: 'Sun–Thu 11am–9:30pm · Fri–Sat 11am–10pm',
    hours_note: 'Happy Hour daily 3–5 PM · Closed major holidays',
    gallery: [
      'https://cosmosrestaurantandbar.com/wp-content/uploads/2021/07/cosmos-tall.jpg',
      'https://cosmosrestaurantandbar.com/wp-content/uploads/2021/07/grilled-shrimp-6.jpg',
      'https://cosmosrestaurantandbar.com/wp-content/uploads/2021/08/0250.jpg',
      'https://cosmosrestaurantandbar.com/wp-content/uploads/2020/03/cosmos.jpg'
    ],
    social_links: {
      website: 'http://www.cosmosrestaurantandbar.com/',
      facebook: 'https://www.facebook.com/cosmosrestaurantandbar'
    },
    whats_included: [
      '🦞 Fresh local Gulf seafood',
      '🥩 Hand-cut steaks',
      '🍣 Sushi & sushi rolls',
      '🍝 Housemade pasta',
      '🍻 Happy Hour daily 3–5 PM',
      '🎵 Live music & events',
      '🛍️ Maggie\'s Gift Shop on-site',
      '🍽️ Full catering services available'
    ],
    features: [
      { label: 'Happy Hour', value: 'Daily 3–5 PM', icon: '🍻' },
      { label: 'Price Range', value: '$$$', icon: '💰' },
      { label: 'Cuisine', value: 'Seafood · Steaks · Sushi · Pasta', icon: '🍽️' },
      { label: 'Award', value: 'Top 100 Dishes — Banana Leaf Wrapped Fish', icon: '🏆' },
      { label: 'Seating', value: 'Dine-in · Catering', icon: '🪑' },
      { label: 'Live Music', value: 'Events & live music regularly', icon: '🎵' }
    ],
    qna: [
      { q: 'What are your Happy Hour specials?', a: 'Happy Hour is daily 3–5 PM featuring specials on draft beer, house wines, delicious appetizers, $2 off all sushi rolls, and our famous Firecracker Shrimp.' },
      { q: 'What is the most famous dish?', a: 'Our Banana Leaf Wrapped Fish was named one of "the top 100 dishes to eat before you die" by the Year of Alabama Food.' },
      { q: 'Do you offer catering?', a: 'Yes! Alabama Coastal Catering is available. Visit our website for more information.' },
      { q: 'Where are you located?', a: '25753 Canal Rd, Orange Beach, AL — off the beaten path, but worth the trip!' },
      { q: 'What are your hours?', a: 'Sunday through Thursday 11am–9:30pm, Friday and Saturday 11am–10pm.' }
    ]
  }, { onConflict: 'site_id' });

  if (contentErr) { console.error('site_content error:', contentErr); process.exit(1); }
  console.log('✅ site_content upserted');

  // 3. Insert specials
  await sb.from('specials').delete().eq('site_id', siteId);
  const { error: specErr } = await sb.from('specials').insert([
    {
      site_id: siteId,
      name: '🍻 Happy Hour',
      description: 'Daily 3–5 PM · Draft beer specials · House wine specials · Appetizer deals · $2 off ALL sushi rolls · Famous Firecracker Shrimp',
      active: true,
      sort_order: 0
    },
    {
      site_id: siteId,
      name: '🔥 Firecracker Shrimp',
      description: 'Cosmo\'s most famous appetizer — available at Happy Hour and beyond. A local favorite that made us famous!',
      active: true,
      sort_order: 1
    },
    {
      site_id: siteId,
      name: '🎵 Live Music & Events',
      description: 'Regular live music and special events. Check our website for the full schedule.',
      active: true,
      sort_order: 2
    }
  ]);
  if (specErr) console.warn('⚠️  Specials warning:', specErr.message);
  else console.log('✅ Specials inserted');

  // 4. Insert full menu
  await sb.from('menu_items').delete().eq('site_id', siteId);
  const { error: menuErr } = await sb.from('menu_items').insert([
    // Starters
    { site_id: siteId, name: 'Crab Cakes', description: 'Traditional crab cakes done with a Cosmo\'s twist — a Gulf Coast signature starter', category: 'Starters', available: true, sort_order: 1 },
    { site_id: siteId, name: 'Tuna Poke Nachos', description: 'Fresh tuna poke served over crispy tortilla chips — a Gulf Coast crowd favorite', category: 'Starters', available: true, sort_order: 2 },
    { site_id: siteId, name: 'Sesame Seared Tuna Salad', description: 'Chef-inspired salad featuring sesame-crusted seared fresh tuna', category: 'Starters', available: true, sort_order: 3 },
    { site_id: siteId, name: 'Firecracker Shrimp', description: '🔥 The dish that made Cosmo\'s famous. Available all day and featured during Happy Hour 3–5 PM', category: 'Starters', tags: ['happy-hour', 'fan-favorite'], available: true, sort_order: 4 },
    // Happy Hour
    { site_id: siteId, name: 'Happy Hour Draft Beer', description: 'Specials on all draft beer — served daily 3–5 PM', category: 'Happy Hour', tags: ['happy-hour'], available: true, sort_order: 10 },
    { site_id: siteId, name: 'Happy Hour House Wine', description: 'Specials on house wines — served daily 3–5 PM', category: 'Happy Hour', tags: ['happy-hour'], available: true, sort_order: 11 },
    { site_id: siteId, name: 'Sushi Rolls — $2 Off', description: '$2 off ALL sushi rolls during Happy Hour, daily 3–5 PM', category: 'Happy Hour', tags: ['happy-hour'], available: true, sort_order: 12 },
    { site_id: siteId, name: 'Happy Hour Appetizers', description: 'Specials on select appetizers every day 3–5 PM', category: 'Happy Hour', tags: ['happy-hour'], available: true, sort_order: 13 },
    // Entrées
    { site_id: siteId, name: 'Banana Leaf Wrapped Fish', description: '🏆 Named one of "the top 100 dishes to eat before you die" by the Year of Alabama Food. A true Gulf Coast masterpiece.', category: 'Entrées', tags: ['award-winning', 'signature'], available: true, sort_order: 20 },
    { site_id: siteId, name: 'Chicken Roulade', description: 'A Cosmo\'s culinary signature — elegantly stuffed and rolled chicken with chef-inspired ingredients', category: 'Entrées', tags: ['signature'], available: true, sort_order: 21 },
    { site_id: siteId, name: 'Seafood Pasta', description: 'Fresh local Gulf seafood tossed with housemade pasta — a neighborhood favorite', category: 'Entrées', available: true, sort_order: 22 },
    { site_id: siteId, name: 'Asian Glazed Tuna', description: 'Premium fresh tuna with a sweet and savory Asian glaze — a chef-inspired Gulf Coast creation', category: 'Entrées', available: true, sort_order: 23 },
    { site_id: siteId, name: 'Pork Chop', description: 'Hand-cut pork chop prepared with chef-inspired seasonings and sides', category: 'Entrées', available: true, sort_order: 24 },
    { site_id: siteId, name: 'Hand-Cut Steaks', description: 'Premium hand-cut steaks prepared to order — a Cosmo\'s specialty', category: 'Entrées', available: true, sort_order: 25 },
    // Desserts
    { site_id: siteId, name: 'Key Lime Pie', description: 'Classic Florida-style key lime pie — cool, tart, and perfectly creamy', category: 'Desserts', available: true, sort_order: 30 },
    { site_id: siteId, name: 'Banana Fritters', description: 'Golden fried bananas — a sweet Gulf Coast finish to your meal', category: 'Desserts', available: true, sort_order: 31 }
  ]);
  if (menuErr) console.warn('⚠️  Menu items warning:', menuErr.message);
  else console.log('✅ Menu items inserted (16 items across Starters, Happy Hour, Entrées, Desserts)');

  console.log('\n🎉 Done! Cosmo\'s is now live in Supabase.');
  console.log('   Slug:', slug);
  console.log('   Site ID:', siteId);
  console.log('   GCR profile: https://gcr-rosy.vercel.app/business.html?id=' + slug);
}

insert().catch(console.error);
