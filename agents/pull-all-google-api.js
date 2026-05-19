#!/usr/bin/env node
/**
 * Pull All Google Places API Data (NEW API v3.5+)
 * Fetches fresh data for all 737+ businesses (or custom list)
 * Saves to: all-businesses-NEW-API-premium.json
 *
 * Usage:
 *   node agents/pull-all-google-api.js
 *   node agents/pull-all-google-api.js --resume 100  (skip first 100)
 *   node agents/pull-all-google-api.js --limit 50    (test mode, fetch 50)
 *   node agents/pull-all-google-api.js --source place-ids-from-maps.json
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const https = require('https');

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_API_KEY;
if (!API_KEY) {
  console.error('❌ Missing GOOGLE_PLACES_API_KEY or GOOGLE_API_KEY in .env');
  process.exit(1);
}

const ARGS = process.argv.slice(2);
const RESUME_AT = parseInt(ARGS.find(a => a.startsWith('--resume'))?.split(' ')[1] || 0);
const LIMIT = parseInt(ARGS.find(a => a.startsWith('--limit'))?.split(' ')[1] || Infinity);
const SOURCE_ARG = ARGS.find(a => a.startsWith('--source'))?.split(' ')[1];

const OUTPUT_FILE = path.join(__dirname, '../all-businesses-NEW-API-premium.json');
const SOURCE_FILE = SOURCE_ARG
  ? path.join(__dirname, '../' + SOURCE_ARG)
  : path.join(__dirname, '../all-businesses-organized-ob-gs.json');

// New Places API v3.5+ field mask - ALL AVAILABLE FIELDS
const FIELD_MASK = [
  // Basic Info
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.location',
  'places.shortFormattedAddress', 'places.adrFormatAddress', 'places.plusCode',

  // Contact & URLs
  'places.internationalPhoneNumber', 'places.websiteUri', 'places.googleMapsUri',
  'places.utcOffsetMinutes',

  // Rating & Reviews
  'places.rating', 'places.userRatingCount', 'places.reviews',
  'places.reviews.text', 'places.reviews.rating', 'places.reviews.authorAttribution',
  'places.reviews.publishTime', 'places.reviews.authorAttribution.displayName',
  'places.reviews.authorAttribution.uri', 'places.reviews.authorAttribution.photoUri',

  // Hours & Openings
  'places.openingHours', 'places.openingHours.weekdayDescriptions',
  'places.openingHours.periods', 'places.openingHours.periods.open',
  'places.openingHours.periods.close',

  // Business Status & Types
  'places.businessStatus', 'places.types',

  // Photos
  'places.photos', 'places.photos.heightPx', 'places.photos.widthPx',
  'places.photos.authorAttribusions',

  // Accessibility
  'places.accessibilityOptions', 'places.accessibilityOptions.wheelchairAccessibleEntrance',
  'places.accessibilityOptions.wheelchairAccessibleParking',
  'places.accessibilityOptions.wheelchairAccessibleRestroom',

  // Atmosphere
  'places.atmosphereOptions', 'places.atmosphereOptions.outdoorSeating',
  'places.atmosphereOptions.liveMusic', 'places.atmosphereOptions.goodForGroups',
  'places.atmosphereOptions.goodForChildren', 'places.atmosphereOptions.goodForBusiness',
  'places.atmosphereOptions.allowsDogs',

  // Parking
  'places.parkingOptions', 'places.parkingOptions.freeParking',
  'places.parkingOptions.paidParking', 'places.parkingOptions.valetParking',
  'places.parkingOptions.garageParking', 'places.parkingOptions.lotParking',
  'places.parkingOptions.streetParking',

  // Services
  'places.servicesOptions', 'places.servicesOptions.dineIn',
  'places.servicesOptions.takeout', 'places.servicesOptions.delivery',
  'places.servicesOptions.curbsidePickup', 'places.servicesOptions.dineInReservable',
  'places.servicesOptions.servesBrunch', 'places.servicesOptions.servesLunch',
  'places.servicesOptions.servesDinner', 'places.servicesOptions.servesBreakfast',

  // Dining & Food Options
  'places.diningOptions', 'places.diningOptions.servesBrunch', 'places.diningOptions.servesLunch',
  'places.diningOptions.servesDinner', 'places.diningOptions.servesBreakfast',
  'places.diningOptions.servesBeer', 'places.diningOptions.servesWine',
  'places.diningOptions.servesVegetarianFood', 'places.diningOptions.servesVeganFood',
  'places.diningOptions.servesDessert', 'places.diningOptions.servesCoffee',
  'places.diningOptions.servesSeafood', 'places.diningOptions.servesBbq',
  'places.diningOptions.servesPizza', 'places.diningOptions.servesIceCream',
  'places.diningOptions.servesSushi',

  // Payment Methods
  'places.paymentOptions', 'places.paymentOptions.acceptsCreditCards',
  'places.paymentOptions.acceptsDebitCards', 'places.paymentOptions.acceptsCash',
  'places.paymentOptions.acceptsApplePay', 'places.paymentOptions.acceptsGooglePay',
  'places.paymentOptions.acceptsNfc',

  // WiFi & Other
  'places.wifiOptions', 'places.wifiOptions.wifiAvailable',
  'places.wifiOptions.wifiForFree',

  // Price & Misc
  'places.priceLevel', 'places.editorialSummary',
  'places.primaryType', 'places.primaryTypeDisplayName',
  'places.formattedAddress', 'places.containingPlaces',
  'places.currentOpeningHours', 'places.specialistTypes',
  'places.evChargeOptions', 'places.evChargeOptions.evConnectorTypes',
  'places.evChargeOptions.evChargeStationCount',
  'places.businessStatus', 'places.permanentlyClosed'
].join(',');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function getPlaceDetails(placeId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'places.googleapis.com',
      path: `/v1/places/${placeId}?fields=${FIELD_MASK}&key=${API_KEY}`,
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function transformNewApiResponse(newData, oldData) {
  // Transform new API format to comprehensive object
  const photos = newData.photos ? newData.photos.map(p => ({
    photo_reference: p.name,
    height: p.heightPx,
    width: p.widthPx
  })) : [];

  const reviews = newData.reviews ? newData.reviews.map(r => ({
    author: r.authorAttribution?.displayName,
    rating: r.rating,
    text: r.text,
    time: r.publishTime,
    author_url: r.authorAttribution?.uri,
    author_photo: r.authorAttribution?.photoUri
  })) : [];

  // Parse opening hours
  const hoursObject = {};
  if (newData.openingHours?.weekdayDescriptions) {
    const daysMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    newData.openingHours.weekdayDescriptions.forEach((desc, idx) => {
      if (desc) hoursObject[daysMap[idx]] = desc.split(': ')[1] || desc;
    });
  }

  return {
    // Core Info
    place_id: newData.id,
    name: newData.displayName?.text || oldData.name,
    category: oldData.category,
    city: oldData.city,
    state: oldData.state,
    address: newData.formattedAddress || oldData.address,
    short_address: newData.shortFormattedAddress,
    adr_address: newData.adrFormatAddress,
    phone: newData.internationalPhoneNumber || oldData.phone,
    website: newData.websiteUri || oldData.website,
    google_maps_url: newData.googleMapsUri,
    lat: newData.location?.latitude,
    lng: newData.location?.longitude,
    utc_offset_minutes: newData.utcOffsetMinutes,
    plus_code: newData.plusCode?.globalCode,

    // Rating & Reviews
    rating: newData.rating,
    reviews_count: newData.userRatingCount,
    reviews: reviews,
    editorial_summary: newData.editorialSummary?.text,

    // Business Status
    business_status: newData.businessStatus,
    permanently_closed: newData.permanentlyClosed,
    types: newData.types,
    primary_type: newData.primaryType,
    price_level: newData.priceLevel,

    // Hours
    hours: hoursObject || oldData.hours,
    current_opening_hours: newData.currentOpeningHours,

    // Accessibility
    accessibility: {
      wheelchair_accessible_entrance: newData.accessibilityOptions?.wheelchairAccessibleEntrance,
      wheelchair_accessible_parking: newData.accessibilityOptions?.wheelchairAccessibleParking,
      wheelchair_accessible_restroom: newData.accessibilityOptions?.wheelchairAccessibleRestroom
    },

    // Atmosphere
    atmosphere: {
      outdoor_seating: newData.atmosphereOptions?.outdoorSeating,
      live_music: newData.atmosphereOptions?.liveMusic,
      good_for_groups: newData.atmosphereOptions?.goodForGroups,
      good_for_children: newData.atmosphereOptions?.goodForChildren,
      good_for_business: newData.atmosphereOptions?.goodForBusiness,
      allows_dogs: newData.atmosphereOptions?.allowsDogs
    },

    // Parking
    parking: {
      free_parking: newData.parkingOptions?.freeParking,
      paid_parking: newData.parkingOptions?.paidParking,
      valet_parking: newData.parkingOptions?.valetParking,
      garage_parking: newData.parkingOptions?.garageParking,
      lot_parking: newData.parkingOptions?.lotParking,
      street_parking: newData.parkingOptions?.streetParking
    },

    // Services
    services: {
      dine_in: newData.servicesOptions?.dineIn,
      takeout: newData.servicesOptions?.takeout,
      delivery: newData.servicesOptions?.delivery,
      curbside_pickup: newData.servicesOptions?.curbsidePickup,
      dine_in_reservable: newData.servicesOptions?.dineInReservable
    },

    // Dining Options
    dining: {
      serves_breakfast: newData.diningOptions?.servesBreakfast,
      serves_brunch: newData.diningOptions?.servesBrunch,
      serves_lunch: newData.diningOptions?.servesLunch,
      serves_dinner: newData.diningOptions?.servesDinner,
      serves_dessert: newData.diningOptions?.servesDessert,
      serves_coffee: newData.diningOptions?.servesCoffee,
      serves_beer: newData.diningOptions?.servesBeer,
      serves_wine: newData.diningOptions?.servesWine,
      serves_vegetarian_food: newData.diningOptions?.servesVegetarianFood,
      serves_vegan_food: newData.diningOptions?.servesVeganFood,
      serves_seafood: newData.diningOptions?.servesSeafood,
      serves_bbq: newData.diningOptions?.servesBbq,
      serves_pizza: newData.diningOptions?.servesPizza,
      serves_ice_cream: newData.diningOptions?.servesIceCream,
      serves_sushi: newData.diningOptions?.servesSushi
    },

    // Payment
    payment: {
      accepts_credit_cards: newData.paymentOptions?.acceptsCreditCards,
      accepts_debit_cards: newData.paymentOptions?.acceptsDebitCards,
      accepts_cash: newData.paymentOptions?.acceptsCash,
      accepts_apple_pay: newData.paymentOptions?.acceptsApplePay,
      accepts_google_pay: newData.paymentOptions?.acceptsGooglePay,
      accepts_nfc: newData.paymentOptions?.acceptsNfc
    },

    // WiFi
    wifi: {
      wifi_available: newData.wifiOptions?.wifiAvailable,
      wifi_for_free: newData.wifiOptions?.wifiForFree
    },

    // EV Charging
    ev_charging: {
      connector_types: newData.evChargeOptions?.evConnectorTypes,
      charge_station_count: newData.evChargeOptions?.evChargeStationCount
    },

    // Photos & Media
    photos: photos,

    // Metadata
    fetched_at: new Date().toISOString(),
    source_dataset: oldData.source_dataset,
    main_category: oldData.main_category,
    api_version: 'Google Places v3.5+ (NEW)'
  };
}

async function main() {
  try {
    // Load source data
    let businesses = [];
    if (fs.existsSync(SOURCE_FILE)) {
      const raw = fs.readFileSync(SOURCE_FILE, 'utf8');
      const data = JSON.parse(raw);
      businesses = Array.isArray(data) ? data : data.businesses || [];
      console.log(`✅ Loaded ${businesses.length} businesses from source`);
    } else {
      console.error('❌ Source file not found:', SOURCE_FILE);
      process.exit(1);
    }

    // Filter to businesses with place_id
    const withPlaceIds = businesses.filter(b => b.place_id).slice(RESUME_AT, RESUME_AT + LIMIT);
    console.log(`\n📍 Processing ${withPlaceIds.length} businesses (resume: ${RESUME_AT}, limit: ${LIMIT})`);
    console.log(`   Using: Google Places API v3.5+ (NEW)`);

    let results = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < withPlaceIds.length; i++) {
      const oldBiz = withPlaceIds[i];
      const globalIdx = RESUME_AT + i + 1;

      try {
        console.log(`[${globalIdx}/${businesses.length}] Fetching ${oldBiz.name}...`);

        const newData = await getPlaceDetails(oldBiz.place_id);

        if (!newData.id) {
          throw new Error('Invalid response from API');
        }

        const transformed = transformNewApiResponse(newData, oldBiz);
        results.push(transformed);
        successCount++;

        // Progress checkpoint every 50 results
        if (successCount % 50 === 0) {
          fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
          console.log(`✅ Saved ${successCount} results to ${OUTPUT_FILE}`);
        }

        // Rate limiting: 10 requests/second = 100ms between requests (new API is stricter)
        await sleep(100);

      } catch (error) {
        errorCount++;
        console.error(`   ❌ Error: ${error.message}`);

        // Save partial results if error
        if (successCount > 0) {
          fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
        }
      }
    }

    // Final save
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));

    console.log(`\n✅ COMPLETE`);
    console.log(`   Success: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Total: ${results.length}`);
    console.log(`   Saved to: ${OUTPUT_FILE}`);
    console.log(`   API: Google Places v3.5+ (NEW)`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
