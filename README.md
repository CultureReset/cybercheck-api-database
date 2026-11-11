# cybercheck-api-database

The CyberCheck backend API and the Gulf Coast business data work behind it: an Express server on Vercel, plus the hundreds of scripts used to scrape, match, de-duplicate and import the region's businesses, menus, events and photos into Supabase.

`server.js` is the API (Supabase, Stripe Connect, file uploads, domain routing per business). The rest of the repo is data work and its notes. The live API is now [`gcr-api-clean`](https://github.com/CultureReset/gcr-api-clean).

## What is here

| Path | What it holds |
|---|---|
| `server.js`, `routes/`, `middleware/`, `lib/`, `modules/`, `module-registry.js` | The API |
| `migrations/`, `supabase/`, `*.sql` | Database schema and fixes |
| root `*.js` scripts | One-off jobs named for what they do: `import-*`, `match-*`, `dedupe-*`, `check-*`, `scrape-*`, `upload-*`, `verify-*` |
| `data/`, `extracted-restaurants/`, `menu-extractions/`, `scraped-menus/`, `*-photos/`, `*.xlsx` | Scraped and extracted business data |
| `*.md` at the root | Data inventories, audits and status reports, mostly May–July 2026 |

## Run it

```bash
npm install
cp .env.example .env    # Supabase and provider keys
npm run dev
npm run check:db
```

The last change, July 27, 2026, removed Twilio. Branches include `feature/square-payment`, `gcr-live-data` and `gcr-schema-migration`.
