# Leaflet — Leave Management System (Frontend)

Minimal Angular 17 (standalone components, signals) frontend for a leave
management system. Runs entirely on mock in-memory data right now — no
backend required to demo it.

## Run it

```bash
npm install
npm start
```

Then open http://localhost:4200.

**Demo logins** (any password works, mock auth doesn't check it):
- Employee: `employee@leaflet.dev`
- Manager: `manager@leaflet.dev`

## What's in here

- `/login` — sign in, role comes from the mock user record
- `/home` — one primary action ("Apply for leave") + balance + recent activity
- `/apply` — leave request form (type, dates, reason)
- `/history` — full request history with status filter
- `/manager` — approve/reject queue with an optional note back to the employee (manager role only, guarded)

## Wiring up the real API (MongoDB backend)

Everything talks to two services, and both are already shaped to swap
from mock data to `HttpClient` with minimal changes:

- `src/app/core/services/auth.service.ts`
  - `login(email, password)` → should become `POST /api/auth/login`
- `src/app/core/services/leave.service.ts`
  - `getForEmployee(employeeId)` → `GET /api/leaves?employeeId=`
  - `getAll()` → `GET /api/leaves` (manager view)
  - `apply(request)` → `POST /api/leaves`
  - `decide(id, status, comment)` → `PATCH /api/leaves/:id`

Each method already returns an `Observable`, and the `LeaveRequest` /
`User` shapes are defined in `src/app/core/models/leave.model.ts` — use
those as the API contract so the Mongo schema lines up with what the
UI expects. Once the backend's ready:

1. Add `provideHttpClient()` to `app.config.ts`.
2. Inject `HttpClient` into the two services and replace the mock
   bodies with real calls, keeping the same method signatures.
3. Remove the `sessionStorage` bit in `AuthService` once real tokens
   are involved (or keep it for storing the JWT).

## Notes

- Styling is plain CSS with design tokens in `src/styles.css` — no
  Angular Material / Bootstrap dependency, kept deliberately light.
- Route guards (`core/guards/auth.guard.ts`) block `/home`, `/apply`,
  `/history`, `/manager` when logged out, and `/manager` specifically
  when not a manager.
