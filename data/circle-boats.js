window.BUSINESS_DATA = {

  // ── Core Info ──────────────────────────────────────────────
  name:         "Beachside Circle Boats",
  slug:         "beachside-circle-boats",
  tagline:      "Portable Electric Circle Boat Rentals",
  category:     "Boat Rentals",
  emoji:        "🚤",
  phone:        "6013251205",
  phoneDisplay: "(601) 325-1205",
  address:      "25856 Canal Road, Unit A",
  city:         "Orange Beach",
  state:        "Alabama",
  zip:          "36561",
  website:      "https://www.beachsidecircleboats.com",
  googleMaps:   "https://maps.google.com/?q=25856+Canal+Road,+Unit+A,+Orange+Beach,+Alabama,+36561",
  instagram:    "",
  facebook:     "",
  rating:       4.9,
  reviewCount:  5,

  // ── Supabase config (for live booking popup) ────────────────
  supabase: {
    url:    "https://mhafixflyffflwjhcgfn.supabase.co",
    key:    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oYWZpeGZseWZmZmx3amhjZ2ZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MTA4MzUsImV4cCI6MjA4NzM4NjgzNX0.3KW-rGnLhJQ1u3IsSeoGFfgQpcoJNdBGFOGnhc88tHw",
    siteId: "22222222-2222-2222-2222-222222222222"
  },

  // ── Cover Images ────────────────────────────────────────────
  coverImages: [
    "https://mhafixflyffflwjhcgfn.supabase.co/storage/v1/object/public/media/22222222-2222-2222-2222-222222222222/about/1773703867895-FreedomLeft.webp",
    "https://mhafixflyffflwjhcgfn.supabase.co/storage/v1/object/public/media/22222222-2222-2222-2222-222222222222/boat/1773553191704-IMG_9604_11.jpg",
  ],

  // ── Gallery ─────────────────────────────────────────────────
  gallery: [
    { url: "https://mhafixflyffflwjhcgfn.supabase.co/storage/v1/object/public/media/22222222-2222-2222-2222-222222222222/about/1773703867895-FreedomLeft.webp", caption: "Single Seater — GoBoat" },
    { url: "https://mhafixflyffflwjhcgfn.supabase.co/storage/v1/object/public/media/22222222-2222-2222-2222-222222222222/boat/1773553191704-IMG_9604_11.jpg", caption: "Double Seater on the water" },
    { url: "https://mhafixflyffflwjhcgfn.supabase.co/storage/v1/object/public/media/22222222-2222-2222-2222-222222222222/addon/1774048349717-IMG_9594_7.jpg", caption: "Cooler add-on" },
    { url: "https://mhafixflyffflwjhcgfn.supabase.co/storage/v1/object/public/media/22222222-2222-2222-2222-222222222222/addon/1774049555695-IMG_0123.JPG", caption: "Fishing poles add-on" },
    { url: "https://mhafixflyffflwjhcgfn.supabase.co/storage/v1/object/public/media/22222222-2222-2222-2222-222222222222/addon/1774043932039-7148Pg1TOJL.jpg", caption: "Floating Chair" },
    { url: "https://mhafixflyffflwjhcgfn.supabase.co/storage/v1/object/public/media/22222222-2222-2222-2222-222222222222/addon/1774311327033-81YZt2LNAKL._AC_UF894_1000_QL80_.jpg", caption: "Floating Mat" },
  ],

  // ── Reviews ─────────────────────────────────────────────────
  reviews: [
    { author: "Marcus T.",  rating: 5, date: "March 2026",    text: "Best boat rental experience in Orange Beach! The circle boats are so unique and fun. My kids absolutely loved it. Staff was super friendly and helpful getting us set up. Will definitely be back next summer!" },
    { author: "Sarah K.",   rating: 5, date: "February 2026", text: "We rented the double seater and a mini dock for our cooler. Spent the whole day cruising the intercoastal. So relaxing and the electric motor is whisper quiet. 10/10 recommend!" },
    { author: "Jake R.",    rating: 5, date: "February 2026", text: "Took my dog out on the doggie dock — he had the time of his life! The boats are super easy to operate, no license needed. Great concept and great people running it." },
    { author: "Amanda L.",  rating: 4, date: "January 2026",  text: "Such a fun experience! We rented 4 boats for a birthday party. The group rate was a great deal. Only wish they had evening hours for sunset cruises." },
    { author: "Derek W.",   rating: 5, date: "January 2026",  text: "These circle boats are genius. Portable, electric, eco-friendly, and an absolute blast. My family rented three and we had a flotilla going down the canal. Staff was awesome!" },
  ],

  // ── About ───────────────────────────────────────────────────
  about: {
    description: "Beachside Circle Boats brings a whole new way to experience Orange Beach. Our portable, eco-friendly electric circle boats are perfect for cruising the intercoastal waterways — no gas, no noise, just pure fun on the water.",
    features: [
      "Eco-Friendly Electric", "No License Needed", "Dog Friendly",
      "Life Jackets Included", "Safety Briefing", "Full Battery Charge",
      "5-Speed Motor", "23 Single Seaters", "9 Double Seaters"
    ],
    perfectFor: [
      "Family outings", "Date night", "Birthday parties",
      "Group rentals", "Fishing trips", "Dog-friendly adventures",
      "Intercoastal cruising", "Corporate outings"
    ],
    included: [
      "Life jackets", "Safety briefing", "Full battery charge",
      "5-speed motor", "Paddle", "Whistle"
    ]
  },

  // ── Hours ───────────────────────────────────────────────────
  hours: [
    { day: "Monday",    open: "9:00 AM", close: "6:00 PM" },
    { day: "Tuesday",   open: "9:00 AM", close: "6:00 PM" },
    { day: "Wednesday", open: "9:00 AM", close: "6:00 PM" },
    { day: "Thursday",  open: "9:00 AM", close: "6:00 PM" },
    { day: "Friday",    open: "9:00 AM", close: "6:00 PM" },
    { day: "Saturday",  open: "9:00 AM", close: "6:00 PM" },
    { day: "Sunday",    open: "9:00 AM", close: "6:00 PM" }
  ],

  // ── Fleet (boats for rent) ──────────────────────────────────
  fleet: [
    {
      id:          "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      name:        "Single Seater",
      badge:       "Most Popular",
      description: "Solo cruiser. 57 lbs, 70\" diameter, portable, 35lb electric motor. Fits one adult up to 300 lbs.",
      image:       "https://mhafixflyffflwjhcgfn.supabase.co/storage/v1/object/public/media/22222222-2222-2222-2222-222222222222/about/1773703867895-FreedomLeft.webp",
      halfDay:     100,
      allDay:      175,
      qty:         23,
    },
    {
      id:          "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      name:        "Double Seater",
      badge:       "Bring a Friend",
      description: "65 lbs, extra-wide seats, enhanced stability. Fits two adults up to 450 lbs combined. 3 different styles available.",
      image:       "https://mhafixflyffflwjhcgfn.supabase.co/storage/v1/object/public/media/22222222-2222-2222-2222-222222222222/boat/1773553191704-IMG_9604_11.jpg",
      halfDay:     150,
      allDay:      225,
      qty:         9,
    },
  ],

  // ── Time Slots ──────────────────────────────────────────────
  timeSlots: [
    { id: "cccccccc-cccc-cccc-cccc-cccccccccc01", name: "Half Day AM", start: "9:00 AM",  end: "1:00 PM",  hours: 4 },
    { id: "cccccccc-cccc-cccc-cccc-cccccccccc02", name: "Half Day PM", start: "2:00 PM",  end: "6:00 PM",  hours: 4 },
    { id: "cccccccc-cccc-cccc-cccc-cccccccccc03", name: "All Day",     start: "9:00 AM",  end: "6:00 PM",  hours: 9 },
  ],

  // ── Docks ───────────────────────────────────────────────────
  docks: [
    { name: "Mini Dock",   specs: "8'4\" × 44\" · 100 lb capacity", desc: "Full-size platform for lounging, coolers & gear.",            halfDay: 25, allDay: 50 },
    { name: "X Dock",      specs: "5' × 5' · 75 lb capacity",       desc: "Compact square dock, holds full coolers & gear.",             halfDay: 25, allDay: 50 },
    { name: "Doggie Dock", specs: "5'4\" × 43\" · 85 lb capacity",  desc: "Pet-friendly with ramp for safe water entry. 🐾",            halfDay: 25, allDay: 50 },
  ],

  // ── Add-ons ─────────────────────────────────────────────────
  addons: [
    { id: "ff3268e7-af11-4420-a028-d8370469e6ba", name: "Cooler",           icon: "🍉", price: 8,  perUnit: "per cooler", desc: "Keep your drinks cold all day! Just bring your ice and snacks.",                      image: "https://mhafixflyffflwjhcgfn.supabase.co/storage/v1/object/public/media/22222222-2222-2222-2222-222222222222/addon/1774048349717-IMG_9594_7.jpg" },
    { id: "384f6714-a686-4d9b-b98c-0e36c60094f4", name: "Sunshade Canopy", icon: "⛱",  price: 10, perUnit: "per boat",   desc: "Beat the heat! Enjoy your trip without the sun.",                                     image: "https://mhafixflyffflwjhcgfn.supabase.co/storage/v1/object/public/media/22222222-2222-2222-2222-222222222222/addon/1774048907639-5154EDE6-E26C-4070-97E3-015D2CF0B92C.PNG" },
    { id: "42c77359-21fd-4bff-8724-8947cbf290dc", name: "Fishing Poles",   icon: "🎣", price: 10, perUnit: "per pole",   desc: "Try your luck while you're out on the water!",                                        image: "https://mhafixflyffflwjhcgfn.supabase.co/storage/v1/object/public/media/22222222-2222-2222-2222-222222222222/addon/1774049555695-IMG_0123.JPG" },
    { id: "90cd4190-6494-4353-bafb-eede40cd3881", name: "Floating Chair",  icon: "💺", price: 20, perUnit: "per chair",  desc: "Sit back, float and unwind! Perfect for relaxing in the water.",                      image: "https://mhafixflyffflwjhcgfn.supabase.co/storage/v1/object/public/media/22222222-2222-2222-2222-222222222222/addon/1774043932039-7148Pg1TOJL.jpg" },
    { id: "81ded9ca-4144-4ee1-8c46-3b3dd38077e4", name: "Floating Mat",    icon: "🏊", price: 25, perUnit: "per mat",    desc: "Extra space to relax, swim, and enjoy the water with the whole crew!",                  image: "https://mhafixflyffflwjhcgfn.supabase.co/storage/v1/object/public/media/22222222-2222-2222-2222-222222222222/addon/1774311327033-81YZt2LNAKL._AC_UF894_1000_QL80_.jpg" },
  ],

  // ── Sections (sticky nav) ───────────────────────────────────
  sections: [
    { id: 'about',    label: 'About',    icon: 'ℹ️' },
    { id: 'fleet',    label: 'Boats',    icon: '🚤' },
    { id: 'docks',    label: 'Docks',    icon: '🛟' },
    { id: 'addons',   label: 'Add-ons',  icon: '🎉' },
    { id: 'included', label: "What's Included", icon: '✅' },
    { id: 'gallery',  label: 'Photos',   icon: '📸' },
    { id: 'reviews',  label: 'Reviews',  icon: '⭐' },
    { id: 'hours',    label: 'Hours',    icon: '🕐' },
    { id: 'location', label: 'Location', icon: '📍' },
  ],
};
