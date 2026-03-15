# Nuggets — How to Run This Project (Simple Guide)

This guide is for **non-developers**. Follow the steps in order.

---

## What You Need Installed First

### 1. Node.js (required)

The project needs **Node.js 18 or newer** (20 LTS recommended).

**Install on Windows:**

- **Option A — Recommended:** Download the installer from [https://nodejs.org](https://nodejs.org). Choose the **LTS** version. Run the installer and follow the steps. Restart Cursor (or your terminal) after installing.
- **Option B — If you use Winget:** Open PowerShell and run:
  ```powershell
  winget install OpenJS.NodeJS.LTS
  ```
  Then close and reopen PowerShell/Cursor.

**Check that it worked:** Open a new terminal in Cursor and run:
```powershell
node --version
npm --version
```
You should see version numbers (e.g. `v20.10.0` and `10.2.0`). If you see "not recognized", Node is not installed or not in your PATH.

### 2. MongoDB (required for data)

The app stores data in **MongoDB**. You can either:

- **Use MongoDB Atlas (cloud, no install):**  
  Sign up at [https://www.mongodb.com/atlas](https://www.mongodb.com/atlas), create a free cluster, and get a connection string. Put it in your `.env` file as `MONGO_URI=...`.
- **Use local MongoDB:**  
  Install MongoDB Community from [https://www.mongodb.com/try/download/community](https://www.mongodb.com/try/download/community). Then in `.env` set:
  ```env
  MONGO_URI=mongodb://localhost:27017/nuggets
  ```

### 3. Redis (optional)

Redis is used for rate limiting. The app **works without Redis**; it will use in-memory fallback. To use Redis:

- Install Redis on Windows (e.g. via WSL or a Windows port), or
- Leave `REDIS_URL` unset in development; the app will try `redis://localhost:6379` and fall back if Redis is not running.

---

## One-Time Setup

### Step 1: Install dependencies

In a terminal, go to the project folder and run:

```powershell
cd c:\Users\ujval\Projects\Project-Phoenix
npm install
```

Wait until it finishes without errors.

### Step 2: Environment file (`.env`)

The project needs a `.env` file in the project root with at least:

- **MONGO_URI** — Your MongoDB connection string (see above).
- **JWT_SECRET** — A long random string (at least 32 characters). Example to generate one:
  ```powershell
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```
  Copy the output into `.env` as `JWT_SECRET=...`
- **NODE_ENV** — Set to `development` for local run.

If you have a `.env.example` file, you can copy it to `.env` and then fill in the values above:

```powershell
copy .env.example .env
```

Then edit `.env` and set `MONGO_URI`, `JWT_SECRET`, and `NODE_ENV=development`.

---

## How to Start the Project

In a terminal, from the project folder:

```powershell
cd c:\Users\ujval\Projects\Project-Phoenix
npm run dev:all
```

This starts:

- **Frontend (React):** [http://localhost:3000](http://localhost:3000) — open this in your browser.
- **Backend (API):** [http://localhost:5000](http://localhost:5000) — the frontend talks to this automatically.

You should see logs from both. Leave this terminal open while you use the app.

---

## How to Stop the Project

In the terminal where the app is running, press:

**Ctrl + C**

Press it once, wait a moment, then press again if it doesn’t stop. When the prompt returns, the project is stopped.

---

## Where Things Run

| What        | URL                     | Description                    |
|------------|--------------------------|--------------------------------|
| **Frontend** | http://localhost:3000  | Web interface you use in browser |
| **Backend**  | http://localhost:5000  | API server (used by frontend)    |
| **Health check** | http://localhost:5000/api/health | Check if backend is up |

---

## Common Problems

### "node is not recognized"
- Node.js is not installed or not in PATH. Install Node.js (see above) and **restart Cursor** and your terminal.

### "npm is not recognized"
- Same as above; npm is installed with Node.js. Install Node.js and restart.

### "MONGO_URI is required" or "JWT_SECRET must be at least 32 characters"
- Your `.env` is missing or wrong. Make sure `.env` is in the project root (`c:\Users\ujval\Projects\Project-Phoenix`) and contains `MONGO_URI=...` and `JWT_SECRET=...` (at least 32 characters).

### "Cannot connect to MongoDB" or "querySrv ECONNREFUSED"
- **MongoDB Atlas (cloud):**  
  - Ensure your cluster is **not paused** (free tier clusters auto-pause; in Atlas dashboard, click "Resume" if needed).  
  - In Atlas: **Network Access** → add your IP or use `0.0.0.0/0` for development.  
  - Check username/password in `MONGO_URI` and that the database user exists.
- **Local MongoDB:**  
  - Ensure MongoDB is running. If using Docker: `docker-compose up -d mongo` then set `MONGO_URI=mongodb://localhost:27017/nuggets` in `.env`.

### Port 3000 or 5000 already in use
- Another app is using that port. Close the other app or change `PORT` in `.env` (e.g. `PORT=5001`) for the backend; for the frontend you’d need to change the port in `vite.config.ts` (e.g. `port: 3001`).

### Dependencies fail to install (`npm install` errors)
- Make sure you’re in the project folder and have Node 18+. Try:
  ```powershell
  npm cache clean --force
  npm install
  ```

---

## Quick Reference

| Task           | Command / Action                    |
|----------------|-------------------------------------|
| First-time setup | Install Node → `npm install` → copy/edit `.env` |
| Start app      | `npm run dev:all`                   |
| Stop app       | Ctrl + C in the terminal            |
| Frontend       | http://localhost:3000               |
| Backend        | http://localhost:5000               |

---

## Automatic Setup Script (Optional)

You can run the PowerShell setup script to check Node and install dependencies:

```powershell
cd c:\Users\ujval\Projects\Project-Phoenix
.\setup.ps1
```

You still need to install Node.js yourself if it’s not already installed, and create/edit `.env` with your MongoDB and JWT secret.
