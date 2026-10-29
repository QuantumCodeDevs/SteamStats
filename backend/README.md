# SteamStats Backend

Fastify API that sits between the Angular app and Steam. It resolves Steam IDs, loads profiles and libraries, fetches Store game details, and keeps the Steam Web API key off the client.

Root setup (env, Docker, workspaces): [README.md](../README.md).

---

## Run

From the **repo root** (after `npm ci` and a filled-in `.env`):

```bash
npm run dev:backend
```

- API: http://localhost:3000
- Health: http://localhost:3000/health
- Swagger UI: http://localhost:3000/docs

Workspace scripts (from root):

```bash
npm run dev --workspace=backend
npm run typecheck --workspace=backend
npm run build --workspace=backend
```

Docker:

- Dev image: `backend/dockerfile.dev` (`tsx watch`, used by `docker-compose.yml`)
- Prod image: `backend/dockerfile` (compiled `node dist/index.js`, used by `docker-compose.prod.example.yml`)

---

## Layout

```text
backend/
├── src/
│   ├── index.ts                 # load config, listen
│   ├── app.ts                   # Fastify plugins + /api/v1 + /health
│   ├── config/env.ts
│   ├── plugins/                 # cors, helmet, rate-limit, cache, swagger, steam
│   ├── routes/                  # profile, library, game, cache
│   ├── schemas/
│   ├── services/
│   │   ├── cache.service.ts
│   │   └── api/
│   │       ├── api.client.ts    # HTTP to Steam Web + Store
│   │       └── steam/           # user, library, game, apps
│   ├── types/
│   └── utils/steam-id.util.ts
├── dev/                         # Postman collections
├── dockerfile
├── dockerfile.dev
└── package.json
```

---

## How a request is handled

```text
Route  →  steam.* service  →  ApiClient.request({ host, path, params })
                                    │
                         host: 'web'   →  https://api.steampowered.com
                         host: 'store' →  https://store.steampowered.com
```

[`ApiClient`](src/services/api/api.client.ts) is the only module that `fetch`es Steam. For `host: 'web'` it always adds `key` and `format=json`. Domain services own the Steam paths, for example:

- Library: `GET /IPlayerService/GetOwnedGames/v1/`
- Game details: `GET /api/appdetails` on the Store host

[`steam.plugin.ts`](src/plugins/steam.plugin.ts) constructs one `ApiClient` and the steam services, then decorates `fastify.steam`.

Responses that can be reused go through [`cache.service.ts`](src/services/cache.service.ts) (in-memory / file-backed LRU). Persisted `cache.json` entries keep their remaining TTL across restarts; keys with no TTL (`steam:apps`) stay until cleared.

---

## Routes (`/api/v1`)

| Method | Path | Service |
| ------ | ---- | ------- |
| POST | `/profile/resolve` | `steam.user.resolveSteamId` |
| GET | `/profile/:steamId` | `steam.user.getProfile` |
| GET | `/library/:steamId` | `steam.library.getLibrary` |
| GET | `/library/:steamId/random` | `steam.library.getRandomGame` |
| GET | `/library/:steamId/recent` | `steam.library.getRecentlyPlayedGames` |
| GET | `/library/refresh` | `steam.apps.refreshApps` (`X-Admin-Key`) |
| GET | `/games/:appId` | `steam.games.getGameDetails` |
| GET | `/cache/clear` | cache clear (`X-Admin-Key`) |

Body for resolve: `{ "input": "<SteamID64 | profile URL | vanity>" }`.

---

## Exploring the API

- Swagger: http://localhost:3000/docs
- Postman (Import file):
  - [`dev/SteamStats.Backend.postman_collection.json`](dev/SteamStats.Backend.postman_collection.json) — this API (`baseUrl` default `http://localhost:3000`)
  - [`dev/Steam.WebAPI.postman_collection.json`](dev/Steam.WebAPI.postman_collection.json) — upstream Steam Web + Store `appdetails` (set `steamApiKey`)

---

## Environment

Loaded from the repo-root `.env` (see [`.env.example`](../.env.example)):

| Variable | Used for |
| -------- | -------- |
| `STEAM_API_KEY` | Steam Web API (`ApiClient` host `web`) |
| `FRONTEND_ORIGIN` | CORS allowlist |
| `ADMIN_API_KEY` | `X-Admin-Key` for `/cache/clear` and `/library/refresh` (404 in production if unset) |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | Global rate limit |
| `LOG_DIR` | Daily-rotated request logs, pruned after 9 days (unset logs to stdout; the production image sets `/app/logs`) |

Store `appdetails` does not use the Web API key.

---

## Extending

Adding a Steam-backed API feature:

1. **Steam I/O** — implement or extend a class under [`src/services/api/steam/`](src/services/api/steam/) with `this.client.request({ host, path, params })`. Extra methods on an existing class (for example `SteamLibraryService`) do **not** need a new plugin entry.
2. **Plugin** — only if you added a **new** domain class, construct it in [`src/plugins/steam.plugin.ts`](src/plugins/steam.plugin.ts) and hang it on `fastify.steam`.
3. **Route** — expose HTTP under [`src/routes/`](src/routes/) that calls `fastify.steam.*`. Register a new file in [`src/routes/index.ts`](src/routes/index.ts).
4. **HTTP contract** — TypeBox schemas in [`src/schemas/`](src/schemas/) describe what `/api/v1` accepts and returns. Attach `schema.body` / `params` / `response`, plus `tags` and `operationId`, on **each route**. That is not one schema file per Steam service; one service can back several routes.
5. **Steam’s JSON** — keep raw Web/Store shapes in [`src/types/steam-api.types.ts`](src/types/steam-api.types.ts) (and store types). The SPA never imports those.
6. **Generate the SPA client** — this is **manual**, not on save. From the **repo root**:

```bash
npm run generate:api
```

Commit [`frontend/src/app/api/openapi.json`](../frontend/src/app/api/openapi.json) and [`frontend/src/app/api/generated/`](../frontend/src/app/api/generated/). How the Angular app uses those files: [frontend/README.md](../frontend/README.md).

Stay **one Fastify process**. Do not put Steam endpoint paths on `ApiClient`.
