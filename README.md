<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# Nuggets

**A modern knowledge management and content curation platform**

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://reactjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green.svg)](https://www.mongodb.com/atlas)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)

</div>

---

## Features

- 📝 Create and organize content "nuggets" (links, notes, ideas)
- 🔗 Rich link previews with metadata extraction
- 📁 Collections and folders for organization
- 🤖 AI-powered summarization (Google Gemini)
- 👥 User authentication and profiles
- 🛡️ Admin moderation panel
- 🌙 Dark/Light theme support
- 📱 Responsive design

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, Vite, TailwindCSS, React Query |
| **Backend** | Express.js 5, TypeScript, Node.js |
| **Database** | MongoDB (Mongoose ODM) |
| **Auth** | JWT tokens, bcrypt |
| **AI** | Google Gemini API |
| **Monitoring** | Sentry, Pino logging |

---

## Quick Start (Development)

### Prerequisites

- Node.js 18+ 
- MongoDB (local or [MongoDB Atlas](https://www.mongodb.com/atlas))
- npm or yarn

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd nuggets
npm install
```

### 2. Configure Environment

```bash
# Copy the example environment file
cp env.example .env

# Edit .env with your values (see env.example for documentation)
```

**Required environment variables:**
- `MONGO_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT tokens (min 32 characters)
- `NODE_ENV` - Set to `development`

### 3. Run Development Server

```bash
# Run both frontend and backend concurrently
npm run dev:all
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

---

## Production Deployment

### Environment Configuration

Create a production `.env` file with these **required** variables:

```env
# Database
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/nuggets

# Authentication (generate secure secret!)
JWT_SECRET=your-32-plus-character-secret-key-here

# Server
NODE_ENV=production
PORT=5000

# CORS (REQUIRED in production)
FRONTEND_URL=https://your-domain.com

# Error Tracking (recommended)
SENTRY_DSN=https://xxx@sentry.io/xxx
```

### Generate Secure JWT Secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Build for Production

```bash
# Build frontend
npm run build

# Verify build succeeded
node scripts/verify-build.js
```

### Start Production Server

```bash
NODE_ENV=production node --import tsx server/src/index.ts
```

The server will:
- Serve the built React app from `dist/`
- Handle all API routes under `/api/*`
- Validate environment variables at startup
- Exit with error if required config is missing

---

## Deployment Platforms

### Railway (Recommended)

1. Connect your GitHub repo to [Railway](https://railway.app)
2. Add environment variables in Railway dashboard
3. Railway auto-detects Node.js and deploys

### Render

1. Create a new Web Service on [Render](https://render.com)
2. Connect your repo
3. Build command: `npm install && npm run build`
4. Start command: `node --import tsx server/src/index.ts`

### Vercel + Separate Backend

For split deployment (frontend on Vercel, backend elsewhere):
1. Deploy backend to Railway/Render
2. Set `VITE_API_URL` to your backend URL
3. Deploy frontend to Vercel

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server (frontend only) |
| `npm run dev:server` | Start Express server with hot reload |
| `npm run dev:all` | Run frontend + backend concurrently |
| `npm run build` | Build frontend for production |
| `npm run preview` | Preview production build locally |
| `npm run promote-admin` | Promote a user to admin role |
| `npm run list-users` | List all users in database |
| `npm run audit` | Run code audit checks |

---

## Project Structure

```
├── src/                    # Frontend React application
│   ├── components/         # Reusable UI components
│   ├── pages/             # Route pages
│   ├── context/           # React context providers
│   ├── hooks/             # Custom React hooks
│   ├── services/          # API client services
│   └── types/             # TypeScript type definitions
├── server/                 # Backend Express application
│   └── src/
│       ├── controllers/   # Route handlers
│       ├── models/        # Mongoose schemas
│       ├── routes/        # Express routes
│       ├── middleware/    # Auth, rate limiting, etc.
│       ├── services/      # Business logic
│       └── utils/         # Helper utilities
├── dist/                   # Production build output
├── scripts/               # Utility scripts
└── env.example            # Environment variable template
```

---

## Security Features

- ✅ JWT authentication with secure secret validation
- ✅ Password hashing with bcrypt
- ✅ CORS restricted to frontend URL in production
- ✅ Helmet security headers
- ✅ Rate limiting on auth endpoints
- ✅ Input validation with Zod
- ✅ Environment variable validation at startup
- ✅ No secrets exposed to frontend

---

## Monitoring & Observability

- **Structured Logging**: Pino logger with JSON output in production
- **Error Tracking**: Sentry integration for exception monitoring
- **Health Check**: `/api/health` endpoint with database status
- **Slow Query Detection**: Automatic logging of slow MongoDB queries
- **Request Tracing**: Request ID middleware for log correlation

---

## API Health Check

```bash
curl http://localhost:5000/api/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2025-12-23T12:00:00.000Z",
  "database": "connected",
  "uptime": 3600,
  "environment": "production"
}
```

---

## License

MIT

---

## Support

For issues and feature requests, please open a GitHub issue.
