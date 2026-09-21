# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # production (node server.js)
npm run dev        # development with auto-restart (node --watch)
node agents/check-platform.js   # platform health check
node agents/check-db.js         # DB connectivity check
```

No test suite or linter configured. Restart the server after any route change.

Smoke check after changing modules or mounts:

```bash
node -e "require('./modules/manifest'); console.log(require('./core/registry').getManifest().length)"
curl localhost:3000/api/_modules   # live module manifest
```

## Architecture

This is an Express API server (`server.js`) that acts as the middleware layer for three separate products:

1. **CyberCheck** — white-label business dashboard (bookings, menus, reviews, SMS, payments)
2. **Gulf Coast Radar (GCR)** — local business discovery platform (separate Supabase DB)
3. **Trip Swipe** — tourist itinerary/saves app (uses GCR Supabase JWT auth)

### Two Databases

Everything splits on which DB is used:

- **Main Supabase** (`core/db.js` → `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`) — CyberCheck businesses, users, bookings, sites, media
- **GCR Supabase** (`core/gcr-db.js` → `GCR_SUPABASE_URL` + `GCR_SUPABASE_KEY`) — GCR entities, sections, menus, events, specials, photos, tourists

`core/gcr-db.js` is a lazy singleton — call `getGcrDb()` to get the client; it throws if env vars are missing.
Root `db.js` / `gcr-db.js` are one-line shims re-exporting `core/`, kept so the standalone
scripts in `agents/` and `scripts/` keep working.

**Careful:** several table names exist in *both* projects with different columns
(`menu_items`, `drink_items`, `customers`, `connections`, `entity_*`). Check which client a
module declares (`requiredCore: ['db']` vs `['gcr-db']`) before adding a query.

### Module Architecture

Every route surface is a **module**: one folder under `modules/<id>/` holding
`index.js` (the manifest), `routes.js` (the Express router) and optionally
`migrations.sql` (the tables it owns). `index.js` self-registers with
`core/registry` when required.

```
core/       db · gcr-db · auth · domain · sms · email · ai · crypto · registry
            entity-resolver · menu-gcr        ← the only thing modules may import
modules/    <id>/index.js  manifest + registration
            <id>/routes.js the router
            <id>/migrations.sql the tables it owns
            manifest.js    the install list — ORDER IS MOUNT ORDER
server.js   cors → registry.mountAll(app, {preBodyParser:true}) → express.json()
            → registry.mountAll(app) → 404 → error handler
```

Rules:
- A module imports from `core/` and its own folder. **Never from another module.**
- To add a route surface: create `modules/<id>/`, add one line to `modules/manifest.js`.
  Do not touch `server.js`.
- Order in `modules/manifest.js` is Express mount order and therefore behaviour.
  `tourist` must precede `tourist-groups` and `setup-questions` (all answer under
  `/api/tourist`, first match wins).
- `preBodyParser: true` mounts a module before `express.json()` (raw body for
  signature verification — `stripe-webhooks` needs it).
- `enabled: false` keeps a module registered and listed but unmounted. Four are in that
  state: `menu-edit`, `admin-tourists` (were never mounted), `sms-automation` (needs its
  migrations applied), `social-manager` (routes return 501 until built).
- `GET /api/_modules` returns the live manifest: what each module owns, needs and mounts.

### Module Map

| Mount | Module | DB | Routes | Purpose |
|---|---|---|---|---|
| `/api/webhooks` | `stripe-webhooks` | main | 4 | Stripe events, pre-body-parser |
| `/api/auth` | `owner-auth` | main | 9 | Business owner login/signup/reset |
| `/api/dashboard` | `dashboard` | both | 189 | Authenticated business owner actions |
| `/api/public` | `public-site` | both | 51 | Customer-facing, domain → site_id |
| `/api/admin` | `admin` | both | 254 | Platform admin + GCR CRUD/import |
| `/api/gcr` | `gcr-discovery` | GCR | 53 | Public discovery, RAG chat, ads |
| `/api/links` | `links` | — | 1 | Links-page menu loader |
| `/api/user` | `gcr-owner` | GCR | 34 | GCR owner self-service |
| `/api/stripe` | `stripe-payments` | main | 15 | Connect, checkout, per-business keys |
| `/api/square` | `square-payments` | main | 8 | Square via REST |
| `/api/google-business` + `/api/dashboard/google-business` | `google-business` | main | 10 | GBP OAuth + review sync |
| `/api/analytics` | `analytics` | main | 5 | Pageviews, conversions |
| `/api/apps` | `apps-catalog` | main | 3 | App catalog |
| `/api/site` | `site-api` | main | 41 | Site content/pages/theme |
| `/api/sms` | `sms-inbox` | both | 9 | Two-way SMS, blasts, crons |
| `/api/send-email` | `transactional-email` | — | 1 | One-off email send |
| `/api/update` + `/update` | `update-link` | both | 36 | Token-based mobile editor |
| `/api/simple` | `simple-menu-edit` | GCR | 6 | Slug-based menu editor, no auth |
| `/api/qr` | `qr-tracking` | both | 25 | Scan intelligence, geofences |
| `/api/reviews` | `review-funnel` | both | 15 | POS webhook → review SMS |
| `/api/rides` | `rides-dispatch` | main | 11 | SMS dispatch, driver rotation |
| `/api/integrations/fareharbor` | `fareharbor` | main | 7 | FareHarbor sync |
| `/api/photographer` | `photographer-booking` | main | 17 | Sessions, deposit, model release |
| `/api/modules` | `app-store` | main | 7 | Per-site module install |
| `/api/charter` | `charter-booking` | main | 13 | Charter booking + waiver |
| `/api/boat-rental` | `boat-rental` | main | 11 | Boat rentals |
| `/api/availability` | `availability-search` | main | 3 | Cross-platform search |
| `/api/live-photo` | `live-photo` | both | 4 | Verified customer photos |
| `/api/tourist` | `tourist` | both | 30 | Trip Swipe saves, AI concierge |
| `/api/tourist/groups` | `tourist-groups` | main | 9 | Group trip planning |
| `/api/tourist-auth` | `tourist-auth` | main | 8 | Tourist signup + email code |
| `/api/tourist` + `/api/admin/setup-questions` | `setup-questions` | main | 6 | Signup questionnaire |
| *(disabled)* | `menu-edit`, `admin-tourists`, `sms-automation`, `social-manager` | — | 30 | Registered, not mounted |

### Auth System (`core/auth.js`)

Two middleware functions:
- `authRequired` — accepts three token types in order: (1) Express JWT signed with `JWT_SECRET`, (2) old Supabase JWT for Circle Boats, (3) GCR Supabase JWT for Trip Swipe users. Sets `req.userId`, `req.siteId`, `req.role`, or `req.gcrUserId`/`req.isGCR`.
- `adminRequired` — wraps `authRequired`, additionally requires `req.role === 'admin'`.

Admin login: `POST /api/admin/login` → bcrypt verify against `users` table → signed JWT (24h).

### GCR Entity Data Model

All GCR data lives in the GCR Supabase under these core tables:
- `entity` — the business record (name, slug, type, contact, hero_image_url, hours fields, social links)
- `entity_sections` — ordered content sections attached to an entity (section_type determines rendering)
- `section_items` / `entity_photos` / `entity_events` / `entity_specials` — child records
- `menu_sections` + `menu_items` / `drink_sections` + `drink_items` — food/drink menus
- `happy_hour_sections` + `happy_hour_items` — HH schedules
- `entity_hours` — per-day open/close times
- `entity_tags` / `entity_features` — amenity tags, perfect-for tags
- `entity_happy_hours` — HH schedule rows

GCR image uploads go to the `entity-media` Supabase storage bucket via `POST /api/admin/gcr/upload-image`. Main CyberCheck media goes to the `media` bucket via `POST /api/admin/upload-photo`.

### Domain Middleware (`core/domain.js`)

Declared as the `public-site` module's `middleware`. Used on `/api/public/*` routes. Resolves the incoming `Host` header to a `site_id` in the main DB so public routes are scoped to the correct business without requiring a site_id in the URL.

### Key External Integrations

- **Stripe** — Connect (per-business), standard payments, webhooks (`modules/stripe-payments/`, `modules/stripe-webhooks/`)
- **Square** — payments (`modules/square-payments/`)
- **Brevo** — SMS inbox, booking confirmations, promo blasts (`modules/sms-inbox/`, `modules/sms-automation/`, `core/sms.js`) — set `BREVO_API_KEY` + `BREVO_SMS_ENABLED=true`. Twilio has been removed from this codebase; without a configured provider, `sendSms()` logs `not_configured` and does not deliver.
- **Anthropic / OpenAI / Groq / xAI** — AI features routed through `core/ai.js`
- **FareHarbor** — activity booking sync (`modules/fareharbor/`)
- **Google Business Profile** — OAuth + review sync (`modules/google-business/`)
- **Nodemailer / Resend / SendGrid** — email via `core/email.js`

### Deployment

Deployed to Vercel. Production URL: `https://cybercheck-api-database.vercel.app`. The GCR CDN cache is set to 24h for all `GET /api/gcr/*` responses — bust by redeploying or adding cache-control overrides in the route.
