# Leaflet — Leave Management System

A full-stack web application where employees apply for leave and managers approve or reject it.
Built with the **MEAN-style stack**: **M**ongoDB, **E**xpress, **A**ngular 17 and **N**ode.js, using
plain JavaScript/TypeScript, HTML and CSS (no UI framework).

> Academic project. The code is split into two folders: the Angular app at the repo root
> (`src/`) and the REST API in [`backend/`](backend/).

## Features

**Employee**
- Sign up, sign in, sign out (JWT session)
- Apply for Casual, Sick, Earned or Unpaid leave with dates and a reason
- See remaining leave balance, pending count and recent activity
- Full request history with status filter (all / pending / approved / rejected)

**Manager**
- Approvals queue showing every pending request
- Approve or reject with an optional note back to the employee
- Approving paid leave automatically deducts the employee's balance

**Business rules enforced by the server (not just the UI)**
- Dates must be real calendar dates; end date cannot be before the start date
- Only sick leave may start in the past; one request covers at most 30 days
- Paid leave cannot exceed the remaining balance; unpaid leave is unlimited
- A user cannot have two pending/approved requests that overlap
- A request can be decided only once (atomic update, so two managers cannot double-approve)
- A manager cannot approve their own request
- The employee, number of days and status are always set by the server, never trusted from the client

## Architecture

```
Browser (Angular SPA)  ──HTTPS──▶  Nginx  ──▶  Node.js + Express API  ──▶  MongoDB
  routes, guards,                   serves       JWT auth, role checks,     users,
  HttpClient + interceptor          /  and       validation, business       leaverequests
                                    proxies /api rules
```

## Tech stack

| Layer      | Technology |
|------------|------------|
| Frontend   | Angular 17 (standalone components, signals, lazy-loaded routes), plain CSS with design tokens |
| Backend    | Node.js 18+, Express 4, Mongoose 8 |
| Database   | MongoDB (local, or MongoDB Atlas) |
| Auth       | JSON Web Tokens, passwords hashed with bcrypt |
| Hardening  | helmet, CORS allow-list, rate-limited auth routes, request size limit, input validation, NoSQL-injection guard |
| Testing    | Node's built-in test runner + supertest (+ mongodb-memory-server) |
| Hosting    | AWS EC2 + Nginx + PM2, MongoDB Atlas — see [docs/AWS_DEPLOYMENT.md](docs/AWS_DEPLOYMENT.md) |

## Project structure

```
leavemgm/
├── src/                      Angular app
│   ├── app/core/             models, services (HTTP), guards, interceptor
│   ├── app/features/         login, register, home, apply-leave, history, manager
│   ├── app/shared/           navbar
│   └── environments/         apiUrl for development / production
├── backend/
│   ├── src/
│   │   ├── models/           User, LeaveRequest (Mongoose schemas)
│   │   ├── routes/           auth.js, leaves.js
│   │   ├── middleware/       JWT auth + role guard, error handler
│   │   ├── app.js            Express app (security middleware, routes)
│   │   ├── server.js         connects to MongoDB and starts listening
│   │   └── seed.js           demo users and requests
│   ├── tests/                smoke tests (no DB) and API tests (need MongoDB)
│   └── ecosystem.config.js   PM2 process file for production
├── deploy/nginx-leavemgm.conf
└── docs/AWS_DEPLOYMENT.md
```

## Database design

**users**
| Field | Type | Notes |
|-------|------|-------|
| name | String | 2–80 chars |
| email | String | unique, lowercase |
| passwordHash | String | bcrypt, never returned by the API |
| role | `employee` \| `manager` | public sign-up always creates `employee` |
| leaveBalance | Number | remaining paid days, default 12 |

**leaverequests**
| Field | Type | Notes |
|-------|------|-------|
| employee | ObjectId → users | owner, indexed |
| employeeName | String | copied at creation for fast listing |
| type | `Sick` \| `Casual` \| `Earned` \| `Unpaid` | |
| startDate, endDate | String `YYYY-MM-DD` | |
| days | Number | calculated by the server (inclusive) |
| reason | String | 5–500 chars |
| status | `pending` \| `approved` \| `rejected` | indexed |
| managerComment | String | optional |
| decidedBy, decidedOn | ObjectId, Date | audit trail |
| createdAt, updatedAt | Date | automatic |

## API reference

Base URL: `http://localhost:3000/api`. Send `Authorization: Bearer <token>` on protected routes.
Errors always look like `{ "message": "…" }`.

| Method | Path | Who | Purpose |
|--------|------|-----|---------|
| GET | `/health` | public | liveness check (used by load balancers) |
| POST | `/auth/register` | public | `{ name, email, password }` → `{ user, token }` (always an employee) |
| POST | `/auth/login` | public | `{ email, password }` → `{ user, token }` |
| GET | `/auth/me` | signed in | current user with fresh leave balance |
| GET | `/leaves/mine` | signed in | your own requests, newest first |
| GET | `/leaves?status=pending` | manager | everyone's requests (status filter optional) |
| POST | `/leaves` | signed in | `{ type, startDate, endDate, reason }` → the new request |
| PATCH | `/leaves/:id` | manager | `{ status: "approved" \| "rejected", managerComment? }` |

## Run it locally

You need **Node.js 18+** and a **MongoDB** database. The easiest options are a free
[MongoDB Atlas](https://www.mongodb.com/atlas) cluster, or MongoDB Community Server installed locally.

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env        # then edit .env: set MONGODB_URI and a long random JWT_SECRET
npm run seed                # creates demo users + sample requests
npm run dev                 # API on http://localhost:3000
```

Check it: <http://localhost:3000/api/health> should return `{"status":"ok"}`.

### 2. Frontend

In a second terminal, from the repo root:

```bash
npm install
npm start                   # http://localhost:4200
```

### Demo logins (created by `npm run seed`)

| Role | Email | Password |
|------|-------|----------|
| Manager | `manager@leaflet.dev` | `Leaflet@123` |
| Employee | `employee@leaflet.dev` | `Leaflet@123` |
| Employee | `rohan@leaflet.dev` | `Leaflet@123` |

The two buttons on the sign-in page fill these in (development builds only).

### Suggested demo flow for your viva

1. Sign in as the **employee** → apply for leave → see it as *pending* in History.
2. Sign out, sign in as the **manager** → Approvals → approve it with a note.
3. Back as the employee → the request shows *approved*, the balance went down.
4. Try the rules: overlapping dates, more days than your balance, opening `/manager` as an employee.

## Tests

```bash
cd backend
npm run test:smoke          # no database needed: routing, auth gate, validation, CORS, headers
npm test                    # smoke + full API tests (auth, roles, overlap, balance, double-decision)
```

The full API tests start a temporary in-memory MongoDB (it downloads a `mongod` binary on first
run). To use your own database instead:
`TEST_MONGODB_URI=mongodb://127.0.0.1:27017/leavemgm_test npm test`
— **use a throwaway database; the tests wipe the collections they use.**

## Deploy to AWS

Step-by-step guide (MongoDB Atlas + EC2 + Nginx + PM2, optional HTTPS and a CloudFront variant):
**[docs/AWS_DEPLOYMENT.md](docs/AWS_DEPLOYMENT.md)**

## Security notes

- Passwords are hashed with bcrypt; the hash is never selected or returned by default.
- JWTs expire (default 8 h). The Angular app keeps the token in `sessionStorage`, so it is
  cleared when the tab closes. (Storing tokens in browser storage is exposed to XSS; httpOnly
  cookies are the stricter alternative.)
- Login/register are rate-limited; request bodies are capped at 10 KB; `helmet` sets security headers.
- Non-string `email`/`password` values are rejected, blocking NoSQL operator injection.
- Roles are checked on the server for every protected route; the UI guards are only for convenience.
- Never commit `.env`. In production use a `JWT_SECRET` of at least 32 random characters
  (the server refuses to start otherwise) and serve the site over HTTPS.

## Known limitations / future work

- Leave days are counted as inclusive calendar days (weekends and public holidays are not excluded).
- A single paid-leave balance is shared by Casual, Sick and Earned leave (no per-type quotas).
- No email notifications, no employee cancellation of a pending request, no admin screen for
  creating managers (managers are created via the seed script or by editing `role` in the database).
- No refresh tokens; users sign in again when the token expires.
