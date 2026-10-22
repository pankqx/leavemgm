# AGENTS.md

Instructions for AI coding agents working in this repo.
Humans: read [GUIDE.md](GUIDE.md). It explains everything from zero.

## What this project is

Leaflet is a leave management system. Employees apply for leave; managers approve or reject it.
**Frontend:** Angular 17 (standalone components, signals, lazy routes, functional guards and interceptor) at the repo root.
**Backend:** Node 18+ / Express 4 / Mongoose 8 / MongoDB REST API in `backend/`. JWT auth, bcrypt passwords.
**Deploy:** EC2 + Nginx + PM2 + MongoDB Atlas (`docs/AWS_DEPLOYMENT.md`).

## Layout

```
src/app/core/        models (leave.model.ts), services (auth, leave), guards, interceptor, utils/http-error.ts
src/app/features/    login, register, home, apply-leave, history, manager (each: .ts + .html + .css)
src/app/shared/      navbar
src/environments/    apiUrl (dev: http://localhost:3000/api, prod: /api)
backend/src/app.js        Express app: helmet, CORS allow-list, json(10kb), morgan, routes, error handlers
backend/src/server.js     connect Mongo, listen, graceful shutdown
backend/src/config.js     env vars; refuses to start without JWT_SECRET / MONGODB_URI
backend/src/middleware/   auth.js (signToken, requireAuth, requireRole), errors.js
backend/src/models/       User, LeaveRequest (toJSON shapes match the Angular interfaces)
backend/src/routes/       auth.js (register/login/me, rate-limited), leaves.js (mine, list, create, decide)
backend/src/seed.js       demo users + requests
backend/tests/            smoke.test.js (no DB), api.test.js (mongodb-memory-server)
deploy/nginx-leavemgm.conf
```

## Commands

```bash
# backend
cd backend && npm install && cp .env.example .env   # set MONGODB_URI, JWT_SECRET
npm run seed && npm run dev                          # http://localhost:3000/api/health
npm run test:smoke                                   # no DB needed
npm test                                             # full suite (in-memory Mongo)
# frontend (repo root)
npm install && npm start                             # http://localhost:4200
npm run build
```

## Conventions

- All business rules live on the server (`routes/leaves.js`). UI checks are convenience only.
- Never trust ids, days, status or role from the client; derive them from `req.user` and the DB.
- Validate types explicitly (`typeof x === 'string'`) before any Mongo query (NoSQL-injection guard).
- State changes that can race use a single conditional `findOneAndUpdate` (see the PATCH handler).
- API errors are `{ message }`. Use `next(err)` for unexpected errors; `errors.js` maps them.
- Model `toJSON` transforms define the API shape. If you add a field, add it there and to `leave.model.ts`.
- Angular: standalone components, `inject()`, signals for state, `computed` for derived values. No NgModules.
- New backend behaviour needs a test in `backend/tests/api.test.js`.

## Housekeeping

- `#script#` at the root is an accidental shell-history file (contains a local path). Safe to delete; ask the owner.

## Rules for agents

- Never commit `.env` or secrets. Production `JWT_SECRET` must be 32+ chars.
- Commit as `pankqx <pankqx@gmail.com>`. Do not add `Co-Authored-By` or any AI trailer.
- If you change behaviour, update GUIDE.md and the README API table in the same PR.
