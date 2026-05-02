# Project: Full-Stack AI Application (React 19 + Express 5)

## 🏗 Architecture & Patterns
- **Adapter Pattern:** The app uses `RestAdapter` via [`storageService`](src/services/storageService.ts) (`getAdapter`). When refactoring data logic, keep [`IAdapter`](src/services/adapters/IAdapter.ts) coherent with the backend API.
- **Service Layer:** Logic must stay in the Service Layer, keeping UI (React) and Route Handlers (Express) thin.
- **Strict Typing:** TypeScript strict mode is enabled. No `any` types allowed.

## 🛠 Commands
- **Install:** `npm install`
- **Build:** `npm run build` (Vite for frontend, TS for backend)
- **Test:** `npm test` (Uses Vitest)
- **Lint:** `npm run lint` (ESLint + Prettier)
- **Docker:** `docker-compose up --build`

## 🛡 Production & Security Rules
- **Phase:** Development
- **Security:** Ensure `Helmet`, `CORS`, and `express-rate-limit` are correctly configured in `app.ts`.
- **Validation:** Use `Zod` for all API request body validation.
- **Errors:** All async code must use try/catch. Use `pino` for logging, never `console.log`.
- **Performance:** Use `compression` middleware and check for React Query stale-time settings.