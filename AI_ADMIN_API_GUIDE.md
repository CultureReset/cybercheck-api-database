# AI Admin API Guide

Your AI systems now have **full database control** via admin endpoints.

## Quick Start

All endpoints require:
```
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```

Base URL: `https://cybercheck-api-database.vercel.app/api/admin/gcr`

---

## 1. CREATE Entity (New Business)

### Endpoint
```
POST /api/admin/gcr/entities
```

### Request
```javascript
{
  "name": "New Restaurant",
  "slug": "new-restaurant",
  "city": "Orange Beach",
  "entity_subtype": "restaurant",
  "phone": "251-123-4567",
  "rating": 4.5,
  "hero_image_url": "https://example.com/image.jpg",
  "description": "Great food and atmosphere"
}
```

### Response
```javascript
{
  "success": true,
  "message": "Entity created",
  "entity": {
    "id": "uuid-here",
    "slug": "new-restaurant",
    "name": "New Restaurant",
    "city": "Orange Beach",
    ...all fields...
  }
}
```

### Example: Create a new restaurant
```bash
curl -X POST https://cybercheck-api-database.vercel.app/api/admin/gcr/entities \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Coastal Bistro",
    "slug": "coastal-bistro",
    "city": "Gulf Shores",
    "entity_subtype": "restaurant",
    "phone": "251-987-6543",
    "rating": 4.7,
    "price_range": "$$",
    "description": "Upscale dining with Gulf views"
  }'
```

---

## 2. UPDATE Entity (All Fields)

### Endpoint
```
PATCH /api/admin/gcr/entities/:id
```

### Request: Update Info
```javascript
{
  "entity": {
    "name": "Updated Name",
    "phone": "251-123-4567",
    "rating": 4.8,
    "description": "Updated description",
    "featured": true,
    "is_active": true
  }
}
```

### Request: Update Hours
```javascript
{
  "hours": {
    "schedule": [
      { "day": "Monday", "open": "10:00 AM", "close": "9:00 PM", "closed": false },
      { "day": "Tuesday", "open": "10:00 AM", "close": "9:00 PM", "closed": false },
      { "day": "Wednesday", "open": "10:00 AM", "close": "9:00 PM", "closed": false },
      { "day": "Thursday", "open": "10:00 AM", "close": "10:00 PM", "closed": false },
      { "day": "Friday", "open": "10:00 AM", "close": "11:00 PM", "closed": false },
      { "day": "Saturday", "open": "11:00 AM", "close": "11:00 PM", "closed": false },
      { "day": "Sunday", "open": "11:00 AM", "close": "9:00 PM", "closed": false }
    ]
  }
}
```

### Request: Update Photos
```javascript
{
  "photos": {
    "add": [
      { "image_url": "https://example.com/photo1.jpg", "caption": "Dining area" },
      { "image_url": "https://example.com/photo2.jpg", "caption": "Outdoor seating" }
    ],
    "delete": ["photo_id_1", "photo_id_2"]
  }
}
```

### Request: Update Tags
```javascript
{
  "tags": [
    { "tag": "waterfront", "tag_category": "amenity" },
    { "tag": "live_music", "tag_category": "feature" },
    { "tag": "seafood", "tag_category": "cuisine" },
    { "tag": "happy_hour", "tag_category": "amenity" }
  ]
}
```

### Response
```javascript
{
  "success": true,
  "message": "Entity updated",
  "entity": { ...updated entity... }
}
```

### Example: Update a restaurant's rating
```bash
curl -X PATCH https://cybercheck-api-database.vercel.app/api/admin/gcr/entities/entity-uuid \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "entity": {
      "rating": 4.9,
      "review_count": 150,
      "featured": true
    }
  }'
```

---

## 3. DELETE Entity

### Endpoint
```
DELETE /api/admin/gcr/entities/:id
```

### Soft Delete (Default)
Marks entity as inactive (keeps in database)

```bash
curl -X DELETE https://cybercheck-api-database.vercel.app/api/admin/gcr/entities/entity-uuid \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Hard Delete
Permanently removes from database

```bash
curl -X DELETE 'https://cybercheck-api-database.vercel.app/api/admin/gcr/entities/entity-uuid?hardDelete=true' \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Response
```javascript
{
  "success": true,
  "message": "Entity deleted (soft delete)",
  "entity": { ...updated entity with is_active: false... }
}
```

---

## Complete Update Examples

### Example 1: Full Restaurant Setup
```bash
# Create restaurant
ENTITY_ID=$(curl -X POST https://cybercheck-api-database.vercel.app/api/admin/gcr/entities \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "The Compass",
    "slug": "the-compass",
    "city": "Orange Beach",
    "entity_subtype": "restaurant",
    "phone": "251-555-0123",
    "rating": 4.6,
    "price_range": "$$$",
    "description": "Fresh Gulf seafood with waterfront views",
    "hero_image_url": "https://example.com/compass.jpg",
    "website_url": "https://thecompass.com",
    "booking_url": "https://resy.com/thecompass",
    "featured": true
  }' | jq -r '.entity.id')

# Update hours
curl -X PATCH https://cybercheck-api-database.vercel.app/api/admin/gcr/entities/$ENTITY_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "hours": {
      "schedule": [
        {"day":"Monday","open":"11:00 AM","close":"10:00 PM","closed":false},
        {"day":"Tuesday","open":"11:00 AM","close":"10:00 PM","closed":false},
        {"day":"Wednesday","open":"11:00 AM","close":"10:00 PM","closed":false},
        {"day":"Thursday","open":"11:00 AM","close":"10:00 PM","closed":false},
        {"day":"Friday","open":"11:00 AM","close":"11:00 PM","closed":false},
        {"day":"Saturday","open":"11:00 AM","close":"11:00 PM","closed":false},
        {"day":"Sunday","open":"10:00 AM","close":"9:00 PM","closed":false}
      ]
    }
  }'

# Add photos
curl -X PATCH https://cybercheck-api-database.vercel.app/api/admin/gcr/entities/$ENTITY_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "photos": {
      "add": [
        {"image_url":"https://example.com/compass1.jpg","caption":"Main dining room"},
        {"image_url":"https://example.com/compass2.jpg","caption":"Waterfront terrace"},
        {"image_url":"https://example.com/compass3.jpg","caption":"Gulf view sunset"}
      ]
    }
  }'

# Add tags
curl -X PATCH https://cybercheck-api-database.vercel.app/api/admin/gcr/entities/$ENTITY_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tags": [
      {"tag":"waterfront","tag_category":"amenity"},
      {"tag":"seafood","tag_category":"cuisine"},
      {"tag":"happy_hour","tag_category":"feature"},
      {"tag":"sunset_views","tag_category":"vibe"},
      {"tag":"upscale","tag_category":"vibe"}
    ]
  }'
```

---

## Using With JavaScript/Node.js

### Create
```javascript
const createEntity = async (adminToken, entityData) => {
  const response = await fetch('https://cybercheck-api-database.vercel.app/api/admin/gcr/entities', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(entityData)
  });
  
  if (!response.ok) throw new Error((await response.json()).error);
  return response.json();
};

// Usage
const result = await createEntity(token, {
  name: 'New Business',
  slug: 'new-business',
  city: 'Gulf Shores',
  entity_subtype: 'restaurant'
});
console.log(`Created: ${result.entity.id}`);
```

### Update
```javascript
const updateEntity = async (adminToken, entityId, updates) => {
  const response = await fetch(`https://cybercheck-api-database.vercel.app/api/admin/gcr/entities/${entityId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  });
  
  if (!response.ok) throw new Error((await response.json()).error);
  return response.json();
};

// Usage
const result = await updateEntity(token, 'entity-uuid', {
  entity: {
    name: 'Updated Name',
    rating: 4.9,
    featured: true
  }
});
console.log('Updated:', result.message);
```

### Delete
```javascript
const deleteEntity = async (adminToken, entityId, hardDelete = false) => {
  const url = hardDelete 
    ? `https://cybercheck-api-database.vercel.app/api/admin/gcr/entities/${entityId}?hardDelete=true`
    : `https://cybercheck-api-database.vercel.app/api/admin/gcr/entities/${entityId}`;
    
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) throw new Error((await response.json()).error);
  return response.json();
};

// Usage
const result = await deleteEntity(token, 'entity-uuid', false); // soft delete
console.log('Deleted:', result.message);
```

---

## Error Handling

### 401 Unauthorized
```json
{ "error": "Unauthorized: admin token required" }
```
**Fix:** Pass valid JWT token with `role: 'admin'` in Authorization header

### 400 Bad Request
```json
{ "error": "name and slug are required" }
```
**Fix:** Include all required fields in request body

### 404 Not Found
```json
{ "error": "Entity not found" }
```
**Fix:** Check that entityId exists in database

### 500 Server Error
```json
{ "error": "Error message from database" }
```
**Fix:** Check request format and server logs

---

## What Gets Cached & Invalidated

When you CREATE, UPDATE, or DELETE:
- Cache key `gcrv9:entities` is cleared (all listings)
- Cache key `gcrv9:profile:{slug}` is cleared (full profile)
- Cache key `gcrv9:events` is cleared (events)
- Cache key `gcrv9:specials` is cleared (specials)
- Cache key `gcrv9:happy-hours` is cleared (happy hour businesses)

**Result:** All frontends fetch fresh data on next request ✓

---

## Data Flow: AI Update → Live Everywhere

```
Your AI (chat, agent, etc.)
    ↓
PATCH /api/admin/gcr/entities/:id
    ↓
Database updated
    ↓
Cache cleared
    ↓
launching-GCR fetches fresh data
    ↓
search.html sees updated info
    ↓
profile.html shows new data
    ↓
✓ Change reflected everywhere instantly
```

---

## Field Reference

### All Updateable Fields
```javascript
{
  "entity": {
    // Identity
    "name": "string",
    "slug": "string (unique)",
    
    // Basic Info
    "subtitle": "string",
    "description": "string",
    "entity_subtype": "restaurant|bar_grill|...",
    "icon": "emoji",
    
    // Contact
    "phone": "string",
    "email": "string",
    "website_url": "string",
    "directions_url": "string",
    
    // Media
    "hero_image_url": "string (URL)",
    
    // Rating
    "rating": "number (0-5)",
    "review_count": "number",
    
    // Pricing
    "price_range": "$|$$|$$$|$$$$",
    
    // Location
    "city": "string",
    "state": "string",
    "address_line_1": "string",
    "zip": "string",
    
    // Booking
    "booking_url": "string (URL)",
    "reservation_url": "string (URL)",
    "order_url": "string (URL)",
    
    // Happy Hour
    "hh_days": "Mon-Fri|Mon-Sun|...",
    "hh_start": "time string",
    "hh_end": "time string",
    
    // Status
    "is_active": "boolean",
    "featured": "boolean",
    "is_sponsored": "boolean"
  }
}
```

---

## Next Steps

1. ✓ Your AI chat can now CREATE businesses
2. ✓ Your AI chat can UPDATE any field
3. ✓ Your AI chat can DELETE businesses
4. ✓ All changes sync to launching-GCR, search, profiles instantly
5. ✓ Use slug as the single business identifier everywhere

Your AI is now fully in control of the database. 🚀
