-- Add missing content columns to site_content table
-- These are website sections editable from the dashboard

ALTER TABLE site_content
  ADD COLUMN IF NOT EXISTS whats_included JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS steps JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS footer JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS links_page JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS locations JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS group_rate JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS docks JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS hero_cta_text VARCHAR(100) DEFAULT 'Book Now',
  ADD COLUMN IF NOT EXISTS hero_cta_url TEXT DEFAULT '#rentals';

-- Seed Circle Boats data (site_id = 22222222-2222-2222-2222-222222222222)
UPDATE site_content SET
  whats_included = '["Life Jacket","Safety Briefing","Full Battery Charge","5-Speed Motor","Paddle","Whistle","Cup Holders"]'::jsonb,
  steps = '[{"step":1,"title":"Book Online","description":"Choose your boat, pick your date, and reserve in seconds.","image":""},{"step":2,"title":"Show Up","description":"Head to our Orange Beach location on Canal Road.","image":""},{"step":3,"title":"Quick Briefing","description":"5-minute safety walkthrough. No license needed.","image":""},{"step":4,"title":"Hit the Water","description":"Cruise at your own pace and make memories.","image":""}]'::jsonb,
  features = '[{"icon":"⚡","title":"Electric & Eco-Friendly","description":"35lb thrust electric motors. Zero emissions, zero noise pollution.","image":""},{"icon":"💪","title":"Stable & Safe","description":"Low center of gravity, incredibly stable. Life jackets included.","image":""},{"icon":"🛶","title":"Portable","description":"Inflatable design. We can bring boats to your event or private dock.","image":""},{"icon":"🏋","title":"No License Needed","description":"Anyone can drive. No boating license required. We teach you in 5 min.","image":""},{"icon":"🌊","title":"Gulf Coast Views","description":"Explore Orange Beach coastline and intercoastal waterways.","image":""},{"icon":"🎉","title":"Perfect for Events","description":"Birthdays, date nights, bachelor parties, team outings.","image":""}]'::jsonb,
  footer = '{"businessName":"Beachside Circle Boats","tagline":"Beachside Circle Boat Rentals and Sales LLC. Eco-friendly circle boat rentals in Orange Beach, Alabama.","links":[{"label":"Rentals & Pricing","href":"#rentals"},{"label":"How It Works","href":"#how"},{"label":"About","href":"#about"},{"label":"Gallery","href":"#gallery"}],"services":["Single Seater Rental","Double Seater Rental","Docks","Add-ons"]}'::jsonb,
  links_page = '{"links":[{"id":"booking","enabled":true,"icon":"📅","label":"Book Now","sub":"Check availability & reserve"},{"id":"fleet","enabled":true,"icon":"🚤","label":"Rental Packages & Pricing","sub":"Single, Double & Dock Add-ons"},{"id":"gallery","enabled":true,"icon":"📸","label":"View Photos","sub":"Our boats on the water"},{"id":"reviews","enabled":true,"icon":"⭐","label":"Customer Reviews","sub":"See what customers say"},{"id":"about","enabled":true,"icon":"ℹ️","label":"About Us","sub":"Our story & what we offer"},{"id":"website","enabled":true,"icon":"🌐","label":"Visit Full Website","sub":"beachsidecircleboats.com","url":"index.html"}]}'::jsonb,
  locations = '[{"id":"loc1","name":"Main Launch — Canal Road","address":"25856 Canal Road, Unit A, Orange Beach, AL 36561","description":"Our main launch site. Easy parking, quick access to the intercoastal waterway.","mapUrl":"https://maps.google.com/?q=25856+Canal+Road+Orange+Beach+AL+36561"}]'::jsonb,
  group_rate = '{"title":"Group Rates Available","description":"Rent 5 or more single seaters and save. No group rate on doubles. Call to book.","price":200,"priceLabel":"each / All Day","ctaText":"Call to Book","ctaUrl":"tel:6013251205"}'::jsonb,
  docks = '[{"name":"Mini Dock","badge":"Most Popular","size":"8'\''4\" x 44\"","capacity":"100 lb","description":"The full-size floating platform. Tow it behind your GoBoat for extra room to sunbathe, do yoga, spread out a picnic, or store all your beach gear.","image":"images/goboat/mini-dock-tow.jpg","halfDay":25,"allDay":50,"features":["Large flat platform for lounging & sunbathing","Holds coolers, chairs, bags & umbrellas","EVA foam non-slip surface","Quick-connect tow rope included"]},{"name":"X Dock","badge":null,"size":"5'\'' x 5'\''","capacity":"75 lb","description":"The compact square dock built for utility. Designed to hold a full-size cooler (up to 58 quarts), tackle boxes, or a portable grill.","image":"","halfDay":25,"allDay":50,"features":["Holds a 58-qt cooler with room to spare","Square shape — stable & stackable","Raised edge rails prevent items from sliding","Lightweight & easy to tow"]},{"name":"Doggie Dock","badge":"Pet Friendly","size":"5'\''4\" x 43\"","capacity":"85 lb","description":"Built for your four-legged crew. Features a weighted mesh ramp so dogs can climb in and out of the water on their own.","image":"","halfDay":25,"allDay":50,"features":["Weighted mesh entry/exit ramp for dogs","Non-slip grip surface for wet paws","Stable — won'\''t flip when dogs jump on/off","Pairs great with our Pup Pack add-on"]}]'::jsonb,
  hero_cta_text = 'Book Now',
  hero_cta_url = '#rentals'
WHERE site_id = '22222222-2222-2222-2222-222222222222';
