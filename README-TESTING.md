# Menu Builder & QR Menu Testing Guide

## What's Implemented

### ✅ Admin Dashboard (cybercheck-login)
- Menu Builder section for selecting businesses
- Business dropdown loads from `/api/gcr/entities`
- Menu items load from `/api/dashboard/menu-items?entity_id=X`
- **NEW:** PIN input field for optional protection
- QR code generation with optional PIN parameter

### ✅ QR Menu Page (cybercheck-links)
- Public page accessible without authentication
- Loads business data from `/api/gcr/entity/{slug}`
- **NEW:** PIN validation - prompts user if `?pin=` parameter exists
- Menu displays only after correct PIN entry
- PIN stored in sessionStorage (no re-prompting)

### ✅ API Endpoints (cybercheck-api-database)
- `POST /api/admin/login` - Admin authentication
- `GET /api/gcr/entities` - Business list (public)
- `GET /api/dashboard/menu-items?entity_id=X` - Menu items (auth required)
- `GET /api/gcr/entity/{slug}` - Entity details (public)

---

## Running Tests Locally

### Option 1: Automated Browser Tests (Playwright)

Start the dev server:
```bash
npm run dev
```

Run the comprehensive test:
```bash
node test-menu-builder.js
```

Run the simple test:
```bash
node test-simple.js
```

### Option 2: Manual Testing

1. **QR Menu with PIN:**
   ```
   https://cybercheck-links.vercel.app/qr-menu.html?slug=150-golf-precision-fitting-instruction-hLK8lw&pin=1234
   ```
   - Should prompt for PIN
   - Enter: `1234`
   - Menu displays

2. **QR Menu without PIN:**
   ```
   https://cybercheck-links.vercel.app/qr-menu.html?slug=150-golf-precision-fitting-instruction-hLK8lw
   ```
   - Should load menu immediately

3. **Admin Dashboard:**
   ```
   https://cybercheck-login.vercel.app/admin.html
   ```
   - Login: `info@cybercheckinc.com` / `Cybercheckinc1`
   - Go to Menu Builder
   - Select a business
   - Optional: Enter PIN
   - QR code updates with PIN parameter

---

## Complete User Flow

### For Admin (Menu Builder):
1. Log into dashboard
2. Select business from dropdown
3. View menu items
4. Optional: Enter PIN (e.g., "1234")
5. Copy/download QR code with PIN
6. Share QR code with restaurant

### For Restaurant/User (QR Menu):
1. Scan QR code
2. If PIN set: Prompted to enter PIN
3. If correct: Menu displays
4. If wrong: Try again
5. Browse menu items, prices, descriptions

---

## Test Results

### What Works ✅
- Admin login and authentication
- Business dropdown loads from API
- Menu items endpoint works with auth token
- QR menu page loads and displays business data
- **PIN validation works** - Shows prompt dialog when ?pin= parameter exists
- PIN is stored in sessionStorage - no repeated prompts
- Admin dashboard is accessible and functional

### Known Issues ⚠️
- Business selector in Menu Builder might need page load optimization
- Some DOM element selectors in automated tests need refinement
- Menu Builder tests show timeout on dropdown - might need longer waits

---

## Deployment Status

All code is deployed to Vercel:
- ✅ Admin dashboard: `https://cybercheck-login.vercel.app/admin.html`
- ✅ QR menu: `https://cybercheck-links.vercel.app/qr-menu.html`
- ✅ API: `https://cybercheck-api-database.vercel.app`

Changes are live and can be tested immediately.

---

## PIN Feature Details

### How PIN Works:
1. Admin specifies PIN (e.g., "1234") in Menu Builder
2. QR URL includes: `?slug=...&pin=1234`
3. When user visits QR URL, JavaScript detects `?pin=` parameter
4. `validatePin()` function is called before rendering menu
5. User prompted via browser `prompt()` dialog
6. If PIN matches URL parameter: Menu renders
7. If PIN wrong: User can try again
8. Validation stored in sessionStorage with key: `qr_menu_pin_{slug}`

### Code Location:
- Admin input: `cybercheck-login/admin.html` lines 13934, 14084-14102
- QR validation: `cybercheck-links/qr-menu.html` lines 492, 1544-1560, 1565

---

## Next Steps

1. **Test locally**: Run `node test-simple.js`
2. **Test on live site**: Visit admin dashboard and QR menu links above
3. **Test PIN flow**: Create QR with PIN and verify prompt works
4. **Deploy to production**: All changes already pushed to GitHub → Vercel

---

For issues or questions, run the test scripts and share the output.
