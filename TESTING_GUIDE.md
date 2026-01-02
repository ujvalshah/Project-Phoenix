# Testing Guide - MongoDB Migration

## ✅ Prerequisites
- [x] `.env` file configured with `MONGO_URI` and `JWT_SECRET`
- [x] MongoDB running (local or Atlas)

---

## 🚀 Quick Start Test

### 1. Start the Server
```bash
npm run dev:server
```

**Expected Output:**
```
[DB] ✓ Connected to MongoDB
[Seed] Database is empty, seeding initial data...
[Seed] ✓ Created 12 tags
[Seed] ✓ Created 2 users
[Seed] ✓ Created 12 articles
[Seed] ✓ Created 2 collections
[Seed] ✓ Database seeded successfully
[Server] ✓ Running on port 5000
[Server] Environment: development
```

**If you see errors:**
- `MONGO_URI is not defined` → Check your `.env` file location (should be in project root)
- `Failed to connect to MongoDB` → Verify your MongoDB is running and URI is correct
- `JWT_SECRET is not defined` → Add `JWT_SECRET` to your `.env` file

---

### 2. Test Health Endpoint
```bash
curl http://localhost:5000/api/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-XX..."
}
```

---

### 3. Test Authentication

#### Signup (Create Account)
```bash
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Expected Response:**
```json
{
  "user": {
    "id": "...",
    "name": "Test User",
    "email": "test@example.com",
    "role": "user",
    ...
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Save the token** for next steps!

#### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

---

### 4. Test Protected Endpoints

#### Get Current User (Protected)
```bash
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

#### Create Article (Protected)
```bash
curl -X POST http://localhost:5000/api/articles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "title": "Test Article",
    "content": "This is a test article",
    "authorId": "YOUR_USER_ID",
    "authorName": "Test User",
    "category": "Tech",
    "tags": ["test", "migration"]
  }'
```

#### Get Articles (Public)
```bash
curl http://localhost:5000/api/articles
```

**Expected:** Array of articles including seeded data and your new article

---

### 5. Test Data Persistence

1. **Create a collection:**
```bash
curl -X POST http://localhost:5000/api/collections \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "name": "My Test Collection",
    "description": "Testing persistence",
    "creatorId": "YOUR_USER_ID",
    "type": "private"
  }'
```

2. **Restart the server** (Ctrl+C, then `npm run dev:server`)

3. **Verify data persists:**
```bash
curl http://localhost:5000/api/collections
```

**Expected:** Your collection should still be there! ✅

---

## 🔍 Troubleshooting

### MongoDB Connection Issues

**Error: `Failed to connect to MongoDB`**
- Check MongoDB is running: `mongosh` (for local) or verify Atlas connection
- Verify `MONGO_URI` format:
  - Local: `mongodb://localhost:27017/nuggets`
  - Atlas: `mongodb+srv://username:password@cluster.mongodb.net/nuggets?retryWrites=true&w=majority`

### Authentication Issues

**Error: `Access token required`**
- Make sure you're including the `Authorization: Bearer TOKEN` header
- Token expires after 7 days

**Error: `Invalid or expired token`**
- Get a new token by logging in again

### Validation Errors

**Error: `Validation failed`**
- Check the request body matches the expected schema
- Required fields: `title`, `content`, `authorId`, `authorName`, `category` for articles

---

## 📊 Verify Database Contents

### Using MongoDB Compass or mongosh:

```javascript
// Connect to your database
use nuggets

// Check collections
show collections

// Count documents
db.users.countDocuments()
db.articles.countDocuments()
db.collections.countDocuments()
db.tags.countDocuments()

// View sample documents
db.users.findOne()
db.articles.findOne()
```

---

## ✅ Success Criteria

Your migration is successful if:
- [x] Server starts without errors
- [x] Health endpoint returns `{"status": "ok"}`
- [x] You can signup and login
- [x] You can create articles/collections with authentication
- [x] Data persists after server restart
- [x] Seed data appears on first run

---

## 🎯 Next Steps

Once testing is complete:
1. Test the frontend connection
2. Verify all CRUD operations work
3. Test error handling (invalid tokens, missing fields, etc.)
4. Consider adding pagination for large datasets
5. Set up production environment variables

---

**Need Help?** Check the `MIGRATION_COMPLETE.md` file for full migration details.











