window.BUSINESS_DATA = {

  // ── Core Info ──────────────────────────────────────────────
  name:     "Tee Off at The Wharf Powered by TOPGOLF Swing Suites",
  slug:     "tee-off-at-the-wharf",
  tagline:  "LIVE. LAUGH. PLAY!",
  category: "Entertainment",
  emoji:    "⛳",
  phone:    "2512284899",
  phoneDisplay: "251-228-4899",
  address:  "4619 Main Street, Suite A102",
  city:     "Orange Beach",
  state:    "Alabama",
  zip:      "36561",
  website:  "https://www.teeoffatthewharf.com",
  googleMaps: "https://maps.google.com/?q=4619+Main+Street,+Suite+A102,+Orange+Beach,+Alabama,+36561",
  instagram: "https://www.instagram.com/teeoff.thewharf/",
  facebook:  "https://www.facebook.com/people/Tee-Off-at-The-Wharf/61573192735473/",
  rating:       4.5,
  reviewCount:  100,

  // ── Cover Images (slideshow — add up to as many as you want) ─
  // Replace these with direct image URLs (right-click photo → Copy image address)
  coverImages: [
    "../business-images/tee-off-at-the-wharf/tee-off-cover.jpg",
    "../business-images/tee-off-at-the-wharf/cover 1.jpg",
    "../business-images/tee-off-at-the-wharf/cover 2.jpg",
  ],

  // ── Gallery (popup — up to 10 per page) ───────────────────
  gallery: [
    { url: "https://share.google/33DKu6MZI6IAAv4cD", caption: "Tee Off at The Wharf" }, // ← replace with direct image URL
    // { url: "https://...", caption: "Golf Simulators" },
    // { url: "https://...", caption: "Party Bay" },
    // { url: "https://...", caption: "Bar & Restaurant" },
    // { url: "https://...", caption: "Sports Simulators" },
  ],

  // ── Reviews ────────────────────────────────────────────────
  reviews: [
    // Add reviews here — example format:
    // { author: "Sarah M.", rating: 5, text: "Amazing experience! The golf simulators are so fun and the food was great.", date: "March 2025" },
    // { author: "James R.", rating: 5, text: "Great place for a birthday party. Staff was super helpful.", date: "February 2025" },
  ],

  // ── About ──────────────────────────────────────────────────
  about: {
    description: "Tee Off powered by Topgolf Swing Suite is a dining and entertainment venue that features golf-simulation games and a variety of other virtual sports and games using state-of-the-art technology. This fun and interactive restaurant is located at The Wharf in sunny Orange Beach, Alabama and is ideal for team-building events, corporate outings, happy hours, birthday parties and more. Topgolf Swing Suite and its Full Swing golf simulator provide endless opportunities for fun. Whether you're an aspiring golf pro or picking up a club for the first time, Topgolf is for everyone.",
    features: [
      "Topgolf Swing Suites", "7 Sports Simulators", "Full Bar & Restaurant",
      "Private Party Bays", "Golf League", "Family Friendly",
      "Corporate Events", "Indoor Climate-Controlled", "Located at The Wharf"
    ],
    perfectFor: [
      "Birthday parties", "Corporate team building", "Date night",
      "Family fun", "Bachelor/Bachelorette parties", "Sports fans",
      "Golf enthusiasts", "Group outings", "Happy hour"
    ]
  },

  // ── Hours ──────────────────────────────────────────────────
  hours: [
    { day: "Monday",    open: "11:00 AM", close: "10:00 PM" },
    { day: "Tuesday",   open: "11:00 AM", close: "10:00 PM" },
    { day: "Wednesday", open: "11:00 AM", close: "10:00 PM" },
    { day: "Thursday",  open: "11:00 AM", close: "10:00 PM" },
    { day: "Friday",    open: "11:00 AM", close: "12:00 AM" },
    { day: "Saturday",  open: "11:00 AM", close: "12:00 AM" },
    { day: "Sunday",    open: "11:00 AM", close: "10:00 PM" }
  ],

  // ── Happy Hour ─────────────────────────────────────────────
  happyHour: {
    schedule: "Daily 3pm – 6pm",
    deals: [
      { name: "House Cocktails", desc: "Selected house cocktails", price: "$7" },
      { name: "Draft Beer",      desc: "All draft beers",          price: "$4" },
      { name: "House Wine",      desc: "House red or white",       price: "$6" },
      { name: "Appetizer Specials", desc: "Selected appetizers at happy hour pricing" }
    ]
  },

  // ── Deals & Specials ───────────────────────────────────────
  specials: [
    { name: "Cash Discount", desc: "Receive a 4.0% discount on your total bill when you pay with cash.", badge: "4.0%" },
    { name: "Happy Hour",    desc: "House cocktails $7, draft beer $4, house wine $6, plus appetizer specials.", badge: "Daily 3–6pm" }
  ],

  // ── Food Menu ──────────────────────────────────────────────
  foodMenu: [
    {
      category: "Bites & Shareables",
      items: [
        { name: "Boiled Peanuts",      desc: "Alabama peanuts boiled in smoked ham stock",                                                              price: "$10.50" },
        { name: "Whipped Ricotta Dip", desc: "Served with Italian chili crisp & grilled sourdough",                                                     price: "$15" },
        { name: "Warm Spinach Dip",    desc: "With grilled bread",                                                                                      price: "$15" },
        { name: "Fried Pickles",       desc: "Panko breaded with buttermilk ranch",                                                                     price: "$11" },
        { name: "Fried Green Tomatoes",desc: "Fresh fried and topped with Creole Crawfish sauce",                                                       price: "$13.50" },
        { name: "Soft Bread Pretzels", desc: "Served with beer cheese",                                                                                 price: "$15" },
        { name: "Nachos",              desc: "Tortilla chips topped with braised pork, queso, pickled onions, jalapeños, avocado crema, salsas verde & roja", price: "$19" },
        { name: "Pork Skins",          desc: "Crispy fried pork skins served with candied jalapeño jam & ranch",                                        price: "$13" },
        { name: "Smashed Potatoes",    desc: "Twice cooked gold potatoes topped with cheddar cheese, dill and chive sour cream, bacon & jalapeños",     price: "$16.50" },
        { name: "Hushpuppies",         desc: "Two dozen sweet onion hushpuppies",                                                                       price: "$10" }
      ]
    },
    {
      category: "Handhelds",
      items: [
        { name: "Tee Off Burger",          desc: "7 oz Wagyu served with Augusta pimento, caramelized onions & dill pickles on a hamburger bun. Served with French fries",                                     price: "$18" },
        { name: "Cheddar Bacon Burger",    desc: "7 oz Wagyu served with shaved onions, tomato bacon jam, sharp cheddar and our special sauce. Served with French fries",                                       price: "$18" },
        { name: "Backyard Burger",         desc: "7 oz Wagyu burger served with sharp cheddar, ketchup, mustard, lettuce and tomato. Served with French fries",                                                 price: "$16" },
        { name: "Chicken Sandwich",        desc: "Grilled or fried chicken with our special sauce, sharp cheddar cheese, lettuce and tomato. Served with French fries. Add bacon jam +$2.50",                  price: "$17" },
        { name: "Chicken Salad Sandwich",  desc: "Fresh made chicken salad, tomato, crisp apples, smokey seasoning, lettuce, on toasted white bread with fries or chips. Add bacon jam +$2.50",                price: "$13" },
        { name: "Wings or Tenders",        desc: "8 beer brined jumbo wings or 4 jumbo chicken tenders available with any of our sauces. Served with French fries",                                             price: "$17" }
      ]
    },
    {
      category: "Salads",
      items: [
        { name: "Fried Green Tomato Salad", desc: "Baby gem lettuce tossed in spicy peppercorn ranch with grilled corn, bacon, goat cheese & fried green tomatoes",                                             price: "$15.50" },
        { name: "Caesar Salad",             desc: "Served with your choice of protein: Chicken (grilled, blackened or fried) +$6 | 6 oz Steak +$10 | Shrimp (6 count) +$12",                                   price: "$12" }
      ]
    },
    {
      category: "Bowls",
      items: [
        { name: "Tuna Poke Bowl",                   desc: "Rice, tuna, avocado, tomatoes, edamame, seaweed salad, carrots, roasted sesame seeds, poke sauce & spicy mayo",      price: "$32" },
        { name: "Mediterranean Chicken Rice Bowl",  desc: "Grilled chicken, rice, pickled onions, avocado, cucumbers, tomatoes, kalamata olives & house made Tzatziki sauce",    price: "$20" },
        { name: "Teriyaki Steak Bowl",              desc: "Tenderloin filet, rice, carrots, corn, avocado and cilantro crema sauce",                                              price: "$35" }
      ]
    },
    {
      category: "Seafood",
      items: [
        { name: "Fish Tacos",     desc: "Grilled Grouper, charred jalapeño slaw, pickled onions, lime crema & queso fresco on flour tortillas & served with fries", price: "$18" },
        { name: "Tuna Tacos",     desc: "Fresh Ahi Tuna, jalapeño coleslaw, pickled onions, spicy mayo & ginger teriyaki sauce",                                    price: "$28" },
        { name: "Shrimp Basket",  desc: "8 jumbo Gulf shrimp, either fried, grilled or blackened & served with corn, fries & sweet onion hushpuppies",              price: "$24" },
        { name: "Grouper Basket", desc: "Grouper either fried, grilled or blackened and served with corn, fries & sweet onion hushpuppies",                         price: "$24" },
        { name: "Crab Cakes",     desc: "Jumbo Cajun inspired crab cakes served with house made jalapeño tartar",                                                   price: "$25" }
      ]
    },
    {
      category: "Kids Menu",
      note: "Each served with French fries & a drink",
      items: [
        { name: "Chicken Tenders", price: "$9" },
        { name: "Mac & Cheese",    price: "$9" },
        { name: "Cheeseburger",    price: "$9" },
        { name: "Hot Dog",         price: "$9" }
      ]
    },
    {
      category: "Desserts",
      items: [
        { name: "Hot Fudge Brownie", desc: "Served with vanilla ice cream and caramel drizzle", price: "$12" }
      ]
    }
  ],

  // ── Bar Menu ───────────────────────────────────────────────
  barMenu: [
    {
      category: "Signature Cocktails",
      note: "4% discount when paying with cash",
      items: [
        { name: "Azalea",                  desc: "Vodka, pineapple, lemon, grenadine, cherry with orange garnish",             price: "$16" },
        { name: "Transfusion",             desc: "Vodka, grape juice, lime, ginger ale",                                       price: "$16" },
        { name: "Mother of Pearl",         desc: "Gin, celery bitters, tonic, celery salt rim, celery & fennel garnish",       price: "$16" },
        { name: "Southside",               desc: "Gin, lemon juice, soda, mint syrup & fresh mint",                            price: "$16" },
        { name: "Green Margarita",         desc: "Blanco Tequila, orange liqueur, lime, agave, kiwi",                          price: "$16" },
        { name: "Paloma",                  desc: "Reposado Tequila, ruby red grapefruit, lime, agave, soda with chili rim",    price: "$16" },
        { name: "Dirty Martini",           desc: "Vodka, olive brine, blue cheese olive",                                      price: "$17" },
        { name: "Espresso Martini",        desc: "Vodka, coffee liqueur, espresso, toasted marshmallow",                       price: "$17" },
        { name: "Bloody Mary",             desc: "Vodka, Bold Charleston Bloody Mary Mix, pickle stuffed olives, pickled okra", price: "$15" },
        { name: "Bushwhacker White Russian", desc: "Dark rum, coconut liqueur, coffee liqueur, cream & shaved chocolate",      price: "$16" },
        { name: "Old Fashioned",           desc: "Bourbon, sugar, bitters, orange zest",                                       price: "$16" }
      ]
    },
    {
      category: "Draft Beer",
      note: "$4 during Happy Hour (Daily 3pm–6pm)",
      items: [
        { name: "Paulaner Hefe-Weizen", desc: "German wheat beer on draft" }
      ]
    },
    {
      category: "Bottles & Cans",
      items: [
        { name: "Corona Premier",        desc: "Domestic lager",              price: "$6" },
        { name: "Bud Light",             desc: "Domestic lager",              price: "$6" },
        { name: "Miller Lite",           desc: "Domestic light lager",        price: "$6" },
        { name: "Coors Lite",            desc: "Domestic light lager",        price: "$6" },
        { name: "Yuengling",             desc: "Domestic amber lager",        price: "$6" },
        { name: "Modelo Especial",       desc: "Mexican lager",               price: "$6" },
        { name: "Blue Moon Light",       desc: "Belgian-style wheat ale",     price: "$6" },
        { name: "Michelob Ultra",        desc: "Domestic light lager",        price: "$6" },
        { name: "Twisted Tea",           desc: "Hard iced tea",               price: "$6" },
        { name: "Austin Eastside Cider", desc: "Hard cider",                  price: "$6" }
      ]
    },
    {
      category: "Craft Beer",
      items: [
        { name: "Sweetwater Day Trip IPA",                              desc: "IPA",                        price: "$8" },
        { name: "White Claw (Black Cherry & Mango)",                    desc: "Hard seltzer",               price: "$8" },
        { name: "DR JUICE IPA",                                         desc: "IPA",                        price: "$8" },
        { name: "Destin Don't Hassle Me I'm Local Blood Orange Blonde", desc: "Blood orange blonde ale",     price: "$8" },
        { name: "Fat Tire Amber",                                       desc: "Belgian-style amber ale",    price: "$8" },
        { name: "Good People Muchacho",                                 desc: "Mexican lager craft",        price: "$8" },
        { name: "Deschutes Black Butte Porter",                         desc: "Robust porter",              price: "$8" },
        { name: "Dogfish Grateful Dead Pale Ale",                       desc: "American pale ale",          price: "$8" },
        { name: "Dogfish Sequence Sour",                                desc: "Sour ale",                   price: "$8" },
        { name: "Run Wild IPA",                                         desc: "Non-alcoholic IPA",          price: "$5" },
        { name: "Athletic Golden Ale",                                  desc: "Non-alcoholic golden ale",   price: "$5" }
      ]
    },
    {
      category: "Wine — By the Glass",
      items: [
        { name: "Mezzacorona Domenic Pinot Grigio",  price: "$12" },
        { name: "Drylands Sauvignon Blanc",          price: "$13" },
        { name: "Carmel Road Chardonnay",            price: "$10" },
        { name: "La Marca Prosecco",                 price: "$11" },
        { name: "Ceretoo Moscato D'Asti",            price: "$14" },
        { name: "La Crema Pinot Noir",               price: "$14" },
        { name: "H3 Cabernet Sauvignon",             price: "$12" },
        { name: "Chateau La Mascaronne Folly Rosé",  price: "$11" }
      ]
    },
    {
      category: "Wine — By the Bottle",
      items: [
        { name: "Justin Sauvignon Blanc",                                     desc: "White — California",              price: "$42" },
        { name: "Tomatore Etna Bianco",                                       desc: "White — Sicily, Italy",           price: "$54" },
        { name: "Chandon Brut",                                               desc: "Sparkling — California",          price: "$54" },
        { name: "Santa Margherita Pinot Grigio",                              desc: "White — Alto Adige, Italy",       price: "$58" },
        { name: "Rombauer Vineyards Chardonnay",                              desc: "White — Napa Valley",             price: "$98" },
        { name: "Grand Veneur La Fontaine Chateauneuf Du-Pape Blanc",         desc: "White — Rhône, France",           price: "$165" },
        { name: "Tomatore Etna Rosso",                                        desc: "Red — Sicily, Italy",             price: "$58" },
        { name: "Trefethen Family Vineyard Napa Merlot",                      desc: "Red — Napa Valley",               price: "$67" },
        { name: "Department 66 Others (Grenache, Carignan, Syrah, Mouvedre)", desc: "Red — Roussillon, France",        price: "$72" },
        { name: "Robert Mondavi Napa Cabernet Sauvignon",                     desc: "Red — Napa Valley",               price: "$88" },
        { name: "Orin Swift 8 Years In The Desert (Zin/Petite Syrah/Syrah)",  desc: "Red — California",               price: "$88" },
        { name: "Patz & Hall Pinot Noir",                                     desc: "Red — Sonoma Coast",              price: "$96" },
        { name: "Stag's Leap Artemis Cabernet Sauvignon",                     desc: "Red — Napa Valley",               price: "$197" },
        { name: "Chateau D'Esclans Whispering Angel Rosé",                    desc: "Rosé — Provence, France",         price: "Ask server" }
      ]
    },
    {
      category: "Non-Alcoholic",
      items: [
        { name: "Athletic Golden Ale", desc: "Non-alcoholic golden ale", price: "$5" },
        { name: "Run Wild IPA",        desc: "Non-alcoholic IPA",        price: "$5" },
        { name: "Soft Drinks & Teas",  desc: "Coke, Diet Coke, Sprite, sweet tea & more" }
      ]
    },
    {
      category: "Whiskey & Bourbon",
      note: "Sorted low to high · same price grouped together",
      items: [
        { name: "Sazerac Rye, Maker's Mark",                                          price: "$11" },
        { name: "Elijah Craig",                                                        price: "$12" },
        { name: "Elijah Craig Rye, Bulleit Rye",                                      price: "$13" },
        { name: "Woodford Reserve, Old Elk Wheated, Whistlepig Piggyback",            price: "$16" },
        { name: "Angel's Envy, Michters Unblended, Bulleit Rye 10 Yr, Heaven Hill",   price: "$18" },
        { name: "Old Forester 1910",                                                   price: "$19" },
        { name: "Bulleit Bottled In Bond",                                             price: "$20" },
        { name: "Woodford Double Oak, Old Forester Statesman, Bushmills Single Malt Irish", price: "$21" },
        { name: "Angel's Envy Triple Oak",                                             price: "$24" },
        { name: "Jefferson's Ocean Aged Straight Bourbon",                             price: "$29" },
        { name: "Calumet Farm High Rye, Jefferson's Ocean Aged Rye",                  price: "$31" },
        { name: "Joseph Magnus",                                                       price: "$34" },
        { name: "Jefferson's Tropics",                                                 price: "$35" },
        { name: "Calumet Farm 18 Yr",                                                  price: "$157" }
      ]
    },
    {
      category: "Scotch",
      note: "Sorted low to high · same price grouped together",
      items: [
        { name: "Johnnie Walker Black, Chivas Regal 12 Yr",           price: "$15" },
        { name: "Glenarry 12 Yr",                                      price: "$21" },
        { name: "Johnnie Walker Scotch",                               price: "$27" },
        { name: "The Dalmore Sherry Cask Single Malt 12 Yr",          price: "$32" },
        { name: "The Dalmore Port Wood Single Malt",                   price: "$35" },
        { name: "The Macallan Dbl Cask 15 Yr",                        price: "$62" },
        { name: "Glenmorangie Signet Single Malt",                     price: "$87" },
        { name: "Johnnie Walker Blue",                                 price: "$776" }
      ]
    },
    {
      category: "Vodka",
      note: "Sorted low to high · same price grouped together",
      items: [
        { name: "Tito's, Wheatley",  price: "$11" },
        { name: "Haku",              price: "$12" },
        { name: "Grey Goose",        price: "$14" },
        { name: "Belvedere",         price: "$16" }
      ]
    },
    {
      category: "Tequila & Mezcal",
      note: "Sorted low to high · same price grouped together",
      items: [
        { name: "Corazon Blanco",                            price: "$12" },
        { name: "Espolon Reposado",                          price: "$13" },
        { name: "Lalo Blanco",                               price: "$16" },
        { name: "Casamigos Blanco",                          price: "$17" },
        { name: "Patron Silver, Casamigos Reposado",         price: "$18" },
        { name: "Casamigos Mezcal",                          price: "$19" },
        { name: "Patron Anejo",                              price: "$22" },
        { name: "Don Julio Anejo",                           price: "$24" },
        { name: "Maestro Dobel 50 Cristalino Extra Anejo",   price: "$49" },
        { name: "Dos Hombres Mezcal",                        price: "$120" }
      ]
    },
    {
      category: "Rum",
      note: "Sorted low to high · same price grouped together",
      items: [
        { name: "Malibu",                    price: "$10" },
        { name: "Bacardi Light, Captain Morgan", price: "$12" },
        { name: "Bumbu",                     price: "$14" }
      ]
    },
    {
      category: "Gin",
      note: "Sorted low to high · same price grouped together",
      items: [
        { name: "Aviation",                  price: "$11" },
        { name: "Bombay Sapphire",           price: "$12" },
        { name: "Roku, Hendricks",           price: "$14" },
        { name: "Monkey 47",                 price: "$18" }
      ]
    },
    {
      category: "Bitters & Aperitifs",
      note: "Sorted low to high · same price grouped together",
      items: [
        { name: "Baileys, Kahlua, Pimms No1, Licor 43",          price: "$11" },
        { name: "Aperol, Frangelico, Campari, Amaretto Disarrono", price: "$12" },
        { name: "St Germain",                                      price: "$13" },
        { name: "Fernet Branca, Chambord",                         price: "$14" },
        { name: "Grand Marnier",                                   price: "$18" }
      ]
    }
  ],

  // ── Simulators & Games ─────────────────────────────────────
  games: [
    {
      category: "Golf Simulators",
      items: [
        { name: "Topgolf Swing Suite",  desc: "Full golf simulator with Topgolf games. Multiple courses, skill levels welcome — from beginners to pros." },
        { name: "Top Contender",        desc: "Closest-to-pin golf challenge across 9 shots. Compete against friends for the highest score." },
        { name: "Top Pressure",         desc: "High-stakes shot challenge — earn points by hitting pressure shots under the clock." },
        { name: "Top Challenge",        desc: "Target-based driving game. Hit the targets, rack up points." }
      ]
    },
    {
      category: "Sports Simulators",
      items: [
        { name: "Quarterback Challenge", desc: "NFL-style football simulator. Throw passes at moving targets — perfect spiral not required." },
        { name: "Hardball Challenge",    desc: "Baseball pitching simulator. Test your fastball and accuracy against virtual batters." },
        { name: "Hockey Shots",          desc: "Ice hockey simulator. Slap shots, wrist shots — light up the targets." },
        { name: "Soccer Simulator",      desc: "Penalty kick challenge. Bend it like Beckham or just boot it — either works." }
      ]
    },
    {
      category: "Arcade & Carnival Games",
      items: [
        { name: "Dodgeball Simulator", desc: "Virtual dodgeball — dodge, duck, dip, dive and dodge your way to victory." },
        { name: "Carnival Classic",    desc: "Classic carnival games reimagined in a simulator. Midway fun without the cotton candy mess." }
      ]
    }
  ],

  // ── Book a Bay ─────────────────────────────────────────────
  bookABay: {
    name: "Swing Suite Rental",
    price: "$75/hr",
    capacity: "Up to 8 participants per bay",
    desc: "TOPGOLF Swing Suite rental at standard rate. Access to golf simulators and virtual sports games."
  },

  // ── Party Packages ─────────────────────────────────────────
  packages: [
    {
      name: "Par-Tee Animals",
      badge: "Kids Package",
      price: "$360",
      duration: "2 hours",
      desc: "Kids Party Package. Includes 2 hours of Topgolf Swing Suite simulation, 8 hotdogs or 16 chicken tenders, large basket of fries, 2 pitchers of fountain drinks, and birthday decorations."
    },
    {
      name: "Tee Off Titans",
      badge: "Non-Alcoholic Adult",
      price: "$400",
      duration: "2 hours",
      desc: "Includes 2 hours of Topgolf Swing Suite simulation, 50 wings (5 choices of wing sauce + 10 dipping sauces), large basket of fries, 2 pitchers of fountain drinks, and birthday decorations."
    },
    {
      name: "Tee Totalers",
      badge: "Alcoholic Adult",
      price: "$425",
      duration: "2 hours",
      desc: "Includes 2 hours of Topgolf Swing Suite simulation, 50 wings (5 choices of wing sauce + 10 dipping sauces), large basket of fries, beer tower with any beer, and birthday decorations."
    }
  ],

  // ── Golf League ────────────────────────────────────────────
  league: {
    name: "Golf League — Season 2",
    price: "$250/team",
    schedule: "Sundays–Wednesdays starting Feb 1 | 12 weeks",
    format: "Teams of 2, scramble format",
    desc: "Competitive 12-week golf league. Teams of 2, scramble format. Experience exciting weekly 9-hole matches on different courses using state-of-the-art golf simulators. Our league features a comprehensive point system rewarding both match victories and low scores.",
    perks: [
      "10% off food & drinks all season",
      "Weekly standings posted online",
      "Champion: $500 in gift cards",
      "Runner-up: $250 in gift cards",
      "Single-elimination playoffs",
      "Substitute players welcome"
    ]
  },

  // ── Events ─────────────────────────────────────────────────
  events: [
    {
      name: "Birthday & Group Parties",
      badge: "Available Daily",
      desc: "Book a private bay for birthdays, corporate outings, bachelor/bachelorette parties and team-building events. Party packages include simulator time, food, and drinks.",
      note: "Reservation required"
    }
  ],

  // ── Nav Sections (controls sticky tab order) ───────────────
  // barCat: matches the "category" name in barMenu above — renders that single category
  sections: [
    { id: "about",        label: "Overview",         icon: "ℹ️"  },
    { id: "food",         label: "Food",             icon: "🍔"  },
    { id: "games-shortcut", label: "Games & Sims",  icon: "🎯", scrollTo: "games" },
    { id: "happy-hour",   label: "Happy Hour",       icon: "🍸"  },
    { id: "specials",     label: "Deals & Specials", icon: "⭐"  },
    { id: "cocktails",    label: "Cocktails",        icon: "🍹",  barCat: "Signature Cocktails" },
    { id: "draft-beer",   label: "Draft Beer",       icon: "🍺",  barCat: "Draft Beer" },
    { id: "bottles-beer", label: "Bottles & Cans",   icon: "🍶",  barCat: "Bottles & Cans" },
    { id: "craft-beer",   label: "Craft Beer",       icon: "🍻",  barCat: "Craft Beer" },
    { id: "wine-glass",   label: "Wine by Glass",    icon: "🥂",  barCat: "Wine — By the Glass" },
    { id: "wine-bottle",  label: "Wine by Bottle",   icon: "🍷",  barCat: "Wine — By the Bottle" },
    { id: "na-drinks",    label: "Non-Alcoholic",    icon: "🧃",  barCat: "Non-Alcoholic" },
    { id: "whiskey",      label: "Whiskey",          icon: "🥃",  barCat: "Whiskey & Bourbon" },
    { id: "scotch",       label: "Scotch",           icon: "🥃",  barCat: "Scotch" },
    { id: "vodka",        label: "Vodka",            icon: "🫙",  barCat: "Vodka" },
    { id: "tequila",      label: "Tequila & Mezcal", icon: "🌵",  barCat: "Tequila & Mezcal" },
    { id: "rum",          label: "Rum",              icon: "🏴‍☠️", barCat: "Rum" },
    { id: "gin",          label: "Gin",              icon: "🌿",  barCat: "Gin" },
    { id: "bitters",      label: "Bitters & Aperitifs", icon: "🍊", barCat: "Bitters & Aperitifs" },
    { id: "games",        label: "Games & Sims",     icon: "🎯"  },
    { id: "packages",     label: "Party Packages",   icon: "🎉"  },
    { id: "league",       label: "Golf League",      icon: "🏌️" },
    { id: "book-a-bay",   label: "Book a Bay",       icon: "🚤"  },
    { id: "events",       label: "Events",           icon: "📅"  },
    { id: "gallery",      label: "Photos",           icon: "📸"  },
    { id: "reviews",      label: "Reviews",          icon: "⭐"  },
    { id: "hours",        label: "Hours",            icon: "🕐"  },
    { id: "location",     label: "Location",         icon: "📍"  }
  ]

};
