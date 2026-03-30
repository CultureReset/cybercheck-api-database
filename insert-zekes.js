require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const SITE_ID = uuidv4();

async function run() {
  const { error: e1 } = await supabase.from('businesses').insert({
    site_id: SITE_ID, name: "Zeke's Landing Marina", type: 'things-to-do',
    subdomain: 'zekes-landing-marina', status: 'active', gcr_listed: true,
    gcr_verified: false, emoji: '🎣',
    tagline: 'Fishing Charters & Cruises in Orange Beach, AL',
    featured: false,
    tags: ['fishing charters','marina','offshore fishing','inshore fishing','dolphin cruises','sunset cruises','family-friendly','party boat','restaurant','waterfront','orange-beach'],
    price_range: '$$', rating: 5, review_count: 4,
    happy_hour: 'false', kids_friendly: true, pet_friendly: false,
    live_music: false, outdoor: true, reservations: true, alcohol: true,
    booking_required: true, delivery: false, takeout: false,
    waterfront: true, beachfront: false, sort_order: 0,
  });
  if (e1) { console.error('BIZ:', e1.message); return; }
  console.log('✅ Business inserted', SITE_ID);

  const { error: e2 } = await supabase.from('site_content').insert({
    site_id: SITE_ID,
    address: '26619 Perdido Beach Boulevard', city: 'Orange Beach', state: 'AL', zip: '36561',
    contact_phone: '(251) 981-4044', contact_email: 'info@zekeslanding.com',
    website_url: 'https://www.zekeslanding.com',
    about_text: "Zeke's Landing and Marina sits just across the street from some of the most beautiful beaches in the country — a mere 10-minute boat ride from the Gulf of Mexico. Zeke's proudly hosts the largest charter fleet on the Gulf, offering inshore and offshore fishing, dolphin cruises, sunset cruises, dry dock storage, a dock store, and the famous hook-and-cook restaurant.",
    seo_description: "Orange Beach's premier fishing charter marina with the largest fleet on Alabama's Gulf Coast.",
    hours: {
      monday: '6:00 AM – 9:00 PM', tuesday: '6:00 AM – 9:00 PM',
      wednesday: '6:00 AM – 9:00 PM', thursday: '6:00 AM – 9:00 PM',
      friday: '6:00 AM – 9:00 PM', saturday: '6:00 AM – 9:00 PM', sunday: '6:00 AM – 9:00 PM'
    },
    hours_note: "Closed Thanksgiving, Christmas, and New Year's Day",
    social_links: { instagram: '@zekesmarina', facebook: "Zeke's Landing", website: 'https://www.zekeslanding.com' },
  });
  if (e2) { console.error('CONTENT:', e2.message); return; }
  console.log('✅ Site content inserted');

  const { error: e3 } = await supabase.from('fleet_types').insert([
    { site_id: SITE_ID, active: true, available: true, sort_order: 1, name: "Zeke's Tiki Queen", description: "Unforgettable cruise on serene back bays searching for dolphins, manatees, and coastal birds.", image_url: 'https://www.zekeslanding.com/wp-content/uploads/sites/7671/2025/01/ZekesTikiQueen-768x809-1.jpg', specs: { type: 'Back Bay Cruising', price_from: 50, price_private: 500, duration: '1.5 – 6 Hours', capacity: 'Up to 18 Passengers', ages: 'All Ages' } },
    { site_id: SITE_ID, active: true, available: true, sort_order: 2, name: 'Sunset Cruise', description: 'Orange Beach sunset cruise aboard a 28-foot Parker with cabin and bathroom, from Cotton Bayou around Ono Island.', image_url: 'https://www.zekeslanding.com/wp-content/uploads/sites/7671/2025/01/Private-Sunset-Cruise-image-1.jpg', specs: { type: 'Cruising', price_from: 600, duration: '2.5 Hours', capacity: 'Up to 6 Passengers', ages: 'All Ages' } },
    { site_id: SITE_ID, active: true, available: true, sort_order: 3, name: 'Dolphin Cruise', description: 'Witness dolphins in their natural habitat against pristine turquoise waters for cherished memories.', image_url: 'https://www.zekeslanding.com/wp-content/uploads/sites/7671/2025/02/dolphintales.jpg', specs: { type: 'Wildlife Cruise', price_from: 18, duration: '1.5 Hours', capacity: 'Varied', ages: 'All Ages' } },
    { site_id: SITE_ID, active: true, available: true, sort_order: 4, name: 'Shared Expense Deep Sea Fishing', description: 'Join a remarkable fishing trip shared with others — enjoy the experience without footing the entire bill.', image_url: 'https://www.zekeslanding.com/wp-content/uploads/sites/7671/2025/01/Shared-Expense-Deep-Sea-Fishing-image-2.jpg', specs: { type: 'Offshore Fishing', price_from: 250, duration: '6 – 36 Hours', capacity: 'Up to 15 Passengers', tag: 'GREAT VALUE' } },
    { site_id: SITE_ID, active: true, available: true, sort_order: 5, name: "Zeke's Lady Party Boat", description: "Unforgettable fishing experience aboard the premier party fishing boat departing daily.", image_url: 'https://www.zekeslanding.com/wp-content/uploads/sites/7671/2025/01/Zekes-Lady-Party-Boat-image-1.jpg', specs: { type: 'Party Boat Fishing', price_from: 125, duration: '6 – 8 Hours', capacity: 'Up to 45 Passengers' } },
    { site_id: SITE_ID, active: true, available: true, sort_order: 6, name: 'Sea Hunter Offshore Charter', description: "62' Resmondo boat with all equipment — bait, tackle, rods, reels, and fishing licenses included.", image_url: 'https://www.zekeslanding.com/wp-content/uploads/sites/7671/2025/01/Sea-Hunter-image-1.jpg', specs: { type: 'Offshore Fishing', price_from: 2850, duration: '6 – 44 Hours', capacity: 'Up to 28 Passengers', tag: 'MOST POPULAR', includes: ['Bait','Tackle','Rods & Reels','Fishing Licenses'] } },
    { site_id: SITE_ID, active: true, available: true, sort_order: 7, name: 'Inshore Fishing Private Charter', description: 'Fishing in serene back bay areas — ideal for families with small children or those prone to sea sickness.', specs: { type: 'Inshore Fishing' } },
    { site_id: SITE_ID, active: true, available: true, sort_order: 8, name: 'Offshore Fishing Private Charter', description: 'Target larger fish on private offshore charters with the largest charter fleet on the island.', specs: { type: 'Offshore Fishing' } },
  ]);
  if (e3) { console.error('FLEET:', e3.message); return; }
  console.log('✅ 8 charters inserted');

  const { error: e4 } = await supabase.from('reviews').insert([
    { site_id: SITE_ID, active: true, customer_name: 'April C.', rating: 5, source: 'Google', text: "Captain Colby was amazing! He shared his knowledge of the area, fishing hot spots, and was very patient with our kids. Our family had a great fishing experience, great catches for the day, and made lots of great memories! Highly recommend them, we will definitely be back!" },
    { site_id: SITE_ID, active: true, customer_name: 'Kim R.', rating: 5, source: 'Tripadvisor', text: "Such an amazing adventure! The captain and mate made sure our trip was a memorable experience. We caught our snapper limit, along with some bonus fish. My son reeled in an amberjack and fought a huge snapper that he lost to a shark! Zero complaints. We'll be back!" },
    { site_id: SITE_ID, active: true, customer_name: 'Bart B.', rating: 5, source: 'Facebook', text: "Zeke's Landing is the best marina on the Alabama Gulf Coast! I've been fishing out of this marina since the 1980's. Zeke's restaurant also offers 'hook and cook'. It's truly a 5-star experience every time. The best place to watch sunsets, too!" },
    { site_id: SITE_ID, active: true, customer_name: 'Dan W.', rating: 5, source: 'Tripadvisor', text: "My son and I had a wonderful experience. Captain Ricky was great and definitely put us on the fish, and deckhands Jamie and Rhett were terrific. We did an 8-hour trip and loved it. Would highly recommend it and hope to do it again one day!" },
  ]);
  if (e4) { console.error('REVIEWS:', e4.message); return; }
  console.log('✅ 4 reviews inserted');

  console.log("\n🎉 Done! site_id:", SITE_ID);
  console.log("Things-to-do page: https://gcr-rosy.vercel.app/things-to-do.html");
  console.log("Profile page: https://gcr-rosy.vercel.app/business.html?slug=zekes-landing-marina");
}
run();
