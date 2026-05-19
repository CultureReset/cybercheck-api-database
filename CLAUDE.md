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

## Architecture

This is an Express API server (`server.js`) that acts as the middleware layer for three separate products:

1. **CyberCheck** — white-label business dashboard (bookings, menus, reviews, SMS, payments)
2. **Gulf Coast Radar (GCR)** — local business discovery platform (separate Supabase DB)
3. **Trip Swipe** — tourist itinerary/saves app (uses GCR Supabase JWT auth)

### Two Databases

Everything splits on which DB is used:

- **Main Supabase** (`db.js` → `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`) — CyberCheck businesses, users, bookings, sites, media
- **GCR Supabase** (`gcr-db.js` → `GCR_SUPABASE_URL` + `GCR_SUPABASE_KEY`) — GCR entities, sections, menus, events, specials, photos, tourists

`gcr-db.js` is a lazy singleton — call `getGcrDb()` to get the client; it throws if env vars are missing.

### Route Map

| Prefix | File | DB | Purpose |
|---|---|---|---|
| `/api/auth` | `routes/auth.js` | main | Login/signup/reset for business owners |
| `/api/dashboard` | `routes/dashboard.js` | main | Authenticated business owner actions |
| `/api/public` | `routes/public.js` | main | Customer-facing per-domain routes (domain middleware resolves site_id) |
| `/api/admin` | `routes/admin.js` | both | Platform admin + all GCR entity CRUD (`/api/admin/gcr/*`) |
| `/api/gcr` | `routes/gcr.js` | GCR | Public GCR discovery (search, browse, entity detail, AI chat) |
| `/api/simple` | `routes/simple-menu-edit.js` | GCR | Slug-based menu/specials editor (no auth) |
| `/api/tourist` | `routes/tourist*.js` | GCR | Trip Swipe saves, profile, groups |
| `/api/reviews` | `routes/reviews.js` | main | POS webhooks, SMS review requests |
| `/api/rides` | `routes/rides.js` | main | SMS dispatch, driver rotation |
| `/update/:token` | `routes/update-link.js` | main | Mobile form for daily menu/specials updates |

### Auth System (`middleware/auth.js`)

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

### Domain Middleware (`middleware/domain.js`)

Used on `/api/public/*` routes. Resolves the incoming `Host` header to a `site_id` in the main DB so public routes are scoped to the correct business without requiring a site_id in the URL.

### Key External Integrations

- **Stripe** — Connect (per-business), standard payments, webhooks (`routes/stripe.js`, `routes/webhooks.js`)
- **Square** — payments (`routes/square.js`)
- **Twilio** — SMS inbox, booking confirmations, promo blasts (`routes/sms.js`, `modules/sms-automation/`)
- **Anthropic / OpenAI / Groq / xAI** — AI features routed through `routes/ai-provider.js`
- **FareHarbor** — activity booking sync (`routes/fareharbor.js`)
- **Google Business Profile** — OAuth + review sync (`routes/google-business.js`)
- **Nodemailer / Resend / SendGrid** — email via `utils/email.js`

### Deployment

Deployed to Vercel. Production URL: `https://cybercheck-api-database.vercel.app`. The GCR CDN cache is set to 24h for all `GET /api/gcr/*` responses — bust by redeploying or adding cache-control overrides in the route.
