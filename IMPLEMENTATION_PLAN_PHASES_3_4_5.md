# Implementation Plan: Phases 3, 4, 5 — Unified GCR + Trip Swipe Platform

**Status**: Ready for implementation (Phase 1 complete)  
**Date**: 2026-05-20

---

## Overview

Phases 3, 4, 5 implement the unified frontend across GCR and Trip Swipe apps on a single domain (`gulfcoastradar.com`), with coordinated authentication, visitor tracking, and activity backfilling.

**Key architectural decisions:**
- Both apps live on same domain via Vercel rewrites
- Anonymous users tracked via durable `localStorage` visitor ID
- Auth tokens stored in shared `localStorage` (same-origin, accessible to both)
- On signup, backfill mechanism links pre-signup activity to new user account
- App switcher nav in both apps to navigate between GCR and Trip Swipe

---

## Phase 3: GCR Frontend Changes

**Repo**: `/Users/owner/launching-GCR`  
**Files affected**: 6 files  
**Complexity**: Medium  
**Duration estimate**: 4-6 hours

### 3.1 Create `js/shared-identity.js`

**File**: `js/shared-identity.js` (new)  
**Purpose**: Generate and manage durable visitor ID; expose `window.GCRIdentity` object  
**Size**: ~50 lines

**What it does:**
- On first load: generate UUID v4, store in `localStorage.gcr_visitor_id`
- On subsequent loads: read from localStorage
- Expose `window.GCRIdentity = { visitorId: "uuid-string" }`
- Callable from both GCR and Trip Swipe (will load own copy in Trip Swipe too)

**Implementation:**
```javascript
// js/shared-identity.js
(function() {
  const VISITOR_ID_KEY = 'gcr_visitor_id';
  
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  function getOrCreateVisitorId() {
    let id = localStorage.getItem(VISITOR_ID_KEY);
    if (!id) {
      id = generateUUID();
      localStorage.setItem(VISITOR_ID_KEY, id);
    }
    return id;
  }
  
  window.GCRIdentity = {
    visitorId: getOrCreateVisitorId()
  };
})();
```

**Where to add in HTML**: In `index.html` or `home.html`, add BEFORE other JS that uses `window.GCRIdentity`:
```html
<script src="js/shared-identity.js"></script>
```

**Complexity**: Small  
**Risk**: None — creates localStorage key only on first load

---

### 3.2 Update `js/app.js`

**File**: `js/app.js` (existing)  
**Changes**: Add visitor ID to page view tracking calls  
**Size**: ~5 lines changed

**What changed:**
- Find all `POST /api/gcr/track` calls in app.js
- Add `visitor_id: window.GCRIdentity.visitorId` to request body

**Implementation:**
Look for patterns like:
```javascript
// OLD
fetch(`${API_BASE}/api/gcr/track`, {
  method: 'POST',
  body: JSON.stringify({ entity_slug: slug, page_type: 'entity' })
})

// NEW
fetch(`${API_BASE}/api/gcr/track`, {
  method: 'POST',
  body: JSON.stringify({ 
    entity_slug: slug, 
    page_type: 'entity',
    visitor_id: window.GCRIdentity.visitorId
  })
})
```

**Complexity**: Small  
**Risk**: None — backend already accepts visitor_id, just now sending it

---

### 3.3 Update `js/gcr-saves.js` (or create if missing)

**File**: `js/gcr-saves.js` (existing or new)  
**Changes**: Add email+code signup tab, trigger backfill on signup  
**Size**: ~100 lines new code

**What it does:**
1. Adds a second tab in the saves modal: "Sign Up"
2. Form: email + verification code (sent via `/api/admin/tourist/send-verification-code`)
3. On submit: call `POST /api/tourist/verify` with:
   - `email`
   - `verification_code`
   - `first_app: 'gcr'`
   - `anonymous_visitor_id: window.GCRIdentity.visitorId`
4. Backend returns JWT → store in `localStorage.cc_admin_token`
5. Trigger `POST /api/tourist/backfill-anonymous` to link pre-signup activity
6. Close modal, refresh page to show user personalization

**Implementation:**
```javascript
// In gcr-saves.js, add tab UI:
const signupTab = document.createElement('div');
signupTab.id = 'signup-tab';
signupTab.innerHTML = `
  <form id="signup-form">
    <input type="email" id="signup-email" placeholder="Email" required />
    <button type="button" id="send-code-btn">Send Verification Code</button>
    <input type="text" id="signup-code" placeholder="Enter code" disabled />
    <button type="submit">Create Account</button>
  </form>
`;

// Send verification code
document.getElementById('send-code-btn').addEventListener('click', async () => {
  const email = document.getElementById('signup-email').value;
  const res = await fetch(`${API_BASE}/api/admin/tourist/send-verification-code`, {
    method: 'POST',
    body: JSON.stringify({ email })
  });
  if (res.ok) {
    document.getElementById('signup-code').disabled = false;
  }
});

// Submit signup
document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('signup-email').value;
  const code = document.getElementById('signup-code').value;
  
  const res = await fetch(`${API_BASE}/api/tourist/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      verification_code: code,
      first_app: 'gcr',
      anonymous_visitor_id: window.GCRIdentity.visitorId
    })
  });
  
  if (res.ok) {
    const { token } = await res.json();
    localStorage.setItem('cc_admin_token', token);
    
    // Trigger backfill
    await fetch(`${API_BASE}/api/tourist/backfill-anonymous`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    // Reload to show personalization
    window.location.reload();
  }
});
```

**Complexity**: Medium  
**Risk**: Medium — depends on API endpoints being ready; need to test email verification flow

---

### 3.4 Update `home.html`

**File**: `home.html` (existing)  
**Changes**: Add app switcher nav, add recommendations section  
**Size**: ~200 lines added

**What it does:**

**A. App Switcher Nav** (top-right):
```html
<nav id="app-switcher" class="app-switcher">
  <span class="app-label">GCR</span>
  <a href="/trip-swipe/" class="app-link">Trip Swipe →</a>
</nav>
```

Style:
```css
.app-switcher {
  position: fixed;
  top: 20px;
  right: 20px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
}

.app-switcher .app-label {
  font-weight: bold;
  margin-right: 12px;
}

.app-switcher a {
  color: var(--primary);
  text-decoration: none;
}
```

**B. Recommendations Section**:
- If logged in: call `GET /api/tourist/recommendations?limit=6`
- Parse response: array of `{ entity_slug, entity_name, rating, photo_url }`
- Render as grid of cards below main GCR content
- Each card clickable → navigates to that entity

```javascript
// In app.js or home.html
if (localStorage.getItem('cc_admin_token')) {
  const token = localStorage.getItem('cc_admin_token');
  const res = await fetch(`${API_BASE}/api/tourist/recommendations?limit=6`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (res.ok) {
    const recs = await res.json();
    // Render recs in a grid
  }
}
```

**Complexity**: Medium  
**Risk**: Low — purely frontend additions, no breaking changes

---

### 3.5 Retire postMessage Auth

**File**: `home.html` (existing)  
**Changes**: Remove postMessage listener for Trip Swipe cross-origin auth  
**Size**: ~30 lines removed

**What to remove:**
- Any `window.addEventListener('message', ...)` listening for auth from Trip Swipe
- Any code that sets `window.CC_AUTH` or posts messages to Trip Swipe iframe
- Replace with simple link: `<a href="/trip-swipe/">Go to Trip Swipe</a>`

**Why**: With shared `localStorage` on same domain, no postMessage needed.

**Complexity**: Small  
**Risk**: Low — assumes Trip Swipe is also on same domain (Phase 4/5)

---

### 3.6 Add `shared-identity.js` Script Tag

**File**: `home.html`, `index.html`, any other main pages  
**Changes**: Add one line  
**Size**: 1 line

```html
<!-- Add near top of <head>, before other JS -->
<script src="js/shared-identity.js"></script>
```

Ensure it's loaded BEFORE `app.js` or any code that calls `window.GCRIdentity.visitorId`.

**Complexity**: Small  
**Risk**: None

---

## Phase 4: Vercel Deployment Setup

**Repos affected**: Both `/Users/owner/launching-GCR` and `/Users/owner/trip swipe /gcr-trip-swipe/`  
**Complexity**: Medium  
**Duration estimate**: 2-4 hours

### 4.1 Confirm Domain & Vercel Project Assignment

**Action**: In Vercel dashboard:
- GCR project (`launching-GCR` repo) → assign domain `gulfcoastradar.com`
- Trip Swipe project (`gcr-trip-swipe` repo) → keep on `trip-swipe-live-lgsh.vercel.app` (or separate subdomain)

**Why**: We'll rewrite from main domain to Trip Swipe project

**Status**: Check current Vercel settings  
**Complexity**: Small  
**Risk**: None — just configuration

---

### 4.2 Add Vercel Rewrite Rule (GCR project)

**File**: `/Users/owner/launching-GCR/vercel.json` (create if missing)  
**Changes**: Add one rewrite rule  
**Size**: ~20 lines

```json
{
  "rewrites": [
    {
      "source": "/trip-swipe/:path*",
      "destination": "https://trip-swipe-live-lgsh.vercel.app/:path*"
    }
  ]
}
```

**What it does:**
- User navigates to `gulfcoastradar.com/trip-swipe/`
- Vercel internally rewrites to `trip-swipe-live-lgsh.vercel.app/`
- URL bar still shows `/trip-swipe/` (transparent to user)
- Both apps on same domain origin = shared localStorage

**Complexity**: Small  
**Risk**: Medium — Trip Swipe asset paths must be relative or absolute to root

---

### 4.3 Audit Trip Swipe Asset Paths

**Files affected**: All HTML files in `/Users/owner/trip swipe /gcr-trip-swipe/`  
**Action**: Check for hardcoded absolute paths  
**Size**: Variable

**What to look for:**
```javascript
// BAD — breaks under /trip-swipe/ rewrite
src="/js/app.js"
src="/css/style.css"
href="/images/logo.png"

// GOOD — works under rewrite
src="./js/app.js"
src="./css/style.css"
href="./images/logo.png"

// ALSO OK — full domain (external reference)
src="https://trip-swipe-live-lgsh.vercel.app/js/app.js"
```

**Process:**
1. Open Trip Swipe index.html
2. Search for `src="/"` and `href="/"`
3. Replace with relative paths `./` or keep only route-based paths
4. Test both `trip-swipe-live-lgsh.vercel.app` directly AND via rewrite `gulfcoastradar.com/trip-swipe/`

**Complexity**: Medium  
**Risk**: High — asset path issues will break entire app

---

### 4.4 Update Supabase OAuth Redirect URLs

**File**: Supabase project settings (not a code file)  
**Action**: Add new OAuth redirect URL  
**Size**: N/A

**Supabase → Authentication → OAuth Providers → Google (or each provider):**

Add:
```
https://gulfcoastradar.com/trip-swipe/auth/callback
```

Keep existing:
```
https://trip-swipe-live-lgsh.vercel.app/auth/callback
```

**Why**: Users signing in via `gulfcoastradar.com/trip-swipe/` will redirect back to that URL after OAuth. Supabase must whitelist it.

**Complexity**: Small  
**Risk**: Low — just configuration

---

## Phase 5: Trip Swipe Frontend Changes

**Repo**: `/Users/owner/trip swipe /gcr-trip-swipe/` (Vue/Vite)  
**Files affected**: 5-6 files  
**Complexity**: Medium-Large  
**Duration estimate**: 6-8 hours

### 5.1 Load or Inline Visitor ID Logic

**File**: `src/main.js` or `src/App.vue` (root component)  
**Changes**: Initialize visitor ID at app startup  
**Size**: ~30 lines

**Option A — Load shared-identity.js from GCR:**
```javascript
// src/main.js
// Before creating Vue app
if (!window.GCRIdentity) {
  // Fallback if shared-identity.js not loaded
  const VISITOR_ID_KEY = 'gcr_visitor_id';
  
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  window.GCRIdentity = {
    visitorId: localStorage.getItem(VISITOR_ID_KEY) || 
               (function() {
                 const id = generateUUID();
                 localStorage.setItem(VISITOR_ID_KEY, id);
                 return id;
               })()
  };
}

createApp(App).mount('#app');
```

**Option B — Create Pinia store:**
```javascript
// src/stores/identity.js
import { defineStore } from 'pinia';

export const useIdentityStore = defineStore('identity', () => {
  const visitorId = generateOrGetVisitorId();
  
  function generateOrGetVisitorId() {
    const key = 'gcr_visitor_id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = generateUUID();
      localStorage.setItem(key, id);
    }
    return id;
  }
  
  function generateUUID() { /* ... */ }
  
  return { visitorId };
});
```

**Recommendation**: Option B (Pinia store) is cleaner for Vue app. Use in components via:
```javascript
const identity = useIdentityStore();
const visitorId = identity.visitorId;
```

**Complexity**: Small  
**Risk**: Low — initialization only

---

### 5.2 Update Signup/Signin Flow

**Files**: 
- `src/components/Auth/SignupForm.vue` (or similar)
- `src/components/Auth/LoginForm.vue` (or similar)

**Changes**: Pass `first_app` and `anonymous_visitor_id` on signup  
**Size**: ~20 lines changed

**Signup endpoint call (OLD):**
```javascript
const res = await fetch('/api/tourist/verify', {
  method: 'POST',
  body: JSON.stringify({
    email,
    verification_code
  })
});
```

**Signup endpoint call (NEW):**
```javascript
const identity = useIdentityStore();
const res = await fetch('/api/tourist/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email,
    verification_code,
    first_app: 'trip-swipe',
    anonymous_visitor_id: identity.visitorId
  })
});

if (res.ok) {
  const { token } = await res.json();
  localStorage.setItem('cc_admin_token', token);
  
  // Trigger backfill to link pre-signup activity
  await fetch('/api/tourist/backfill-anonymous', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  // Navigate to dashboard or reload
  this.$router.push('/dashboard');
}
```

**Complexity**: Medium  
**Risk**: Low — depends on backend endpoints working

---

### 5.3 Add App Switcher Nav

**File**: `src/App.vue` or `src/components/Navbar.vue`  
**Changes**: Add navigation links to GCR  
**Size**: ~50 lines

**Template:**
```vue
<template>
  <nav class="app-switcher">
    <span class="app-label">Trip Swipe</span>
    <a href="/" class="app-link">← GCR</a>
  </nav>
</template>

<style scoped>
.app-switcher {
  position: fixed;
  top: 20px;
  right: 20px;
  background: var(--card-bg, #fff);
  border: 1px solid var(--card-border, #ddd);
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
}

.app-label {
  font-weight: bold;
  margin-right: 12px;
}

.app-link {
  color: var(--primary, #007bff);
  text-decoration: none;
}
</style>
```

**Note**: Link to `/` (root of same domain) will navigate to GCR home page.

**Complexity**: Small  
**Risk**: Low — just UI addition

---

### 5.4 Remove postMessage Auth Listener

**File**: Wherever postMessage auth from GCR is handled  
**Changes**: Remove listener for cross-origin messages  
**Size**: ~30 lines removed

**What to remove:**
```javascript
// OLD — remove this
window.addEventListener('message', (event) => {
  if (event.data.type === 'AUTH_TOKEN') {
    localStorage.setItem('cc_admin_token', event.data.token);
  }
});
```

**Why**: Same-domain, shared localStorage — no postMessage needed.

**Complexity**: Small  
**Risk**: Low — no dependencies

---

### 5.5 Update Tracking to Include Visitor ID

**File**: Any API call that tracks user activity (page views, searches, saves, etc.)  
**Changes**: Add `visitor_id` to request body  
**Size**: ~10-20 lines total

**Pattern:**
```javascript
// In any tracking/analytics call
const identity = useIdentityStore();

const res = await fetch('/api/tourist/save-entity', {
  method: 'POST',
  body: JSON.stringify({
    entity_slug: slug,
    visitor_id: identity.visitorId  // ADD THIS
  })
});
```

**Files to update:**
- Any component that calls `/api/tourist/*` endpoints
- Search results component
- Entity detail/save component
- User preference tracking

**Complexity**: Medium  
**Risk**: Low — backend already accepts visitor_id

---

## Implementation Order & Dependencies

**MUST DO IN THIS ORDER:**

1. **Phase 3.1** — Create `shared-identity.js` in GCR
2. **Phase 3.2** — Update GCR tracking to use visitor ID
3. **Phase 3.3** — Add signup/backfill flow in GCR (test with backend)
4. **Phase 3.4** — Add app switcher and recommendations to GCR home
5. **Phase 3.5-6** — Retire postMessage, add script tags
6. **Phase 4.1** — Verify Vercel domain setup
7. **Phase 4.3** — Audit Trip Swipe asset paths (BEFORE rewrite)
8. **Phase 4.2** — Add rewrite rule to vercel.json
9. **Phase 4.4** — Update Supabase OAuth URLs
10. **Phase 5.1** — Initialize visitor ID in Trip Swipe
11. **Phase 5.2** — Update Trip Swipe signup with first_app + backfill
12. **Phase 5.3** — Add app switcher to Trip Swipe
13. **Phase 5.4** — Remove postMessage listener from Trip Swipe
14. **Phase 5.5** — Add visitor_id to Trip Swipe tracking calls

---

## Risk Areas & Mitigation

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Asset paths break under `/trip-swipe/` rewrite | High | Audit all paths in Phase 4.3 before enabling rewrite; test both direct + rewritten URLs |
| OAuth redirect URLs incomplete | Medium | Add both old + new redirect URLs to Supabase; test sign-in from both domains |
| Visitor ID generation collision (rare) | Low | UUID v4 has ~2^122 combinations; collision risk negligible |
| Backfill query timeout on large activity | Medium | Add pagination/batching to backfill endpoint; test with 1000+ rows |
| Token stored in shared localStorage but apps still isolated | Low | Both apps on same domain = same localStorage origin; test by opening both in tabs |
| Trip Swipe Vite build misses asset path fixes | Medium | Run full build + test all assets locally before Vercel deploy |

---

## Testing Checklist

After each phase:

- [ ] Phase 3: Visitor ID persists across page reloads
- [ ] Phase 3: GCR tracking includes visitor_id in API calls
- [ ] Phase 3: Signup form appears, verification code sent, backfill triggered
- [ ] Phase 3: Recommendations appear for logged-in users
- [ ] Phase 3: App switcher nav visible, links don't error
- [ ] Phase 4: Asset paths work when accessing Trip Swipe directly
- [ ] Phase 4: Asset paths work via rewrite (gulfcoastradar.com/trip-swipe)
- [ ] Phase 4: OAuth redirect works for both direct + rewritten URLs
- [ ] Phase 5: Trip Swipe visitor ID syncs with GCR (same localStorage)
- [ ] Phase 5: Trip Swipe signup passes first_app + anonymous_visitor_id
- [ ] Phase 5: Backfill links pre-signup activity to new user
- [ ] Phase 5: Trip Swipe tracking includes visitor_id
- [ ] E2E: User visits GCR anonymously, switches to Trip Swipe, signs up, sees backfilled data

---

## Files Summary

| Phase | Repo | File | Type | Lines |
|-------|------|------|------|-------|
| 3 | GCR | `js/shared-identity.js` | NEW | 50 |
| 3 | GCR | `js/app.js` | UPDATE | +5 |
| 3 | GCR | `js/gcr-saves.js` | UPDATE/NEW | +100 |
| 3 | GCR | `home.html` | UPDATE | +200 |
| 3 | GCR | `home.html` | UPDATE | -30 |
| 4 | GCR | `vercel.json` | CREATE | 20 |
| 4 | Trip | `**/*` (all HTML) | AUDIT | Variable |
| 4 | Supabase | Settings | CONFIG | N/A |
| 5 | Trip | `src/main.js` | UPDATE | +30 |
| 5 | Trip | `src/stores/identity.js` | NEW | 20 |
| 5 | Trip | `Auth components` | UPDATE | +20 |
| 5 | Trip | `App.vue` | UPDATE | +50 |
| 5 | Trip | Various | UPDATE | -30 |
| 5 | Trip | Various | UPDATE | +20 |

**Total files affected**: 15-20  
**Total new code**: ~500 lines  
**Total removed code**: ~60 lines (net +440 LOC)

---

## Success Criteria

✅ Phase 3, 4, 5 complete when:
- Both apps on same domain (`gulfcoastradar.com` + `/trip-swipe/`)
- Visitor ID generated on first load, persists across both apps
- User can signup in either app with `first_app` recorded
- Pre-signup activity automatically backfilled to account on signup
- App switcher nav in both apps, navigation works
- Recommendations load on GCR (from Trip Swipe activity, cross-app)
- All OAuth flows work from both domain variants
- Assets load correctly in both direct + rewritten paths
- localStorage shared (token set in Trip Swipe readable in GCR, vice versa)

---

## Next Actions

1. Review this plan with stakeholder
2. Begin Phase 3 implementation (GCR frontend)
3. Parallel: Audit Trip Swipe asset paths (Phase 4.3)
4. Deploy Phase 3, test
5. Enable rewrite rule (Phase 4.2)
6. Begin Phase 5 implementation (Trip Swipe frontend)
7. Full E2E test before production promotion

---

**Document created**: 2026-05-20  
**Phase 1 status**: ✅ Complete (migrations + API endpoints)  
**Phase 2 status**: ⏭️ Not started (reserved for future auth platform upgrades)  
**Phase 3-5 status**: 📋 Ready for implementation
