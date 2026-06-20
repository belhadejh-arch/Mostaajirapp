---
name: MOSTAJIR auth 401 handling
description: How the app handles 401 Unauthorized responses without false logouts
---

## Rule
`client.ts` must NEVER call `clearToken()` on 401 responses. Only `AuthContext.loadMe()` (which calls `/api/auth/me`) should clear the token when it gets a 401.

**Why:** `DataContext.loadData()` fetches `/api/rentals` in parallel with products. Rentals requires auth; unauthenticated users always get 401. The old code cleared the token on any 401, silently logging out authenticated users whose rentals call failed.

## How to apply
- `client.ts`: `handleResponse()` throws `new UnauthorizedError()` on 401 — does NOT call `clearToken()`.
- `UnauthorizedError` is a custom class exported from `client.ts` (`extends Error`).
- `AuthContext.loadMe()`: catches `UnauthorizedError` instanceof and calls `clearToken() + setUser(null)`. Network errors are ignored (no logout on connectivity loss).
- `DataContext.loadRentals()`: catches all errors silently (`catch { /* ignore */ }`).

## Key files
- `frontend/src/api/client.ts` — `UnauthorizedError` class, `handleResponse()`
- `frontend/src/contexts/AuthContext.tsx` — `loadMe()` with instanceof check, toast errors (no alert())
- `frontend/src/contexts/DataContext.tsx` — `loadProducts()` and `loadRentals()` are separate, independent fetches
