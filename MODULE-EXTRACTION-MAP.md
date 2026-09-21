# Module Extraction Map

Every piece of this repo, cut into modules you can lift into another app.
For each one: what it is, what it owns, what it needs, and exactly what to change
to make it standalone.

Companion to `REPO-CAPABILITIES.md` (which says *what exists*). This one says
*how to take it apart*.

---

## 0. The module contract

The repo already has the right shape — `module-registry.js` — it's just never called.
Every extracted piece becomes one folder with this index:

```js
// modules/<id>/index.js
const registry = require('../../module-registry');
const router   = require('./routes');

registry.register({
    id:          'charter-booking',
    name:        'Charter Booking',
    version:     '1.0.0',
    description: 'Fishing charter inventory, availability, waiver, deposit.',
    mountPath:   '/api/charter',
    accessLevel: 'client',            // 'admin' | 'client' | 'public'
    router,
    panelId:     'charter-booking',   // dashboard tab, null if headless
    requiredEnv: ['STRIPE_SECRET_KEY'],
    requiredCore:['db', 'auth', 'sms'],   // ← ADD THIS: kernel deps, see §2
    ownsTables:  ['charter_listings','charter_bookings','charter_blocks',
                  'charter_departure_times'],   // ← ADD THIS
    sharedTables:['businesses','connections'],  // ← ADD THIS: the coupling
    migrations:  './migrations.sql',            // ← ADD THIS
    grokTools:   [ /* AI tool defs, optional */ ],
});

module.exports = router;
```

Three fields to add to the existing registry (`ownsTables`, `sharedTables`,
`requiredCore`) and it becomes a real manifest: a module declares its schema and its
kernel needs, and you can tell at a glance whether it drops into a new app clean.

To actually turn it on, `server.js` needs four lines it doesn't have:

```js
const registry = require('./module-registry');
require('./modules/charter-booking');   // each module self-registers on require
// ...or: fs.readdirSync('./modules').forEach(d => require(`./modules/${d}`));
registry.mountAll(app);
```

**Namespace warning:** the two existing modules mount under `/api/modules/*`, which
`routes/modules.js` (the app-store) already owns. Move module mounts to `/api/m/*`
or rename the app-store to `/api/app-store` before wiring `mountAll`.

---

## 1. Dependency tiers

```
TIER 0  KERNEL         db · gcr-db · auth · sms · email · ai · crypto · registry
   ↑
TIER 1  LEAF MODULES   charter · boat-rental · photographer · rides · qr ·
                       live-photo · fareharbor · google-business · analytics …
   ↑                   (need only kernel + their own tables)
TIER 2  HUB MODULES    stripe · square · sms-inbox · reviews · webhooks
   ↑                   (need kernel + 2-4 shared tables)
TIER 3  MONOLITHS      admin · dashboard · gcr · public · tourist · update-link ·
                       user · site   (must be split — §4)
```

Anything in Tier 1 can leave today. Tier 2 leaves once you accept it reads
`businesses` / `connections`. Tier 3 has to be cut apart first.

---

## 2. The kernel — pull these first, everything else depends on them

| Core ID | Source | Lines | Deps | Env | Notes |
|---|---|---|---|---|---|
| `core/db` | `db.js` | 8 | `@supabase/supabase-js` | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | Service-role client, bypasses RLS |
| `core/gcr-db` | `gcr-db.js` | 15 | `@supabase/supabase-js` | `GCR_SUPABASE_URL`, `GCR_SUPABASE_KEY` | Lazy singleton `getGcrDb()`, throws if unset |
| `core/auth` | `middleware/auth.js` | 84 | `db`, `gcr-db`, `jsonwebtoken` | `JWT_SECRET` | 3 token types: Express JWT → legacy Supabase → GCR Supabase. Reads `users` |
| `core/domain` | `middleware/domain.js` | 54 | `db` | — | `Host` header → `site_id`. Reads `businesses` |
| `core/sms` | `utils/sms.js` | 235 | `db` | `BREVO_API_KEY`, `BREVO_SMS_ENABLED`, `BREVO_SMS_SENDER` | Normalizes phones, checks `sms_opt_outs`, logs to `sms_log`, template filler |
| `core/email` | `utils/email.js` | 323 | `sms` | `BREVO_API_KEY`, `EMAIL_FROM`, `OWNER_PHONE`, `OWNER_RELAY_MODE`, `PLATFORM_ADMIN_EMAIL` | Brevo HTTP + booking confirmation HTML + `.ics` generator |
| `core/ai` | `routes/ai-provider.js` | 461 | `db` (storage only) | 16 `*_API_KEY` / `*_MODEL` vars | 6 providers, text + vision, `runAgentLoop`, `extractJsonFromImage` |
| `core/crypto` | **does not exist yet** | ~40 | `crypto` | `STRIPE_KEY_ENCRYPTION_KEY` | AES-256-GCM. Currently **copy-pasted 4×** — see §6 |
| `core/registry` | `module-registry.js` | 66 | — | — | `register` / `mountAll` / `getGrokTools` / `getManifest` |
| `lib/entity-resolver` | `lib/entity-resolver.js` | 61 | `gcr-db` | — | slug/id → `entity`, ownership via `entity_owners` |
| `lib/menu-gcr` | `lib/menu-gcr.js` | 196 | `gcr-db` | — | Menu read/write helpers against GCR schema |

**`core/ai` is the single most portable thing in the repo.** No npm deps (plain `fetch`),
no tables. It requires `db` only for one Supabase Storage upload — delete those ~10 lines
and it's a standalone package.

---

## 3. Module catalog

`Effort`: **A** = copy the file, change import paths, done. **B** = copy + one shim
(shared table or duplicated helper). **C** = must be split out of a monolith first.

### Tier 1 — leaf modules, lift as-is (effort A)

| Module ID | Source | Routes | Owns (tables travel with it) | Shared reads | Kernel | Env |
|---|---|---|---|---|---|---|
| `live-photo` | `routes/live-photo.js` | 4 | `customer_live_photos` | `customers` | db, gcr-db, sms | `ANTHROPIC_API_KEY` |
| `photographer-booking` | `routes/photographer.js` | 17 | `photo_sessions`, `photo_bookings`, `photo_availability`, `photo_blocks` | `businesses`, `connections` | db, auth, sms | `STRIPE_SECRET_KEY` |
| `charter-booking` | `routes/charter.js` | 13 | `charter_listings`, `charter_bookings`, `charter_blocks`, `charter_departure_times` | `businesses`, `connections` | db, auth, sms | `STRIPE_SECRET_KEY` |
| `boat-rental` | `routes/boat-rental.js` | 11 | `boat_listings`, `boat_rentals`, `boat_blocks` | `businesses`, `connections` | db, auth, sms | `STRIPE_SECRET_KEY` |
| `rides-dispatch` | `routes/rides.js` | 11 | `ride_requests`, `ride_dispatches`, `taxi_drivers` | `businesses`, `connections` | db, auth, sms | `STRIPE_SECRET_KEY`, `CRON_SECRET` |
| `google-business` | `routes/google-business.js` | 10 | `oauth_tokens` | `reviews` | db, auth, crypto | `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI`, `OAUTH_TOKEN_ENCRYPTION_KEY`, `DASHBOARD_BASE_URL` |
| `fareharbor` | `routes/fareharbor.js` | 7 | `integrations`, `integration_items` | `availability_slots` | db, auth, crypto | `CRON_SECRET`, `STRIPE_KEY_ENCRYPTION_KEY` |
| `app-store` | `routes/modules.js` | 7 | `module_manifest`, `user_modules` | — | db, auth | — |
| `analytics` | `routes/analytics.js` | 5 | `page_views`, `conversions` | `businesses` | db | — |
| `availability-search` | `routes/availability.js` | 3 | — | `availability_slots`, `integration_items` | db | — |
| `apps-catalog` | `routes/apps.js` | 3 | `apps` | `site_apps` | db, auth | — |
| `setup-questions` | `routes/setup-questions.js` | 6 | `tourist_setup_questions` | — | db, auth | — |
| `simple-menu-edit` | `routes/simple-menu-edit.js` | 6 | — | 10 GCR menu tables | gcr-db | — |
| `menu-edit` ⚠️ | `routes/menu-edit.js` | 6 | — | 7 GCR menu tables | **none** (own client) | `GCR_SUPABASE_URL/KEY` |
| `links` | `routes/links.js` | 1 | — | — | none | — |
| `admin-tourists` ⚠️ | `routes/admin-tourists.js` | 7 | — | 5 tourist tables | auth, `./tourist` | `SUPABASE_URL/SERVICE_KEY` |

⚠️ = **never mounted in `server.js`** — free to take, nothing breaks.

### Tier 2 — hub modules, one shim needed (effort B)

| Module ID | Source | Routes | Owns | Shared reads (the shim) | Kernel | Env |
|---|---|---|---|---|---|---|
| `stripe-payments` | `routes/stripe.js` | 15 | — | `connections`, `businesses`, `bookings`, `waivers`, `site_content` | db, auth, sms, email, crypto | 9 Stripe vars |
| `square-payments` | `routes/square.js` | 8 | `messaging_settings` | `connections`, `businesses`, `bookings`, `waivers`, `platform_settings` | db, auth, sms, email, crypto | `STRIPE_KEY_ENCRYPTION_KEY`, `ADMIN_SMS_NUMBER` |
| `stripe-webhooks` | `routes/webhooks.js` | 4 | — | `bookings`, `orders`, `businesses`, `notifications`, `sms_log`, `sms_opt_outs`, `tourist_profiles` | db | `STRIPE_*`, `SENDBLUE_*`, `API_BASE` |
| `qr-tracking` | `routes/qr.js` | 25 | `qr_codes`, `qr_scans`, `qr_events`, `referral_partners`, `referral_events` | `customers`, `app_settings` | db, gcr-db, auth, sms | `ADMIN_SMS_NUMBER`, `CRON_SECRET` |
| `review-funnel` | `routes/reviews.js` | 15 | `review_requests`, `review_sms_state`, `pos_orders`, `customer_consents` | `reviews`, `entity` | db, gcr-db, auth, sms | `CRON_SECRET`, `REVIEW_WEBHOOK_SECRET` |
| `sms-inbox` | `routes/sms.js` | 9 | `messages` | `businesses`, `customers`, `bookings`, `entity`, `menu_items`, `waivers` | db, gcr-db, sms | `CRON_SECRET`, `OWNER_PHONE`, `MENU_EDITOR_BASE_URL` |
| `owner-auth` | `routes/auth.js` | 9 | — | `users`, `businesses`, `site_content`, `site_apps` | db, auth | `JWT_SECRET` |
| `site-api` | `routes/site.js` | 41 | — | 16 tables (read-through layer over the whole main DB) | db, auth | — |
| `tourist-auth` | `routes/tourist-auth.js` | 8 | `tourist_sessions` | `tourist_profiles`, `platform_settings`, `session_events` | db, email | `SUPABASE_*`, `SENDBLUE_*`, `TRIP_SWIPE_URL` |
| `tourist-groups` | `routes/tourist-groups.js` | 9 | `tourist_groups`, `tourist_group_members`, `tourist_group_invites` | `tourist_saves` | db, `./tourist` | `SUPABASE_*`, `TRIP_SWIPE_URL` |

### Tier 1.5 — the two half-built modules already in `modules/`

| Module | State | To finish |
|---|---|---|
| `sms-automation` | `index.js` + `routes.js` (11 routes) + `migrations.sql` complete | Delete or stub `require('../weather-connector/api')` at `routes.js:180`. Owns `sms_automations`, `sms_automation_logs`, `sms_update_links`, `webhook_registrations`, `webhook_events`. Then it runs. |
| `social-manager` | `index.js` only — manifest, access levels, 3 grok tools | **`./routes.js` does not exist.** Write it (FB/IG page insights, post scheduling, ads read) or delete the module. Env: `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`. |

Both mount under `/api/modules/*`, which collides with the app-store — rename before wiring.

---

## 4. Monolith split maps

Eight files hold 688 of the 907 endpoints. Each table below is the actual section
structure of the file, with line ranges — cut on these boundaries.

Each row is a candidate module. Where a row's tables are all in the "single-owner"
list (§5), it lifts clean. Where it touches `businesses` / `entity` / `bookings` /
`connections`, it needs the same shim as Tier 2.


### `routes/admin.js` — /api/admin (9239 lines, 113 sections)

| Lines | Section | Routes | Tables touched |
|---|---|---|---|
| 12–55 | ADMIN LOGIN — must be BEFORE adminRequired middleware | 1 — `POST /api/admin/login` | `users` |
| 56–93 | DASHBOARD HOME — Platform stats | 1 — `GET /api/admin/stats` | `bookings`, `businesses`, `orders`, `users` |
| 94–347 | BUSINESSES — List, view, create, update, delete | 5 — `GET /api/admin/businesses`, `GET /api/admin/businesses/:id`, `POST /api/admin/businesses`, `PUT /api/admin/businesses/:id`, `DELETE /api/admin/businesses/:id` | `ai_conversations`, `ai_messages`, `audit_log`, `availability`, `availability_blocks`, `booking_funnel`, `booking_slots`, `bookings`, `business_memories`, `businesses` … |
| 348–399 | IMPERSONATION — Login as a business | 1 — `POST /api/admin/businesses/:id/impersonate` | `audit_log`, `businesses`, `users` |
| 400–427 | SUSPEND / UNSUSPEND | 2 — `POST /api/admin/businesses/:id/suspend`, `POST /api/admin/businesses/:id/unsuspend` | `businesses` |
| 428–467 | USERS — List, update | 2 — `GET /api/admin/users`, `PUT /api/admin/users/:id` | `users` |
| 468–529 | APPS — Marketplace app management | 4 — `GET /api/admin/apps`, `POST /api/admin/apps`, `PUT /api/admin/apps/:id`, `DELETE /api/admin/apps/:id` | `apps`, `site_apps` |
| 530–543 | PLANS | 1 — `GET /api/admin/plans` | — |
| 544–570 | REVENUE | 1 — `GET /api/admin/revenue` | `bookings`, `orders` |
| 571–584 | AUDIT LOG | 1 — `GET /api/admin/audit` | `audit_log` |
| 585–615 | SYSTEM HEALTH | 1 — `GET /api/admin/system/health` | `businesses` |
| 616–651 | TEMPLATES | 3 — `GET /api/admin/templates`, `POST /api/admin/templates`, `PUT /api/admin/templates/:id` | `templates` |
| 652–676 | SUPPORT TICKETS | 2 — `GET /api/admin/support/tickets`, `PUT /api/admin/support/tickets/:id` | `support_tickets` |
| 677–746 | TEST AI CONNECTION — POST /api/admin/test-ai | 1 — `POST /api/admin/test-ai` | — |
| 747–760 | SET BUSINESS CONNECTION — POST /api/admin/set-connection | 1 — `POST /api/admin/set-connection` | `connections` |
| 761–776 | SAVE API KEY — POST /api/admin/save-api-key | 1 — `POST /api/admin/save-api-key` | `platform_settings` |
| 777–787 | TEST OAUTH — POST /api/admin/test-oauth | 1 — `POST /api/admin/test-oauth` | — |
| 788–803 | GET /api/admin/businesses/:id/full — Full business data (CyberCheck le | 1 — `GET /api/admin/businesses/:id/full` | `businesses`, `site_content` |
| 804–1123 | PUT /api/admin/businesses/:id/full — Update ALL tables for a business | 1 — `PUT /api/admin/businesses/:id/full` | `drink_items`, `drink_sections`, `entity`, `entity_events`, `entity_hours`, `entity_sections`, `entity_specials`, `entity_tags`, `gcr_faqs`, `gcr_seo_settings` … |
| 1124–1222 | POST /api/admin/businesses/create-full — Create new GCR business (no u | 1 — `POST /api/admin/businesses/create-full` | `businesses`, `events`, `menu_items`, `services`, `site_content`, `specials` |
| 1251–1278 | GET /api/admin/gcr/businesses — List all GCR entities (admin view, inc | 1 — `GET /api/admin/gcr/businesses` | `entity` |
| 1279–1354 | POST /api/admin/gcr/import-entity — business row → GCR entity table | 2 — `POST /api/admin/gcr/import-entity`, `POST /api/admin/gcr/import-csv` | `entity`, `entity_about_bullets`, `entity_hours` |
| 1445–1497 | POST /api/admin/gcr/import-menu | 1 — `POST /api/admin/gcr/import-menu` | `menu_items` |
| 1498–1541 | POST /api/admin/gcr/import-drinks | 1 — `POST /api/admin/gcr/import-drinks` | `drink_items` |
| 1542–1580 | POST /api/admin/gcr/import-happyhour | 1 — `POST /api/admin/gcr/import-happyhour` | `entity`, `happy_hour_items` |
| 1581–1618 | POST /api/admin/gcr/import-events | 1 — `POST /api/admin/gcr/import-events` | `entity_events` |
| 1619–1648 | POST /api/admin/gcr/import-specials | 1 — `POST /api/admin/gcr/import-specials` | `entity_specials` |
| 1649–1671 | POST /api/admin/gcr/import-photos | 1 — `POST /api/admin/gcr/import-photos` | `entity_photos` |
| 1672–1696 | POST /api/admin/gcr/import-activities | 1 — `POST /api/admin/gcr/import-activities` | `activities` |
| 1697–1896 | POST /api/admin/gcr/import-section-based | 1 — `POST /api/admin/gcr/import-section-based` | `drink_items`, `drink_sections`, `entity`, `entity_about_bullets`, `entity_events`, `entity_sections`, `entity_specials`, `section_groups`, `section_items` |
| 1897–1923 | POST /api/admin/gcr/import-pricing | 1 — `POST /api/admin/gcr/import-pricing` | `pricing_items` |
| 1924–1944 | POST /api/admin/gcr/import-slots | 1 — `POST /api/admin/gcr/import-slots` | `booking_slots` |
| 1945–1968 | POST /api/admin/gcr/import-fleet | 1 — `POST /api/admin/gcr/import-fleet` | `fleet_items` |
| 1969–1994 | POST /api/admin/gcr/import-addons | 1 — `POST /api/admin/gcr/import-addons` | `addons` |
| 1995–2014 | POST /api/admin/gcr/import-included | 1 — `POST /api/admin/gcr/import-included` | `whats_included` |
| 2015–2033 | POST /api/admin/gcr/import-requirements | 1 — `POST /api/admin/gcr/import-requirements` | `requirements` |
| 2034–2053 | POST /api/admin/gcr/import-policies | 1 — `POST /api/admin/gcr/import-policies` | `policies` |
| 2054–2074 | POST /api/admin/gcr/import-meetingpoint | 1 — `POST /api/admin/gcr/import-meetingpoint` | `meeting_points` |
| 2075–2094 | POST /api/admin/gcr/import-qna | 1 — `POST /api/admin/gcr/import-qna` | `entity_qna` |
| 2095–2133 | POST /api/admin/gcr/import-shopping | 1 — `POST /api/admin/gcr/import-shopping` | `product_items` |
| 2134–2173 | POST /api/admin/gcr/import-master — routes all record_types from maste | 1 — `POST /api/admin/gcr/import-master` | — |
| 2178–2265 | POST /api/admin/gcr/auto-activate-top5 | 1 — `POST /api/admin/gcr/auto-activate-top5` | `entity`, `entity_hours`, `entity_tags` |
| 2266–2320 | GCR EVENTS — new entity_events table | 4 — `GET /api/admin/gcr/events`, `POST /api/admin/gcr/events`, `PUT /api/admin/gcr/events/:id`, `DELETE /api/admin/gcr/events/:id` | `entity_events` |
| 2321–2370 | GCR SPECIALS — new entity_specials table | 4 — `GET /api/admin/gcr/specials`, `POST /api/admin/gcr/specials`, `PUT /api/admin/gcr/specials/:id`, `DELETE /api/admin/gcr/specials/:id` | `entity_specials` |
| 2371–2450 | GCR MENU ITEMS — direct CRUD | 7 — `PUT /api/admin/gcr/menu-sections/:sectionId`, `DELETE /api/admin/gcr/menu-sections/:sectionId`, `POST /api/admin/gcr/entities/:id/menu-sections`, `POST /api/admin/gcr/entities/:id/menu-items`, `PUT /api/admin/gcr/menu-items/:itemId`, `PATCH /api/admin/gcr/menu-items/:itemId` +1 more | `menu_items`, `menu_sections` |
| 2451–2511 | GCR DRINK ITEMS — direct CRUD | 5 — `POST /api/admin/gcr/entities/:id/drink-sections`, `POST /api/admin/gcr/entities/:id/drink-items`, `PUT /api/admin/gcr/drink-items/:itemId`, `PATCH /api/admin/gcr/drink-items/:itemId`, `DELETE /api/admin/gcr/drink-items/:itemId` | `drink_items`, `drink_sections` |
| 2512–2569 | GCR HAPPY HOUR ITEMS — direct CRUD | 5 — `POST /api/admin/gcr/entities/:id/hh-sections`, `POST /api/admin/gcr/entities/:id/hh-items`, `PUT /api/admin/gcr/hh-items/:itemId`, `DELETE /api/admin/gcr/hh-items/:itemId`, `PUT /api/admin/gcr/entities/:id/happy-hour` | `entity`, `happy_hour_items`, `happy_hour_sections` |
| 2581–2619 | POST /api/admin/scrape-url — Fetch and extract text from any URL | 1 — `POST /api/admin/scrape-url` | — |
| 2620–2803 | POST /api/admin/ai-save-business — Save AI-organized business data to  | 2 — `POST /api/admin/ai-save-business`, `POST /api/admin/upload-photo` | `entity`, `entity_events`, `entity_features`, `entity_hours`, `entity_perfect_for`, `entity_specials`, `entity_tags`, `fleet_types`, `media`, `menu_items` … |
| 2804–2837 | GET /api/admin/ai-settings — Get AI config | 2 — `GET /api/admin/ai-settings`, `PUT /api/admin/ai-settings` | `ai_settings` |
| 2838–2868 | GET /api/admin/rag-status — Index status | 1 — `GET /api/admin/rag-status` | `business_embeddings`, `businesses` |
| 2869–2999 | POST /api/admin/ai-organize — Parse raw business text into structured  | 1 — `POST /api/admin/ai-organize` | `ai_settings` |
| 3000–3341 | GCR BUSINESS EDITOR — Full data loader | 15 — `GET /api/admin/gcr/business-data/:siteId`, `POST /api/admin/businesses/:siteId/fleet`, `POST /api/admin/businesses/:siteId/addons`, `PUT /api/admin/businesses/:siteId/schedule`, `PUT /api/admin/businesses/:siteId/highlights`, `POST /api/admin/businesses/:siteId/photos` +9 more | `business_atmosphere`, `business_details`, `business_filters`, `business_highlights`, `business_logistics`, `business_media`, `drink_items`, `drink_sections`, `entity`, `entity_events` … |
| 3346–3867 | Entity CRUD ────────────────────────────────────────────── | 8 — `GET /api/admin/gcr/entities`, `POST /api/admin/gcr/entities`, `GET /api/admin/gcr/entities/:id`, `GET /api/admin/gcr/entities/:id/features`, `GET /api/admin/gcr/entities/:id/children`, `PUT /api/admin/gcr/entities/:id` +2 more | `entity`, `entity_activities`, `entity_booking_slots`, `entity_drink_items`, `entity_drink_sections`, `entity_events`, `entity_features`, `entity_happy_hour_items`, `entity_happy_hours`, `entity_hours` … |
| 3868–3919 | Features / Perfect For / Tags ───────────────────────────── | 6 — `POST /api/admin/gcr/entities/:id/features`, `DELETE /api/admin/gcr/entities/:id/features/:featureId`, `POST /api/admin/gcr/entities/:id/perfect-for`, `DELETE /api/admin/gcr/entities/:id/perfect-for/:itemId`, `POST /api/admin/gcr/entities/:id/tags`, `DELETE /api/admin/gcr/entities/:id/tags/:tagId` | `entity_features`, `entity_perfect_for`, `entity_tags` |
| 3920–3963 | Sections CRUD ──────────────────────────────────────────── | 4 — `GET /api/admin/gcr/entities/:id/sections`, `POST /api/admin/gcr/entities/:id/sections`, `PUT /api/admin/gcr/entities/:id/sections/:sectionId`, `DELETE /api/admin/gcr/entities/:id/sections/:sectionId` | `entity_sections` |
| 3964–3982 | Section Content: Rich Text ──────────────────────────────── | 2 — `GET /api/admin/gcr/sections/:sectionId/rich-text-get`, `PUT /api/admin/gcr/sections/:sectionId/rich-text` | `section_rich_text` |
| 3983–4017 | Section Content: Bullets ────────────────────────────────── | 4 — `GET /api/admin/gcr/sections/:sectionId/bullets`, `POST /api/admin/gcr/sections/:sectionId/bullets`, `PUT /api/admin/gcr/sections/:sectionId/bullets/:bulletId`, `DELETE /api/admin/gcr/sections/:sectionId/bullets/:bulletId` | `section_bullets` |
| 4018–4088 | Section Content: Groups + Items ────────────────────────── | 7 — `GET /api/admin/gcr/sections/:sectionId/groups`, `POST /api/admin/gcr/sections/:sectionId/groups`, `PUT /api/admin/gcr/sections/:sectionId/groups/:groupId`, `DELETE /api/admin/gcr/sections/:sectionId/groups/:groupId`, `POST /api/admin/gcr/sections/:sectionId/items`, `PUT /api/admin/gcr/sections/:sectionId/items/:itemId` +1 more | `section_groups`, `section_items` |
| 4089–4118 | Section Content: Cards ──────────────────────────────────── | 4 — `GET /api/admin/gcr/sections/:sectionId/cards`, `POST /api/admin/gcr/sections/:sectionId/cards`, `PUT /api/admin/gcr/sections/:sectionId/cards/:cardId`, `DELETE /api/admin/gcr/sections/:sectionId/cards/:cardId` | `section_cards` |
| 4119–4143 | Section Content: Photos ─────────────────────────────────── | 3 — `GET /api/admin/gcr/sections/:sectionId/photos`, `POST /api/admin/gcr/sections/:sectionId/photos`, `DELETE /api/admin/gcr/sections/:sectionId/photos/:photoId` | `section_photos` |
| 4144–4152 | Section Content: Location ───────────────────────────────── | 1 — `PUT /api/admin/gcr/sections/:sectionId/location` | `section_location` |
| 4153–4166 | Image Upload ────────────────────────────────────────────── | 1 — `POST /api/admin/gcr/upload-image` | — |
| 4167–4238 | Section Content: Hours ──────────────────────────────────── | 7 — `PUT /api/admin/gcr/sections/:sectionId/hours`, `GET /api/admin/gcr/reviews`, `PUT /api/admin/gcr/reviews/:id`, `DELETE /api/admin/gcr/reviews/:id`, `GET /api/admin/gcr/customers`, `POST /api/admin/gcr/customers` +1 more | `gcr_customers`, `gcr_reviews`, `section_hours` |
| 4239–4289 | Analytics ────────────────────────────────────────────── | 3 — `GET /api/admin/gcr/analytics`, `POST /api/admin/gcr/analytics/track`, `POST /api/admin/gcr/analytics/convert` | `gcr_conversions`, `gcr_page_views` |
| 4290–4373 | GET /api/admin/platform-analytics — Aggregated platform analytics | 1 — `GET /api/admin/platform-analytics` | `booking_funnel`, `platform_page_views`, `tourist_profiles`, `tourist_saves` |
| 4374–4468 | GET /api/admin/tripswipe-analytics — Real TripSwipe swipe + save data | 1 — `GET /api/admin/tripswipe-analytics` | `entity`, `tourist_profiles`, `tourist_saves` |
| 4469–4484 | Messaging Settings ───────────────────────────────────── | 2 — `GET /api/admin/gcr/messaging/:entity_id`, `PUT /api/admin/gcr/messaging/:entity_id` | `gcr_messaging_settings` |
| 4485–4515 | Coupons ──────────────────────────────────────────────── | 4 — `GET /api/admin/gcr/coupons`, `POST /api/admin/gcr/coupons`, `PUT /api/admin/gcr/coupons/:id`, `DELETE /api/admin/gcr/coupons/:id` | `gcr_coupons` |
| 4516–4531 | SEO Settings ─────────────────────────────────────────── | 2 — `GET /api/admin/gcr/seo/:entity_id`, `PUT /api/admin/gcr/seo/:entity_id` | `gcr_seo_settings` |
| 4532–4607 | Bookings Management ──────────────────────────────────── | 4 — `GET /api/admin/bookings`, `DELETE /api/admin/bookings/:id`, `PATCH /api/admin/bookings/:id/cancel`, `POST /api/admin/gcr/entities/:id/invite` | `bookings`, `entity`, `profiles` |
| 4608–4643 | SITE CONFIG — Site Editor Home Hero tab | 2 — `GET /api/admin/gcr/site-config`, `PUT /api/admin/gcr/site-config/hero` | `gcr_site_config` |
| 4644–4673 | CATEGORY CARDS — Site Editor Category Cards tab | 2 — `GET /api/admin/gcr/category-cards`, `PUT /api/admin/gcr/category-cards/:id` | `gcr_category_cards` |
| 4674–4718 | PAGE ASSIGNMENTS — Site Editor Page Assignments tab | 2 — `GET /api/admin/gcr/page-assignments/:catId`, `PUT /api/admin/gcr/page-assignments/:catId/order` | `entity`, `gcr_page_assignments` |
| 4719–4766 | ENTITY PAGES — Site Editor Entity Pages tab | 3 — `GET /api/admin/gcr/entity-pages/:entityId`, `POST /api/admin/gcr/entity-pages/:entityId`, `PUT /api/admin/gcr/entity-pages/:entityId/:pageId` | `gcr_entity_pages` |
| 4767–4809 | CATEGORY PAGE CONFIG — Site Editor / Page Headers | 2 — `GET /api/admin/gcr/category-page-config/:catId`, `PUT /api/admin/gcr/category-page-config/:catId` | `gcr_category_page_config` |
| 4810–4961 | POST /api/admin/ai-scrape-url | 1 — `POST /api/admin/ai-scrape-url` | — |
| 4962–5330 | POST /api/admin/ai-scrape-approve | 1 — `POST /api/admin/ai-scrape-approve` | `activities`, `drink_items`, `drink_sections`, `entity`, `entity_about_bullets`, `entity_events`, `entity_features`, `entity_hours`, `entity_perfect_for`, `entity_sections` … |
| 6857–6861 | GET /api/admin/ai-provider — returns active AI provider info | 1 — `GET /api/admin/ai-provider` | — |
| 6862–6973 | POST /api/admin/gcr/ai-chat — Agentic AI with tool use (provider-agnos | 1 — `POST /api/admin/gcr/grok-chat` | — |
| 6974–6984 | GET /api/admin/gcr/claims — list all claim requests (admin) | 1 — `GET /api/admin/gcr/claims` | `gcr_claims` |
| 6985–6997 | PATCH /api/admin/gcr/claims/:id — update status / admin_notes | 1 — `PATCH /api/admin/gcr/claims/:id` | `gcr_claims` |
| 6998–7110 | DAILY ROTATING SECTIONS — admin CRUD | 7 — `GET /api/admin/gcr/entities/:entityId/daily-rotation`, `POST /api/admin/gcr/entities/:entityId/daily-rotation/sections`, `PATCH /api/admin/daily-rotation/sections/:id`, `DELETE /api/admin/daily-rotation/sections/:id`, `POST /api/admin/daily-rotation/sections/:id/options`, `PATCH /api/admin/daily-rotation/options/:id` +1 more | `daily_rotation_options`, `daily_rotation_sections` |
| 7111–7129 | Sales Leads ────────────────────────────────────────────────────────── | 2 — `GET /api/admin/sales-leads`, `PATCH /api/admin/sales-leads/:id` | `sales_leads` |
| 7130–7661 | Conversational AI Data Organizer ───────────────────────────────────── | 4 — `POST /api/admin/ai-chat-organizer`, `POST /api/admin/businesses/:site_id/link-gcr`, `POST /api/admin/businesses/link-gcr-all`, `GET /api/admin/run-migrations` | `businesses`, `entity`, `entity_about_bullets`, `entity_events`, `entity_hours`, `entity_photos`, `entity_sections`, `entity_specials`, `entity_tags`, `section_items` |
| 7662–7743 | POST /api/admin/smart-import/parse-events | 1 — `POST /api/admin/smart-import/parse-events` | `entity` |
| 7744–7809 | POST /api/admin/smart-import/save-events | 1 — `POST /api/admin/smart-import/save-events` | `entity`, `entity_events` |
| 7810–7881 | POST /api/admin/smart-import/parse | 1 — `POST /api/admin/smart-import/parse` | — |
| 7882–8034 | POST /api/admin/smart-import/save | 1 — `POST /api/admin/smart-import/save` | `entity_events`, `entity_specials`, `happy_hour_items`, `happy_hour_sections`, `menu_items`, `menu_sections` |
| 8035–8061 | APP CATALOG MANAGEMENT ──────────────────────────────────── | 4 — `GET /api/admin/apps`, `POST /api/admin/apps`, `PUT /api/admin/apps/:appId`, `DELETE /api/admin/apps/:appId` | `apps`, `site_apps` |
| 8062–8099 | BUSINESS APPS MANAGEMENT ────────────────────────────────── | 3 — `GET /api/admin/businesses`, `POST /api/admin/site-apps`, `DELETE /api/admin/site-apps` | `businesses`, `site_apps` |
| 8100–8166 | TRIPSWIPE BUSINESS SETTINGS | 2 — `GET /api/admin/tripswipe/settings`, `PUT /api/admin/tripswipe/settings/:slug` | `tripswipe_business_settings` |
| 8167–8253 | TRIPSWIPE PROMO / TONIGHT CARDS | 4 — `GET /api/admin/tripswipe/promo-cards`, `POST /api/admin/tripswipe/promo-cards`, `PUT /api/admin/tripswipe/promo-cards/:id`, `DELETE /api/admin/tripswipe/promo-cards/:id` | — |
| 8254–8334 | TRIPSWIPE SPONSORED CARDS | 4 — `GET /api/admin/tripswipe/sponsored`, `POST /api/admin/tripswipe/sponsored`, `PUT /api/admin/tripswipe/sponsored/:id`, `DELETE /api/admin/tripswipe/sponsored/:id` | — |
| 8335–8373 | Auth Config — controls which sign-in methods are shown on GCR/TripSwip | 4 — `GET /api/admin/auth-config`, `PUT /api/admin/auth-config`, `GET /api/admin/trip-swipe-button`, `PUT /api/admin/trip-swipe-button` | `platform_settings` |
| 8376–8392 | Business Leads ─────────────────────────────────────────────────────── | 2 — `GET /api/admin/business-leads`, `PATCH /api/admin/business-leads/:id` | `business_leads` |
| 8393–8525 | SMS Config ─────────────────────────────────────────────────────────── | 5 — `GET /api/admin/sms-config`, `PUT /api/admin/sms-config`, `POST /api/admin/sms-blast`, `POST /api/admin/sms-campaign-preview`, `GET /api/admin/sms-blasts` | `platform_settings`, `sms_blasts`, `tourist_profiles`, `user_preference_scores` |
| 8526–8560 | Community Photos (submitted by TripSwipe users, approved by admin) ─── | 3 — `GET /api/admin/community-photos`, `PUT /api/admin/community-photos/:id`, `DELETE /api/admin/community-photos/:id` | `tourist_photos` |
| 8561–8692 | TRIP SWIPE TOURISTS ADMIN | 5 — `GET /api/admin/tourists`, `GET /api/admin/tourists/:id`, `GET /api/admin/tourists/:id/preferences`, `PUT /api/admin/tourists/:id/preferences`, `DELETE /api/admin/tourists/:id` | `item_swipes`, `itineraries`, `tourist_preferences`, `tourist_profiles`, `tourist_saves` |
| 8693–8782 | AI CHAT CONVERSATION HISTORY | 6 — `POST /api/admin/ai-chat-history/save`, `PUT /api/admin/ai-chat-history/:id`, `GET /api/admin/ai-chat-history`, `GET /api/admin/ai-chat-history/:id`, `DELETE /api/admin/ai-chat-history/:id`, `POST /api/admin/ai-chat-history/search` | `ai_chat_conversations` |
| 8783–8968 | RAW DATA PARSING — AI-powered bulk data import | 2 — `POST /api/admin/gcr/parse-raw-data`, `POST /api/admin/gcr/save-parsed-items` | — |
| 8969–9196 | GEOFENCING SYSTEM — Location-based SMS marketing | 6 — `POST /api/admin/tourist/location`, `PUT /api/admin/tourist/location-settings`, `GET /api/admin/geofences`, `POST /api/admin/geofences`, `PUT /api/admin/geofences/:id`, `GET /api/admin/geofence-analytics` | `geofence_triggers`, `geofences`, `tourist_location_settings`, `tourist_locations` |
| 9197–9239 | GCR ADS MANAGEMENT | 4 — `GET /api/admin/gcr/ads`, `POST /api/admin/gcr/ads`, `PUT /api/admin/gcr/ads/:id`, `DELETE /api/admin/gcr/ads/:id` | `gcr_ads` |


### `routes/dashboard.js` — /api/dashboard (5432 lines, 66 sections)

| Lines | Section | Routes | Tables touched |
|---|---|---|---|
| 116–157 | GET /api/dashboard/overview — Dashboard home stats | 1 — `GET /api/dashboard/overview` | `bookings`, `customers` |
| 158–172 | GET /api/dashboard/declined-bookings — failed payment bookings for ret | 1 — `GET /api/dashboard/declined-bookings` | `bookings` |
| 173–339 | Profile — admin role → GCR entity, others → old DB (businesses + site_ | 2 — `GET /api/dashboard/profile`, `PUT /api/dashboard/profile` | `businesses`, `entity`, `site_content` |
| 340–387 | HOURS | 2 — `GET /api/dashboard/hours`, `PUT /api/dashboard/hours` | `entity_hours`, `site_content` |
| 388–447 | SERVICES | 4 — `GET /api/dashboard/services`, `POST /api/dashboard/services`, `PUT /api/dashboard/services/:id`, `DELETE /api/dashboard/services/:id` | `services` |
| 448–522 | GALLERY | 4 — `GET /api/dashboard/gallery`, `POST /api/dashboard/gallery`, `PUT /api/dashboard/gallery/:id`, `DELETE /api/dashboard/gallery/:id` | `entity_photos`, `media` |
| 523–590 | FAQS | 4 — `GET /api/dashboard/faqs`, `POST /api/dashboard/faqs`, `PUT /api/dashboard/faqs/:id`, `DELETE /api/dashboard/faqs/:id` | `faq_items`, `faqs` |
| 591–616 | SOCIAL LINKS | 2 — `GET /api/dashboard/social`, `PUT /api/dashboard/social` | `site_content` |
| 617–675 | TEAM / STAFF | 4 — `GET /api/dashboard/team`, `POST /api/dashboard/team`, `PUT /api/dashboard/team/:id`, `DELETE /api/dashboard/team/:id` | `staff` |
| 676–735 | MENU ITEMS (restaurants, bakeries, retail) | 4 — `GET /api/dashboard/menu-items`, `POST /api/dashboard/menu-items`, `PUT /api/dashboard/menu-items/:id`, `DELETE /api/dashboard/menu-items/:id` | `menu_items` |
| 736–794 | MENU CATEGORIES (Breakfast, Lunch, Dinner, etc.) | 4 — `GET /api/dashboard/menu-categories`, `POST /api/dashboard/menu-categories`, `PUT /api/dashboard/menu-categories/:id`, `DELETE /api/dashboard/menu-categories/:id` | `menu_categories` |
| 795–854 | MENU SUBCATEGORIES (Appetizers, Seafood, etc.) | 4 — `GET /api/dashboard/menu-subcategories`, `POST /api/dashboard/menu-subcategories`, `PUT /api/dashboard/menu-subcategories/:id`, `DELETE /api/dashboard/menu-subcategories/:id` | `menu_subcategories` |
| 855–900 | EVENTS | 4 — `GET /api/dashboard/events`, `POST /api/dashboard/events`, `PUT /api/dashboard/events/:id`, `DELETE /api/dashboard/events/:id` | `entity_events` |
| 901–965 | CUSTOM DOMAINS (dedicated domains table) | 4 — `GET /api/dashboard/domains`, `POST /api/dashboard/domains`, `PUT /api/dashboard/domains/:id`, `DELETE /api/dashboard/domains/:id` | `domains` |
| 966–1024 | FLEET TYPES (rental businesses) | 4 — `GET /api/dashboard/fleet`, `POST /api/dashboard/fleet`, `PUT /api/dashboard/fleet/:id`, `DELETE /api/dashboard/fleet/:id` | `fleet_types` |
| 1025–1087 | FLEET ITEMS (individual inventory units) | 4 — `GET /api/dashboard/fleet-items`, `POST /api/dashboard/fleet-items`, `PUT /api/dashboard/fleet-items/:id`, `DELETE /api/dashboard/fleet-items/:id` | `fleet_items` |
| 1088–1143 | RENTAL TIME SLOTS | 4 — `GET /api/dashboard/time-slots`, `POST /api/dashboard/time-slots`, `PUT /api/dashboard/time-slots/:id`, `DELETE /api/dashboard/time-slots/:id` | `rental_time_slots` |
| 1144–1229 | RENTAL PRICING | 5 — `GET /api/dashboard/pricing`, `POST /api/dashboard/pricing`, `PUT /api/dashboard/pricing/:id`, `DELETE /api/dashboard/pricing/:id`, `PUT /api/dashboard/pricing` | `rental_pricing` |
| 1230–1325 | RENTAL ADD-ONS | 5 — `GET /api/dashboard/addons`, `POST /api/dashboard/addons`, `PUT /api/dashboard/addons/sync`, `PUT /api/dashboard/addons/:id`, `DELETE /api/dashboard/addons/:id` | `rental_addons` |
| 1326–1363 | GROUP RATES | 3 — `GET /api/dashboard/group-rates`, `POST /api/dashboard/group-rates`, `DELETE /api/dashboard/group-rates/:id` | `rental_group_rates` |
| 1364–1534 | BOOKINGS | 5 — `GET /api/dashboard/bookings`, `GET /api/dashboard/bookings/:id`, `POST /api/dashboard/bookings`, `PUT /api/dashboard/bookings/:id`, `DELETE /api/dashboard/bookings/:id` | `activity_log`, `bookings`, `messaging_settings` |
| 1535–1569 | ORDERS | 2 — `GET /api/dashboard/orders`, `PUT /api/dashboard/orders/:id` | `orders` |
| 1570–1658 | CUSTOMERS (CRM) | 4 — `GET /api/dashboard/customers`, `POST /api/dashboard/customers`, `PUT /api/dashboard/customers/:id`, `DELETE /api/dashboard/customers/:id` | `bookings`, `customers`, `waivers` |
| 1659–1706 | REVIEWS | 3 — `GET /api/dashboard/reviews`, `PUT /api/dashboard/reviews/:id`, `DELETE /api/dashboard/reviews/:id` | `gcr_reviews`, `reviews` |
| 1707–1722 | GET /api/dashboard/reviews/pending | 1 — `GET /api/dashboard/reviews/pending` | `bookings`, `reviews` |
| 1723–1790 | POST /api/dashboard/reviews/send-request | 1 — `POST /api/dashboard/reviews/send-request` | `bookings`, `businesses`, `reviews` |
| 1791–1854 | REVIEW QUESTIONS — Custom per-business questions | 4 — `GET /api/dashboard/review-questions`, `POST /api/dashboard/review-questions`, `PUT /api/dashboard/review-questions/:id`, `DELETE /api/dashboard/review-questions/:id` | `review_questions` |
| 1855–1997 | WAIVERS | 6 — `GET /api/dashboard/waivers`, `GET /api/dashboard/waivers/template`, `PUT /api/dashboard/waivers/template`, `GET /api/dashboard/waivers/booking/:booking_id`, `GET /api/dashboard/waivers/link`, `POST /api/dashboard/waivers/link` | `bookings`, `businesses`, `waivers` |
| 1998–2056 | COUPONS | 4 — `GET /api/dashboard/coupons`, `POST /api/dashboard/coupons`, `PUT /api/dashboard/coupons/:id`, `DELETE /api/dashboard/coupons/:id` | `coupons` |
| 2057–2136 | SPECIALS | 6 — `GET /api/dashboard/specials`, `POST /api/dashboard/specials`, `PUT /api/dashboard/specials/:id`, `DELETE /api/dashboard/specials/:id`, `GET /api/dashboard/qr-theme`, `PUT /api/dashboard/qr-theme` | `businesses`, `entity_specials`, `specials` |
| 2137–2160 | CONNECTIONS (OAuth providers) | 2 — `GET /api/dashboard/connections`, `DELETE /api/dashboard/connections/:id` | `connections` |
| 2161–2216 | SITE PAGES | 4 — `GET /api/dashboard/pages`, `POST /api/dashboard/pages`, `PUT /api/dashboard/pages/:id`, `DELETE /api/dashboard/pages/:id` | `site_pages` |
| 2217–2400 | THEME | 5 — `GET /api/dashboard/theme`, `PUT /api/dashboard/theme`, `POST /api/dashboard/theme/ai-design`, `GET /api/dashboard/seo`, `PUT /api/dashboard/seo` | `entity`, `site_content` |
| 2401–2443 | DOMAIN | 2 — `GET /api/dashboard/domain`, `PUT /api/dashboard/domain` | `businesses` |
| 2444–2470 | BILLING | 1 — `GET /api/dashboard/billing` | `businesses`, `site_apps` |
| 2471–2525 | APPS (browse + install) | 3 — `GET /api/dashboard/apps`, `POST /api/dashboard/apps/install`, `POST /api/dashboard/apps/uninstall` | `apps`, `site_apps` |
| 2526–2563 | NOTIFICATIONS | 3 — `GET /api/dashboard/notifications`, `PUT /api/dashboard/notifications/:id`, `PUT /api/dashboard/notifications/read-all` | `notifications` |
| 2564–2578 | SMS LOG | 1 — `GET /api/dashboard/sms-log` | `sms_log` |
| 2579–2633 | AVAILABILITY | 4 — `GET /api/dashboard/availability`, `POST /api/dashboard/availability`, `PUT /api/dashboard/availability/:id`, `DELETE /api/dashboard/availability/:id` | `availability` |
| 2634–2682 | ACTIVITY LOG | 1 — `GET /api/dashboard/activity` | `activity_log`, `bookings`, `customers` |
| 2683–2706 | DATA EXPORT | 1 — `POST /api/dashboard/export/:type` | — |
| 2707–2725 | PUBLISH (trigger site rebuild) | 1 — `POST /api/dashboard/publish` | `businesses` |
| 2726–2771 | MESSAGING SETTINGS | 2 — `GET /api/dashboard/messaging-settings`, `PUT /api/dashboard/messaging-settings` | `site_content` |
| 2772–2875 | SMS CAMPAIGNS | 2 — `POST /api/dashboard/sms/campaign`, `GET /api/dashboard/sms/campaigns` | `businesses`, `customers`, `sms_campaigns`, `sms_opt_outs` |
| 2876–3067 | LOYALTY REWARDS (dashboard management) | 6 — `GET /api/dashboard/loyalty/settings`, `PUT /api/dashboard/loyalty/settings`, `GET /api/dashboard/loyalty/members`, `GET /api/dashboard/loyalty/summary-preview`, `POST /api/dashboard/loyalty/earn`, `GET /api/dashboard/loyalty/history/:customer_id` | `activity_log`, `bookings`, `customers`, `site_content` |
| 3068–3090 | STRIPE STATUS (dashboard check) | 1 — `GET /api/dashboard/stripe-status` | `connections` |
| 3091–3133 | GET /api/dashboard/calendar?month=YYYY-MM | 1 — `GET /api/dashboard/calendar` | `bookings` |
| 3134–3182 | GET /api/dashboard/analytics?range=30 | 1 — `GET /api/dashboard/analytics` | `bookings`, `customers` |
| 3183–3234 | GET /api/dashboard/media | 3 — `GET /api/dashboard/media`, `POST /api/dashboard/media`, `DELETE /api/dashboard/media/:id` | `media_library` |
| 3235–3307 | AVAILABILITY / BLOCK DATES | 4 — `GET /api/dashboard/availability/blocks`, `POST /api/dashboard/availability/block`, `DELETE /api/dashboard/availability/block/:id`, `DELETE /api/dashboard/availability/blocks` | `availability_blocks` |
| 3308–3374 | AI TRAINING — business_details, logistics, atmosphere, qa_pairs | 6 — `GET /api/dashboard/ai-profile`, `PUT /api/dashboard/ai-profile`, `GET /api/dashboard/qa-pairs`, `POST /api/dashboard/qa-pairs`, `PUT /api/dashboard/qa-pairs/:id`, `DELETE /api/dashboard/qa-pairs/:id` | `business_atmosphere`, `business_details`, `business_logistics`, `qa_pairs` |
| 3375–4507 | POST /api/dashboard/ai-chat — Business owner AI assistant (Claude + to | 1 — `POST /api/dashboard/ai-chat` | `ai_conversations`, `ai_messages`, `bookings`, `business_memories`, `businesses`, `customers`, `entity`, `entity_events`, `entity_hours`, `entity_photos` … |
| 4508–4521 | GET /api/dashboard/ai-chat/conversations — List recent conversations f | 1 — `GET /api/dashboard/ai-chat/conversations` | `ai_conversations` |
| 4522–4538 | GET /api/dashboard/ai-chat/conversations/:id — Full message history fo | 1 — `GET /api/dashboard/ai-chat/conversations/:id` | `ai_conversations`, `ai_messages` |
| 4539–4550 | DELETE /api/dashboard/ai-chat/conversations/:id — Remove a chat thread | 1 — `DELETE /api/dashboard/ai-chat/conversations/:id` | `ai_conversations` |
| 4551–4564 | GET /api/dashboard/ai-chat/memories — List all long-term memories (for | 1 — `GET /api/dashboard/ai-chat/memories` | `business_memories` |
| 4565–4576 | DELETE /api/dashboard/ai-chat/memories/:id — Forget a specific memory | 1 — `DELETE /api/dashboard/ai-chat/memories/:id` | `business_memories` |
| 4577–4693 | POST /api/dashboard/search-structured — Natural language search with s | 1 — `POST /api/dashboard/search-structured` | `menu_items` |
| 4694–4745 | WEBSITE CONTENT SECTIONS — generic GET/PUT per section | 3 — `GET /api/dashboard/website-content`, `PUT /api/dashboard/website-content/:section`, `PUT /api/dashboard/website-content` | `site_content` |
| 4746–4772 | MODULES — GET/PUT /api/dashboard/modules | 2 — `GET /api/dashboard/modules`, `PUT /api/dashboard/modules` | `site_content` |
| 4773–4841 | FAQ — CRUD /api/dashboard/faqs | 4 — `GET /api/dashboard/faqs`, `POST /api/dashboard/faqs`, `PUT /api/dashboard/faqs/:id`, `DELETE /api/dashboard/faqs/:id` | `faqs` |
| 4842–4923 | ONBOARDING PROGRESS — GET/PUT /api/dashboard/onboarding | 3 — `GET /api/dashboard/onboarding`, `PUT /api/dashboard/onboarding`, `POST /api/dashboard/resend-confirmation` | `bookings`, `onboarding_progress` |
| 4924–5432 | MENU — AI Image Extraction | 11 — `POST /api/dashboard/menu/extract`, `GET /api/dashboard/ai/vision-providers`, `POST /api/dashboard/events/extract`, `POST /api/dashboard/contacts/scan-card`, `GET /api/dashboard/promotions`, `POST /api/dashboard/promotions` +5 more | `businesses`, `coupon_claims`, `customers`, `entity_promotions`, `events`, `menu_items`, `promotions`, `specials` |


### `routes/gcr.js` — /api/gcr (3734 lines, 42 sections)

| Lines | Section | Routes | Tables touched |
|---|---|---|---|
| 20–27 | GET /api/gcr/businesses — DEPRECATED: redirects to /entities | 1 — `GET /api/gcr/businesses` | — |
| 28–91 | GET /api/gcr/events — events from MASTER-BUSINESSES-WITH-EVENTS | 1 — `GET /api/gcr/events` | `entity_events` |
| 92–206 | GET /api/gcr/happy-hours — entities with HH data from any source | 1 — `GET /api/gcr/happy-hours` | `entity`, `entity_happy_hours`, `entity_hours`, `entity_photos`, `entity_specials`, `happy_hour_items`, `happy_hour_sections` |
| 207–253 | GET /api/gcr/specials — new GCR DB entity_specials | 1 — `GET /api/gcr/specials` | `entity_specials` |
| 254–565 | POST /api/gcr/search — AI-powered semantic search | 1 — `POST /api/gcr/search` | `activities`, `entity`, `entity_events`, `entity_photos`, `entity_sections`, `entity_specials`, `section_items` |
| 566–694 | GET /api/gcr/businesses/:slug — Full business profile by slug | 1 — `GET /api/gcr/businesses/:slug` | `business_media`, `businesses`, `events`, `fleet_types`, `menu_items`, `rental_addons`, `rental_group_rates`, `rental_pricing`, `reviews`, `services` … |
| 695–741 | GET /api/gcr/business/:id — Single business detail (from GCR database) | 1 — `GET /api/gcr/business/:id` | `entity`, `entity_hours`, `entity_photos`, `entity_specials`, `faqs`, `reviews`, `services`, `staff` |
| 742–833 | GET /api/gcr/business/:id/availability — Live availability | 1 — `GET /api/gcr/business/:id/availability` | `bookings`, `fleet_items`, `fleet_types`, `rental_pricing`, `rental_time_slots`, `services` |
| 834–871 | POST /api/gcr/business/:id/book — Book from GCR | 1 — `POST /api/gcr/business/:id/book` | `bookings` |
| 872–897 | GET /api/gcr/categories — All business categories | 1 — `GET /api/gcr/categories` | `businesses` |
| 898–918 | GET /api/gcr/featured — Featured businesses | 1 — `GET /api/gcr/featured` | `businesses` |
| 919–933 | GET /api/gcr/trending — Trending searches | 1 — `GET /api/gcr/trending` | — |
| 934–990 | GET /api/gcr/nearby — Businesses near coordinates | 1 — `GET /api/gcr/nearby` | `businesses`, `site_content` |
| 991–1037 | POST /api/gcr/tourist/register — GCR Loyalty Signup → SMS | 1 — `POST /api/gcr/tourist/register` | `tourist_sessions` |
| 1038–1146 | POST /api/gcr/chat — GCR AI voice/text search | 1 — `POST /api/gcr/chat` | `entity`, `entity_tags` |
| 1147–1172 | POST /api/gcr/transcribe — Whisper proxy (keeps OpenAI key server-side | 1 — `POST /api/gcr/transcribe` | — |
| 1173–1198 | POST /api/gcr/speak — TTS proxy (keeps OpenAI key server-side) | 1 — `POST /api/gcr/speak` | — |
| 1199–1260 | POST /api/gcr/search-structured — Public structured search | 1 — `POST /api/gcr/search-structured` | `entity`, `menu_items` |
| 1367–1467 | POST /api/gcr/ask — RAG question answering | 1 — `POST /api/gcr/ask` | `tourist_profiles`, `tourist_saves` |
| 1468–1596 | POST /api/gcr/reindex/:slug — Re-embed a single business (admin use) | 1 — `POST /api/gcr/reindex/:slug` | `business_embeddings`, `businesses`, `events`, `fleet_types`, `menu_items`, `rental_group_rates`, `rental_pricing`, `reviews`, `site_content`, `specials` |
| 1657–1867 | GET /api/gcr/entities — List all GCR entities | 1 — `GET /api/gcr/entities` | `entity`, `entity_features`, `entity_hours`, `entity_photos`, `entity_sections`, `entity_tags`, `section_rich_text` |
| 1868–2132 | GET /api/gcr/entity/:slug — Full entity profile | 1 — `GET /api/gcr/entity/:slug` | `activities`, `addons`, `booking_slots`, `drink_items`, `drink_sections`, `entity`, `entity_about_bullets`, `entity_events`, `entity_features`, `entity_happy_hours` … |
| 2156–2294 | PATCH /api/admin/gcr/entities/:id — Update entity | 1 — `PATCH /api/gcr/admin/gcr/entities/:id` | `entity`, `entity_hours`, `entity_photos`, `entity_tags` |
| 2295–2358 | POST /api/admin/gcr/entities — Create entity | 1 — `POST /api/gcr/admin/gcr/entities` | `entity` |
| 2359–2403 | DELETE /api/admin/gcr/entities/:id — Delete entity | 1 — `DELETE /api/gcr/admin/gcr/entities/:id` | `entity` |
| 2404–2420 | GET /api/gcr/category-page-config/:categoryId | 1 — `GET /api/gcr/category-page-config/:categoryId` | `gcr_category_page_config` |
| 2421–2458 | GET  /api/gcr/sales-page/:pageId — public | 2 — `GET /api/gcr/sales-page/:pageId`, `PUT /api/gcr/sales-page/:pageId` | `site_data_store` |
| 2459–2544 | POST /api/gcr/lead-notify | 1 — `POST /api/gcr/lead-notify` | — |
| 2545–2616 | POST /api/gcr/nfc-card-lead — save NFC card form submission to sales_l | 1 — `POST /api/gcr/nfc-card-lead` | `sales_leads` |
| 2617–2697 | POST /api/gcr/claim — submit a listing claim request from claim.html p | 1 — `POST /api/gcr/claim` | `gcr_claims` |
| 2698–3094 | POST /api/gcr/track — Platform-wide analytics (GCR + TripSwipe page vi | 11 — `GET /api/gcr/menu-themes`, `GET /api/gcr/menu-themes/:id`, `POST /api/gcr/menu-themes/generate`, `POST /api/gcr/menu-themes/:id/apply`, `GET /api/gcr/analytics`, `GET /api/gcr/settings/:key` +5 more | `drink_items`, `drink_sections`, `entity`, `entity_specials`, `gcr_page_views`, `gcr_settings`, `menu_items`, `menu_sections`, `qr_menu_themes`, `tourist_photos` |
| 3095–3150 | AD NETWORK — rotating ads shown on free-tier QR menus | 3 — `GET /api/gcr/ads`, `POST /api/gcr/ads/:id/impression`, `POST /api/gcr/ads/:id/click` | `gcr_ads` |
| 3151–3330 | GET /api/gcr/live-now — businesses with active signals right now | 1 — `GET /api/gcr/live-now` | `entity`, `entity_events`, `entity_specials`, `entity_tags`, `user_preference_scores` |
| 3331–3367 | GET /api/gcr/locations/autocomplete — location search with distance | 1 — `GET /api/gcr/locations/autocomplete` | `entity` |
| 3368–3403 | POST /api/gcr/swipe-item — track user swipes on gallery items | 1 — `POST /api/gcr/swipe-item` | `item_swipes` |
| 3404–3454 | GET /api/gcr/entities/:slug — entity with galleries & sections | 1 — `GET /api/gcr/entities/:slug` | `entity`, `entity_galleries`, `entity_sections`, `section_items` |
| 3455–3511 | GET /api/gcr/entities/:entityId/gallery/:galleryType — get gallery ite | 1 — `GET /api/gcr/entities/:entityId/gallery/:galleryType` | `entity_galleries`, `entity_sections`, `section_items` |
| 3512–3667 | DAILY MENU EDITOR - PIN MANAGEMENT & UPDATE | 2 — `POST /api/gcr/entity/:slug/set-pin`, `POST /api/gcr/entity/:slug/daily-update` | `drink_items`, `entity`, `entity_events`, `entity_specials`, `happy_hour_items`, `menu_items` |
| 3668–3734 | GET /api/gcr/menu-items — all menu items for trip swipe (uses same sec | 1 — `GET /api/gcr/menu-items` | `entity`, `entity_sections`, `section_items` |


### `routes/public.js` — /api/public (3154 lines, 46 sections)

| Lines | Section | Routes | Tables touched |
|---|---|---|---|
| 116–316 | POST /api/public/waivers/send-link — Dashboard: manually send waiver l | 2 — `POST /api/public/waivers/send-link`, `POST /api/public/resend-confirmation` | `bookings`, `businesses`, `signed_waivers`, `site_content`, `waivers` |
| 317–345 | GET /api/public/waivers/:token — Fetch waiver to sign (no site require | 1 — `GET /api/public/waivers/:token` | `waivers` |
| 346–422 | POST /api/public/waivers/:token/sign — Sign a waiver by token (no site | 1 — `POST /api/public/waivers/:token/sign` | `bookings`, `businesses`, `notifications`, `waivers` |
| 423–444 | GET /api/public/profile | 1 — `GET /api/public/profile` | `businesses`, `site_content` |
| 445–462 | GET /api/public/services | 1 — `GET /api/public/services` | `services` |
| 463–486 | GET /api/public/gallery | 1 — `GET /api/public/gallery` | `media`, `site_content` |
| 487–506 | GET /api/public/reviews | 1 — `GET /api/public/reviews` | `reviews` |
| 507–519 | GET /api/public/faqs | 1 — `GET /api/public/faqs` | `faqs` |
| 520–532 | GET /api/public/hours | 1 — `GET /api/public/hours` | `site_content` |
| 533–545 | GET /api/public/team | 1 — `GET /api/public/team` | `staff` |
| 546–558 | GET /api/public/specials | 1 — `GET /api/public/specials` | `specials` |
| 559–571 | GET /api/public/social | 1 — `GET /api/public/social` | `site_content` |
| 572–616 | GET /api/public/fleet — rental fleet types + pricing | 1 — `GET /api/public/fleet` | `fleet_types`, `rental_addons`, `rental_group_rates`, `rental_pricing`, `rental_time_slots` |
| 617–628 | GET /api/public/blackout-dates | 1 — `GET /api/public/blackout-dates` | `blackout_dates` |
| 629–746 | GET /api/public/availability?date=YYYY-MM-DD | 1 — `GET /api/public/availability` | `availability`, `availability_blocks`, `booking_holds`, `bookings`, `fleet_items`, `fleet_types`, `rental_time_slots` |
| 747–799 | POST /api/public/hold — Reserve slot during checkout (10 min) | 1 — `POST /api/public/hold` | `blackout_dates` |
| 800–814 | DELETE /api/public/hold — Release a hold (customer abandons checkout) | 1 — `DELETE /api/public/hold` | `booking_holds` |
| 817–1059 | POST /api/public/bookings/:id/payment-failed — mark booking as payment | 2 — `POST /api/public/bookings/:id/payment-failed`, `POST /api/public/bookings` | `bookings`, `businesses`, `customers`, `messaging_settings`, `site_content`, `waivers` |
| 1060–1106 | POST /api/public/track — Page view + conversion tracking | 1 — `POST /api/public/track` | `conversions`, `page_views` |
| 1107–1130 | POST /api/public/events — Session event tracking (clicks, scrolls, etc | 1 — `POST /api/public/events` | `session_events` |
| 1131–1152 | POST /api/public/funnel — Booking funnel step tracking | 1 — `POST /api/public/funnel` | `booking_funnel` |
| 1153–1243 | POST /api/public/contact — Submit contact form | 1 — `POST /api/public/contact` | `businesses`, `messaging_settings`, `notifications`, `site_content` |
| 1244–1841 | POST /api/public/chat — Tourist AI chat (Grok) or business public chat | 1 — `POST /api/public/chat` | `availability`, `booking_holds`, `bookings`, `business_atmosphere`, `business_details`, `business_logistics`, `businesses`, `customers`, `fleet_items`, `fleet_types` … |
| 1842–1926 | POST /api/public/gcr-chat — GCR voice/text AI search | 1 — `POST /api/public/gcr-chat` | `businesses` |
| 1927–1979 | GET /api/public/waiver — Fetch waiver to sign | 1 — `GET /api/public/waiver` | `waivers` |
| 1980–2058 | POST /api/public/waiver — Sign waiver | 1 — `POST /api/public/waiver` | `bookings`, `waivers` |
| 2059–2102 | GET /api/public/reviews?token=X — Load review page data (booking + cus | 1 — `GET /api/public/reviews-by-token` | `bookings`, `review_questions`, `reviews` |
| 2103–2148 | POST /api/public/reviews/submit — submit a review (simplified path) | 1 — `POST /api/public/reviews/submit` | `reviews` |
| 2149–2296 | POST /api/public/review — Submit review (with token support & photo up | 1 — `POST /api/public/review` | `review_answers`, `reviews`, `site_content` |
| 2297–2326 | GET /api/public/loyalty/balance — Check loyalty balance by email or ph | 1 — `GET /api/public/loyalty/balance` | `customers` |
| 2327–2349 | GET /api/public/loyalty/:email — Check loyalty points (legacy) | 1 — `GET /api/public/loyalty/:email` | `customers` |
| 2350–2391 | POST /api/public/order — Place order (restaurants) | 1 — `POST /api/public/order` | `orders` |
| 2392–2441 | POST /api/public/loyalty/signup — Enroll customer in loyalty program | 1 — `POST /api/public/loyalty/signup` | `customers` |
| 2442–2479 | POST /api/public/loyalty/redeem — Redeem loyalty points | 1 — `POST /api/public/loyalty/redeem` | `customers` |
| 2480–2498 | GET /api/public/site-data — Business info for website header/footer | 1 — `GET /api/public/site-data` | `businesses`, `site_content` |
| 2499–2522 | GET /api/public/locations — Launch locations | 1 — `GET /api/public/locations` | `site_content` |
| 2523–2537 | GET /api/public/docks — Towable dock add-ons | 1 — `GET /api/public/docks` | `rental_addons` |
| 2538–2571 | GET /api/public/links-page — Linktree-style links page data | 1 — `GET /api/public/links-page` | `businesses`, `site_apps`, `site_content` |
| 2572–2586 | GET /api/public/addons | 1 — `GET /api/public/addons` | `rental_addons` |
| 2587–2600 | GET /api/public/modules — ordered module list for site template + embe | 1 — `GET /api/public/modules` | `site_content` |
| 2601–2625 | POST /api/public/save-section — Save a CMS section (page builder) | 1 — `POST /api/public/save-section` | `site_content` |
| 2626–2742 | POST /api/public/resend-confirmation — Resend booking confirmation SMS | 1 — `POST /api/public/resend-confirmation` | `bookings`, `businesses`, `signed_waivers`, `site_content` |
| 2743–2784 | GET /api/payment-config (public, requireSite) | 1 — `GET /api/public/payment-config` | `connections` |
| 2785–2852 | GET /api/public/business — Complete business data (menu, events, hours | 1 — `GET /api/public/business` | `businesses`, `events`, `menu_items`, `site_content`, `specials` |
| 2853–3154 | GET /api/public/menu — Public menu with categories, items, prices, ima | 5 — `GET /api/public/menu`, `POST /api/public/waivers/send-link`, `GET /api/public/waivers/send-reminders`, `GET /api/public/gcr-stats`, `POST /api/public/business-lead` | `bookings`, `business_leads`, `businesses`, `entity`, `events`, `menu_items`, `site_content`, `specials`, `waivers` |


### `routes/tourist.js` — /api/tourist (1374 lines, 4 sections)

| Lines | Section | Routes | Tables touched |
|---|---|---|---|
| 27–1129 | Tourist middleware: verify Supabase JWT, attach tourist user id ────── | 26 — `POST /api/tourist/backfill-anonymous`, `GET /api/tourist/me`, `DELETE /api/tourist/seen`, `POST /api/tourist/seen`, `GET /api/tourist/saves`, `POST /api/tourist/saves` +20 more | `entity`, `entity_tags`, `gcr_page_views`, `qr_scans`, `session_events`, `tourist_ai_conversations`, `tourist_ai_messages`, `tourist_itineraries`, `tourist_memories`, `tourist_profiles` … |
| 1130–1169 | Community Photos ───────────────────────────────────────────────────── | 2 — `POST /api/tourist/photos`, `GET /api/tourist/photos` | `tourist_photos` |
| 1170–1299 | POST /api/tourist/location — browser sends GPS, we store it + check ge | 1 — `POST /api/tourist/location` | `entity`, `platform_settings`, `specials`, `tourist_profiles`, `tourist_sms_log`, `user_preference_scores` |
| 1300–1374 | POST /api/tourist/sms-campaign — admin triggers a targeted Sendblue bl | 1 — `POST /api/tourist/sms-campaign` | `platform_settings`, `tourist_profiles`, `tourist_sms_log`, `user_preference_scores` |


### `routes/update-link.js` — /api/update (1203 lines, 7 sections)

| Lines | Section | Routes | Tables touched |
|---|---|---|---|
| 94–441 | Token validation middleware (for all public /:token/* routes) ──────── | 9 — `POST /api/update/generate`, `PUT /api/update/links/:token/passcode`, `POST /api/update/send-sms`, `GET /api/update/status/:entity_id`, `GET /api/update/today`, `GET /api/update/:token` +3 more | `businesses`, `drink_items`, `drink_sections`, `entity`, `entity_events`, `entity_photos`, `entity_sections`, `entity_specials`, `events`, `happy_hour_items` … |
| 442–472 | Specials ────────────────────────────────────────────────── | 2 — `POST /api/update/:token/specials`, `DELETE /api/update/:token/specials/:id` | `entity_specials`, `specials` |
| 473–566 | Menu sections + items ───────────────────────────────────── | 5 — `POST /api/update/:token/menu-sections`, `PUT /api/update/:token/menu-sections/:id`, `DELETE /api/update/:token/menu-sections/:id`, `POST /api/update/:token/menu-items`, `DELETE /api/update/:token/menu-items/:id` | `entity_sections`, `menu_items`, `menu_sections`, `section_items` |
| 567–610 | Drink items ─────────────────────────────────────────────── | 2 — `POST /api/update/:token/drink-items`, `DELETE /api/update/:token/drink-items/:id` | `drink_items`, `entity_sections`, `section_items` |
| 611–639 | Happy Hour ──────────────────────────────────────────────── | 3 — `PUT /api/update/:token/happy-hour`, `POST /api/update/:token/hh-items`, `DELETE /api/update/:token/hh-items/:id` | `entity`, `happy_hour_items` |
| 640–661 | Events ──────────────────────────────────────────────────── | 2 — `POST /api/update/:token/events`, `DELETE /api/update/:token/events/:id` | `entity_events` |
| 662–1203 | Catch of the Day ────────────────────────────────────── | 13 — `GET /api/update/:token/catch`, `POST /api/update/:token/catch`, `DELETE /api/update/:token/catch/:id`, `GET /api/update/:token/daily-rotation`, `POST /api/update/:token/daily-rotation/submit`, `POST /api/update/:token/setup/parse-image` +7 more | `businesses`, `daily_rotation_options`, `daily_rotation_picks`, `daily_rotation_sections`, `entity`, `menu_items`, `menu_sections`, `update_links` |


### `routes/user.js` — /api/user (450 lines, 12 sections)

| Lines | Section | Routes | Tables touched |
|---|---|---|---|
| 35–72 | ─ PROFILE ──────────────────────────────────────────────────────────── | 2 — `GET /api/user/profile`, `PUT /api/user/profile` | `entity`, `entity_hours`, `installed_modules`, `profiles` |
| 73–159 | ─ MENU ─────────────────────────────────────────────────────────────── | 7 — `GET /api/user/menu`, `POST /api/user/menu/sections`, `PUT /api/user/menu/sections/:id`, `DELETE /api/user/menu/sections/:id`, `POST /api/user/menu/items`, `PUT /api/user/menu/items/:id` +1 more | `menu_items`, `menu_sections`, `menu_sub_sections` |
| 160–174 | ─ DRINKS ───────────────────────────────────────────────────────────── | 1 — `GET /api/user/drinks` | `drink_items`, `drink_sections` |
| 175–243 | ─ HAPPY HOUR ───────────────────────────────────────────────────────── | 6 — `GET /api/user/happy-hours`, `POST /api/user/happy-hours/sections`, `PUT /api/user/happy-hours/sections/:id`, `POST /api/user/happy-hours/items`, `PUT /api/user/happy-hours/items/:id`, `DELETE /api/user/happy-hours/items/:id` | `happy_hour_items`, `happy_hour_sections` |
| 244–287 | ─ SPECIALS ─────────────────────────────────────────────────────────── | 4 — `GET /api/user/specials`, `POST /api/user/specials`, `PUT /api/user/specials/:id`, `DELETE /api/user/specials/:id` | `entity_specials` |
| 288–331 | ─ EVENTS ───────────────────────────────────────────────────────────── | 4 — `GET /api/user/events`, `POST /api/user/events`, `PUT /api/user/events/:id`, `DELETE /api/user/events/:id` | `entity_events` |
| 332–364 | ─ PHOTOS / MEDIA ───────────────────────────────────────────────────── | 3 — `GET /api/user/photos`, `POST /api/user/photos`, `DELETE /api/user/photos/:id` | `entity_photos` |
| 365–389 | ─ HOURS ────────────────────────────────────────────────────────────── | 2 — `GET /api/user/hours`, `PUT /api/user/hours` | `entity_hours` |
| 390–413 | ─ MODULES ──────────────────────────────────────────────────────────── | 2 — `GET /api/user/modules`, `PUT /api/user/modules` | `installed_modules` |
| 414–425 | ─ FLEET / RENTALS ──────────────────────────────────────────────────── | 1 — `GET /api/user/fleet` | `fleet_items` |
| 426–437 | ─ BOOKINGS ─────────────────────────────────────────────────────────── | 1 — `GET /api/user/bookings` | `bookings` |
| 438–450 | ─ FEATURES / TAGS ──────────────────────────────────────────────────── | 1 — `GET /api/user/features` | `entity_features` |


### `routes/site.js` — /api/site (456 lines, 5 sections)

| Lines | Section | Routes | Tables touched |
|---|---|---|---|
| 338–363 | FLEET TYPES ────────────────────────────────────────────────────────── | 4 — `GET /api/site/fleet`, `POST /api/site/fleet`, `PUT /api/site/fleet/:id`, `DELETE /api/site/fleet/:id` | `fleet_types` |
| 364–389 | TIME SLOTS ─────────────────────────────────────────────────────────── | 4 — `GET /api/site/time-slots`, `POST /api/site/time-slots`, `PUT /api/site/time-slots/:id`, `DELETE /api/site/time-slots/:id` | `rental_time_slots` |
| 390–406 | PRICING ────────────────────────────────────────────────────────────── | 2 — `GET /api/site/pricing`, `POST /api/site/pricing` | `rental_pricing` |
| 407–432 | ADD-ONS ────────────────────────────────────────────────────────────── | 4 — `GET /api/site/addons`, `POST /api/site/addons`, `PUT /api/site/addons/:id`, `DELETE /api/site/addons/:id` | `rental_addons` |
| 433–456 | WAIVERS ────────────────────────────────────────────────────────────── | 3 — `GET /api/site/waivers/template`, `PUT /api/site/waivers/template`, `GET /api/site/waivers/signed` | `site_content`, `waivers` |


### `routes/qr.js` — /api/qr (715 lines, 6 sections)

| Lines | Section | Routes | Tables touched |
|---|---|---|---|
| 29–192 | Admin / Dashboard — authenticated | 8 — `GET /api/qr/`, `POST /api/qr/batch`, `POST /api/qr/`, `PATCH /api/qr/:id`, `DELETE /api/qr/:id`, `GET /api/qr/:id/scans` +2 more | `qr_codes`, `qr_events`, `qr_scans` |
| 193–502 | Public — no auth (scan tracking + phone capture) | 10 — `POST /api/qr/scan/:code`, `POST /api/qr/track`, `POST /api/qr/capture/:code`, `GET /api/qr/partners`, `POST /api/qr/partners`, `PUT /api/qr/partners/:id` +4 more | `customers`, `qr_codes`, `qr_events`, `qr_scans`, `referral_events`, `referral_partners` |
| 503–536 | QR Alert Settings — per-code or global (admin) | 2 — `PATCH /api/qr/:id/alert`, `POST /api/qr/alert-settings/global` | `app_settings`, `qr_codes` |
| 537–625 | QR Location Mappings — trackable home page QR IDs | 3 — `GET /api/qr/locations`, `POST /api/qr/locations`, `DELETE /api/qr/locations/:id` | `app_settings` |
| 626–715 | Digest cron — called by Vercel cron daily + weekly | 2 — `GET /api/qr/digest/daily`, `GET /api/qr/digest/weekly` | `app_settings`, `qr_codes`, `qr_scans` |


### `routes/reviews.js` — /api/reviews (562 lines, 12 sections)

| Lines | Section | Routes | Tables touched |
|---|---|---|---|
| 18–70 | POS WEBHOOK — receives daily order data from Toast / Square | 1 — `POST /api/reviews/webhook/pos` | `pos_orders` |
| 71–135 | SEND REVIEW REQUEST — manually or from cron/auto job | 1 — `POST /api/reviews/request` | `pos_orders`, `review_requests` |
| 136–227 | AUTO-SEND CRON — send requests for yesterday's POS orders | 1 — `GET /api/reviews/send-daily` | `customer_consents`, `pos_orders`, `review_requests` |
| 228–273 | CONSENT — customer opts in at booking time | 2 — `POST /api/reviews/consent`, `GET /api/reviews/consents` | `customer_consents` |
| 274–368 | INBOUND SMS — Twilio webhook for customer replies | 1 — `POST /api/reviews/inbound-sms` | `entity`, `review_requests`, `review_sms_state`, `reviews` |
| 369–412 | WEB SUBMISSION — from review.html page | 1 — `POST /api/reviews/submit` | `entity`, `review_requests`, `reviews` |
| 413–429 | GET request info (for review.html to load) | 1 — `GET /api/reviews/request/:token` | `entity`, `review_requests` |
| 430–463 | PUBLIC — reviews for a business page (no auth) | 1 — `GET /api/reviews/public/:site_id` | `entity`, `reviews` |
| 464–523 | ADMIN — list reviews | 5 — `GET /api/reviews/`, `GET /api/reviews/stats`, `GET /api/reviews/requests`, `PATCH /api/reviews/:id`, `DELETE /api/reviews/:id` | `review_requests`, `reviews` |
| 524–536 | POS ORDERS — list for admin | 1 — `GET /api/reviews/pos-orders` | `pos_orders` |


### `routes/stripe.js` — /api/stripe (812 lines, 16 sections)

| Lines | Section | Routes | Tables touched |
|---|---|---|---|
| 73–99 | GET /api/stripe/connect-url | 1 — `GET /api/stripe/connect-url` | — |
| 100–163 | GET /api/stripe/connect-callback | 1 — `GET /api/stripe/connect-callback` | `connections` |
| 164–190 | GET /api/stripe/status | 1 — `GET /api/stripe/status` | `connections` |
| 191–213 | POST /api/stripe/set-mode | 1 — `POST /api/stripe/set-mode` | `connections` |
| 214–286 | POST /api/stripe/save-key | 1 — `POST /api/stripe/save-key` | `businesses`, `connections` |
| 287–298 | DELETE /api/stripe/delete-key | 1 — `DELETE /api/stripe/delete-key` | `connections` |
| 299–461 | POST /api/stripe/create-payment-intent | 1 — `POST /api/stripe/create-payment-intent` | `bookings`, `businesses`, `connections`, `site_content`, `waivers` |
| 462–495 | POST /api/stripe/disconnect | 1 — `POST /api/stripe/disconnect` | `connections` |
| 496–505 | GET /api/stripe/publishable-key | 1 — `GET /api/stripe/publishable-key` | — |
| 506–518 | GET /api/stripe/config | 1 — `GET /api/stripe/config` | — |
| 519–577 | POST /api/stripe/send-key-link | 1 — `POST /api/stripe/send-key-link` | `businesses`, `connections` |
| 578–619 | GET /api/stripe/key-link/:token | 1 — `GET /api/stripe/key-link/:token` | `businesses`, `connections` |
| 620–716 | POST /api/stripe/submit-key-via-link | 1 — `POST /api/stripe/submit-key-via-link` | `businesses`, `connections` |
| 759–812 | POST /api/stripe/webhook — Stripe event handler | 1 — `POST /api/stripe/webhook` | `bookings` |


### `routes/sms.js` — /api/sms (670 lines, 5 sections)

| Lines | Section | Routes | Tables touched |
|---|---|---|---|
| 168–670 | Helper: store a message ────────────────────────────────────────────── | 9 — `POST /api/sms/inbound`, `POST /api/sms/reply`, `GET /api/sms/inbox`, `GET /api/sms/thread/:phone`, `POST /api/sms/send`, `POST /api/sms/blast` +3 more | `bookings`, `businesses`, `entity`, `messages`, `waivers` |

---

## 5. Table ownership — where the coupling actually is

A module can leave cleanly when every table it writes appears in the single-owner list.
Every table in the contested list is a seam you must decide about: copy it, share it,
or put an interface in front of it.

The five that hold this repo together — **`businesses` (17 files), `entity` (13),
`bookings` (11), `menu_items` (11), `connections` (10)** — are the real architecture.
Everything else is detail.

Practical rule per seam:

- **`businesses`** — the tenant record. Any extracted module needs a tenant id. Replace
  the join with a `site_id` parameter the host app passes in; don't carry the table.
- **`entity`** — the GCR business record. Same idea, keyed by slug. `lib/entity-resolver.js`
  is already the interface — 61 lines, take it.
- **`connections`** — per-business OAuth/payment credentials. Belongs to a
  `connections` core service, not to each booking module. Every one of charter /
  boat-rental / photographer / rides reads it only to find the Stripe account.
- **`bookings`** — shared by 11 files with different column expectations. If you extract
  one booking vertical, give it its own bookings table (`charter_bookings` already exists
  — follow that pattern) rather than the shared one.
- **`menu_items` / `drink_items` / `happy_hour_items` + sections** — one menu domain
  written by 8-11 files. This should be one `menu` module with an API, not eleven
  direct writers. `lib/menu-gcr.js` is the start of it.

### Shared / contested tables (3+ modules touch them)

| Table | # files | Files |
|---|---|---|
| `businesses` | 17 | admin, analytics, auth, boat-rental, charter, dashboard, domain, gcr, photographer, public, rides, site, sms, square, stripe, update-link, webhooks |
| `entity` | 13 | admin, dashboard, entity-resolver, gcr, menu-edit, public, reviews, routes, simple-menu-edit, sms, tourist, update-link, user |
| `bookings` | 11 | admin, dashboard, gcr, public, routes, site, sms, square, stripe, user, webhooks |
| `menu_items` | 11 | admin, dashboard, gcr, menu-edit, public, routes, simple-menu-edit, site, sms, update-link, user |
| `connections` | 10 | admin, boat-rental, charter, dashboard, photographer, public, rides, site, square, stripe |
| `entity_specials` | 9 | admin, dashboard, gcr, public, routes, simple-menu-edit, sms, update-link, user |
| `site_content` | 9 | admin, auth, dashboard, gcr, public, site, sms, stripe, webhooks |
| `drink_items` | 8 | admin, dashboard, gcr, menu-edit, public, simple-menu-edit, update-link, user |
| `drink_sections` | 8 | admin, dashboard, gcr, menu-edit, public, simple-menu-edit, update-link, user |
| `happy_hour_items` | 8 | admin, dashboard, gcr, menu-edit, public, simple-menu-edit, update-link, user |
| `happy_hour_sections` | 8 | admin, dashboard, gcr, menu-edit, public, simple-menu-edit, update-link, user |
| `customers` | 7 | admin, dashboard, live-photo, public, qr, site, sms |
| `entity_events` | 7 | admin, dashboard, gcr, public, simple-menu-edit, update-link, user |
| `entity_photos` | 7 | admin, dashboard, gcr, public, simple-menu-edit, update-link, user |
| `menu_sections` | 7 | admin, gcr, menu-edit, public, simple-menu-edit, update-link, user |
| `specials` | 7 | admin, dashboard, gcr, public, site, tourist, update-link |
| `waivers` | 7 | admin, dashboard, public, site, sms, square, stripe |
| `events` | 6 | admin, dashboard, gcr, public, site, update-link |
| `fleet_types` | 6 | admin, dashboard, gcr, public, site, sms |
| `rental_time_slots` | 6 | admin, dashboard, gcr, public, site, sms |
| `reviews` | 6 | admin, dashboard, gcr, google-business, public, reviews |
| `site_apps` | 6 | admin, apps, auth, dashboard, public, site |
| `tourist_profiles` | 6 | admin, admin-tourists, gcr, tourist, tourist-auth, webhooks |
| `entity_hours` | 5 | admin, dashboard, gcr, public, user |
| `fleet_items` | 5 | admin, dashboard, gcr, public, user |
| `orders` | 5 | admin, dashboard, public, site, webhooks |
| `platform_settings` | 5 | admin, square, tourist, tourist-auth, webhooks |
| `rental_addons` | 5 | admin, dashboard, gcr, public, site |
| `rental_pricing` | 5 | admin, dashboard, gcr, public, site |
| `services` | 5 | admin, dashboard, gcr, public, site |
| `tourist_saves` | 5 | admin, admin-tourists, gcr, tourist, tourist-groups |
| `conversions` | 4 | admin, analytics, public, sms |
| `entity_tags` | 4 | admin, dashboard, gcr, tourist |
| `faqs` | 4 | admin, dashboard, gcr, public |
| `gcr_page_views` | 4 | admin, gcr, tourist, tourist-auth |
| `messaging_settings` | 4 | admin, dashboard, public, square |
| `notifications` | 4 | admin, dashboard, public, webhooks |
| `page_views` | 4 | admin, analytics, public, sms |
| `rental_group_rates` | 4 | admin, dashboard, gcr, public |
| `session_events` | 4 | admin, public, tourist, tourist-auth |
| `sms_log` | 4 | admin, dashboard, sms, webhooks |
| `sms_opt_outs` | 4 | admin, dashboard, sms, webhooks |
| `staff` | 4 | admin, dashboard, gcr, public |
| `user_preference_scores` | 4 | admin, admin-tourists, gcr, tourist |
| `apps` | 3 | admin, apps, dashboard |
| `availability` | 3 | admin, dashboard, public |
| `availability_blocks` | 3 | admin, dashboard, public |
| `business_atmosphere` | 3 | admin, dashboard, public |
| `business_details` | 3 | admin, dashboard, public |
| `business_logistics` | 3 | admin, dashboard, public |
| `entity_features` | 3 | admin, gcr, user |
| `entity_sections` | 3 | admin, gcr, update-link |
| `media` | 3 | admin, dashboard, public |
| `qa_pairs` | 3 | admin, dashboard, public |
| `qr_scans` | 3 | qr, tourist, tourist-auth |
| `section_items` | 3 | admin, gcr, update-link |
| `tourist_photos` | 3 | admin, gcr, tourist |
| `tourist_sessions` | 3 | gcr, public, tourist-auth |

### Single-owner tables (exactly one file) — these travel with their module

| Owner file | Tables |
|---|---|
| `admin` | `ai_chat_conversations`, `audit_log`, `business_filters`, `business_highlights`, `entity_activities`, `entity_analytics`, `entity_booking_slots`, `entity_drink_items`, `entity_drink_sections`, `entity_happy_hour_items`, `entity_integrations`, `entity_menu_items`, `entity_menu_sections`, `entity_policies`, `entity_pricing`, `entity_requirements`, `entity_reviews`, `entity_section_bullets`, `entity_section_items`, `gcr_category_cards`, `gcr_conversions`, `gcr_coupons`, `gcr_customers`, `gcr_entity_pages`, `gcr_faqs`, `gcr_messaging_settings`, `gcr_page_assignments`, `gcr_seo_settings`, `gcr_site_config`, `gcr_social_accounts`, `geofence_triggers`, `geofences`, `itineraries`, `packages`, `platform_page_views`, `seo_keywords`, `seo_meta_tags`, `sms_blasts`, `social_media_analytics`, `support_tickets`, `templates`, `tourist_location_settings`, `tourist_locations`, `tourist_preferences`, `tripswipe_business_settings` |
| `boat-rental` | `boat_blocks`, `boat_listings`, `boat_rentals` |
| `charter` | `charter_blocks`, `charter_bookings`, `charter_departure_times`, `charter_listings` |
| `dashboard` | `activity_log`, `coupon_claims`, `domains`, `entity_promotions`, `faq_items`, `media_library`, `promotions` |
| `entity-resolver` | `entity_owners` |
| `fareharbor` | `integrations` |
| `gcr` | `entity_galleries`, `gcr_settings`, `product_sections`, `product_sub_sections`, `qr_menu_themes`, `section_reviews`, `site_data_store` |
| `live-photo` | `customer_live_photos` |
| `modules` | `module_manifest`, `user_modules` |
| `photographer` | `photo_availability`, `photo_blocks`, `photo_bookings`, `photo_sessions` |
| `public` | `blackout_dates`, `booking_holds`, `review_answers`, `signed_waivers`, `social_media_accounts`, `tourist_conversations` |
| `qr` | `app_settings`, `qr_codes`, `qr_events`, `referral_events`, `referral_partners` |
| `reviews` | `customer_consents`, `pos_orders`, `review_requests`, `review_sms_state` |
| `rides` | `ride_dispatches`, `ride_requests`, `taxi_drivers` |
| `routes` | `sms_automation_logs`, `sms_automations`, `sms_update_links` |
| `setup-questions` | `tourist_setup_questions` |
| `tourist` | `tourist_ai_conversations`, `tourist_ai_messages`, `tourist_memories` |
| `tourist-groups` | `tourist_group_invites`, `tourist_group_members`, `tourist_groups` |
| `update-link` | `daily_rotation_picks` |
| `user` | `installed_modules` |

### Two-file tables

| Table | Files |
|---|---|
| `activities` | admin, gcr |
| `addons` | admin, gcr |
| `ai_conversations` | admin, dashboard |
| `ai_messages` | admin, dashboard |
| `ai_settings` | admin, gcr |
| `availability_slots` | availability, fareharbor |
| `booking_funnel` | admin, public |
| `booking_slots` | admin, gcr |
| `business_embeddings` | admin, gcr |
| `business_leads` | admin, public |
| `business_media` | admin, gcr |
| `business_memories` | admin, dashboard |
| `coupons` | admin, dashboard |
| `daily_rotation_options` | admin, update-link |
| `daily_rotation_sections` | admin, update-link |
| `entity_about_bullets` | admin, gcr |
| `entity_happy_hours` | admin, gcr |
| `entity_perfect_for` | admin, gcr |
| `entity_qna` | admin, gcr |
| `gcr_ads` | admin, gcr |
| `gcr_category_page_config` | admin, gcr |
| `gcr_claims` | admin, gcr |
| `gcr_reviews` | admin, dashboard |
| `integration_items` | availability, fareharbor |
| `item_swipes` | admin, gcr |
| `meeting_points` | admin, gcr |
| `menu_categories` | admin, dashboard |
| `menu_sub_sections` | gcr, user |
| `menu_subcategories` | admin, dashboard |
| `messages` | routes, sms |
| `oauth_tokens` | admin, google-business |
| `onboarding_progress` | admin, dashboard |
| `policies` | admin, gcr |
| `pricing_items` | admin, gcr |
| `product_items` | admin, gcr |
| `profiles` | admin, user |
| `requirements` | admin, gcr |
| `review_questions` | dashboard, public |
| `sales_leads` | admin, gcr |
| `section_bullets` | admin, gcr |
| `section_cards` | admin, gcr |
| `section_groups` | admin, gcr |
| `section_hours` | admin, gcr |
| `section_location` | admin, gcr |
| `section_photos` | admin, gcr |
| `section_rich_text` | admin, gcr |
| `site_pages` | admin, dashboard |
| `sms_campaigns` | admin, dashboard |
| `tourist_itineraries` | admin-tourists, tourist |
| `tourist_sms_log` | tourist, webhooks |
| `tourist_swipe_events` | admin-tourists, tourist |
| `update_links` | admin, update-link |
| `users` | admin, auth |
| `whats_included` | admin, gcr |

---

## 6. Extraction recipe

Same seven steps every time.

1. **Make the folder.** `modules/<id>/` with `index.js` (the manifest from §0),
   `routes.js` (the copied route file), `migrations.sql` (its owned tables).
2. **Lift the schema.** For `charter.js`, `boat-rental.js`, `photographer.js`,
   `rides.js`, `fareharbor.js`, `modules.js` the `CREATE TABLE` block is already in the
   file header — cut it into `migrations.sql` and delete the comment. For the rest,
   pull the owned tables from §5 out of `supabase/01-tables.sql` and `migrations/`.
3. **Rewrite imports.** `../db` → `../../core/db`, `../middleware/auth` →
   `../../core/auth`, `../utils/sms` → `../../core/sms`. Nothing else should be
   reachable from a module.
4. **Kill the cross-module requires.** `tourist-groups.js` and `admin-tourists.js`
   both `require('./tourist')` — export those helpers into `lib/` instead. No module
   requires another module.
5. **Replace shared-table joins with parameters** (§5). A module gets `site_id` /
   `entity_slug` handed to it; it does not look up who the tenant is.
6. **Declare the manifest** — `ownsTables`, `sharedTables`, `requiredCore`,
   `requiredEnv`, `grokTools`. If `sharedTables` isn't empty, that's your remaining debt,
   written down.
7. **Register and mount** — `require('./modules/<id>')` in `server.js`, then
   `registry.mountAll(app)` once. Delete the old `app.use()` line.

## 7. Order to do it in

1. **`core/crypto` first** — it's duplicated 4× and three modules can't leave without it.
2. **Kernel** — `db`, `gcr-db`, `auth`, `sms`, `email`, `ai`, `registry` into `core/`.
   Nothing moves until these have stable paths.
3. **Wire `mountAll`** with one throwaway module to prove the registry works
   (`links.js`, 28 lines, is the cheapest test).
4. **Tier 1, biggest win first**: `photographer` → `charter` → `boat-rental`. All three
   are the same shape, so the third takes an hour. That shape is your reusable
   deposit-booking module.
5. **`google-business` and `fareharbor`** — self-contained integrations, and doing them
   forces `core/crypto` to be right.
6. **Tier 2** once you've decided the `connections` seam.
7. **Monoliths last**, using §4. `dashboard.js` splits cleanest (66 labelled sections,
   most of them a 4-route CRUD block over one table). `admin.js` is 113 sections but
   ~40 of them are the GCR import pipeline, which is really one module.

## 8. Landmines

1. **`/api/modules/*` namespace collision** — `routes/modules.js` (app-store) vs the
   `mountPath` in both existing modules. Fix before `mountAll`.
2. **`fareharbor.js:98` — broken decrypt.** `createDecipheriv('aes-256-gcm',
   Buffer.from(ivH,'hex'), Buffer.from(ivH,'hex'))` passes the IV as the key; the
   correct `k` on the line above is unused. It throws every time and
   `catch { return stored; }` hands back raw ciphertext. Fix while extracting — take the
   working version from `stripe.js:36`.
3. **`STRIPE_KEY_ENCRYPTION_KEY` is used by non-Stripe modules** (`google-business`,
   `fareharbor`, `square`). Rename to `CREDENTIAL_ENCRYPTION_KEY` in `core/crypto`,
   keep the old name as a fallback so nothing breaks mid-migration.
4. **`admin.js` has ~156 routes with no auth middleware** — if you lift any admin section
   into a module, add `adminRequired` on the way out. Don't carry the hole forward.
5. **`gcr.js:2914` hardcoded secret** `GCR_ADMIN_SECRET || 'gcr-admin-2026'`. Drop the
   fallback when extracting.
6. **Two DBs, same table names.** `menu_items`, `drink_items`, `entity_*`, `customers`,
   `connections` exist in *both* Supabase projects with different columns. A module must
   declare which client it takes — that's what `requiredCore: ['db']` vs `['gcr-db']`
   is for. Getting this wrong writes to the wrong database silently.
7. **Duplicate legacy tables** — `entity_menu_items` vs `menu_items`,
   `entity_section_items` vs `section_items`, `gcr_menu_items` vs `menu_items`,
   `tourist_saves` vs `tourist_saved_places`, `tourist_memories` vs `tourist_memory`.
   Pick one per module and note the loser as dead.
8. **`routes/dashboard.js` has two `/faqs` CRUD blocks** on the same router — lines
   527–590 and 4777–4841, identical paths. Express takes the first, so the second
   **never runs**. They aren't even the same feature: the live one writes GCR
   `faq_items` keyed by `entity_id`; the dead one writes main-DB `faqs`. Extract the
   live block, and check whether anything still expects `faqs` to be written before you
   delete the other.
9. **No tests.** Nothing catches a bad extraction. Add a smoke check per module
   (mount it alone, hit one GET) as you go.
