# SteamStats

A Steam companion dashboard for exploring public profile and library data.

Enter a **SteamID64** or **Steam profile URL** to view:

- Profile information
- Owned games and playtime
- Recently played games
- Simple library statistics
- A random game picker

Steam credentials never leave the backend. The browser only talks to this app’s `/api/v1` routes.

SteamStats is an **npm workspaces** monorepo:

| Package     | Role                                                          |
| ----------- | ------------------------------------------------------------- |
| `frontend/` | Angular 22 SPA (Material + Tailwind)                          |
| `backend/`  | Fastify API that proxies Steam Web API and Store `appdetails` |

The HTTP contract is OpenAPI. Live docs: [http://localhost:3000/docs](http://localhost:3000/docs). Architecture stays **one Fastify API process plus the Angular SPA** — OpenAPI does not mean splitting profile, library, or games into more services.

More detail: [backend/README.md](backend/README.md) · [frontend/README.md](frontend/README.md)

---

## Prerequisites

- Node.js 22+
- npm 10+
- A [Steam Web API key](https://steamcommunity.com/dev/apikey)
- Docker + Docker Compose (optional)

---

## Setup

```bash
git clone https://github.com/slurrps-mcgee/SteamStats.git
cd SteamStats
cp .env.example .env
```

Edit `.env`:

| Variable               | Purpose                                                          |
| ---------------------- | ---------------------------------------------------------------- |
| `STEAM_API_KEY`        | Steam Web API key (required; never expose to the browser)        |
| `FRONTEND_ORIGIN`      | CORS origin of the UI                                            |
| `ADMIN_API_KEY`        | Shared secret for `X-Admin-Key` on cache-clear / library-refresh |
| `RATE_LIMIT_MAX`       | Max requests per window                                          |
| `RATE_LIMIT_WINDOW_MS` | Rate-limit window                                                |
| `LOG_DIR`              | Daily request-log files, deleted after 9 days (unset = stdout)   |

Set `FRONTEND_ORIGIN` to the origin you actually open in the browser:

- Local npm or `docker compose` (dev): `http://localhost:4200`
- Prod-like nginx compose: `http://localhost:8080`
- Public Cloudflare Tunnel: `https://steamstats.quantumcode.dev` (or your real HTTPS origin)

```bash
npm ci
```

---

## Local development (npm)

Two terminals from the repo root:

```bash
npm run dev:backend
```

API: [http://localhost:3000](http://localhost:3000) · health: [http://localhost:3000/health](http://localhost:3000/health) · Swagger: [http://localhost:3000/docs](http://localhost:3000/docs)

```bash
npm run dev:frontend
```

UI: [http://localhost:4200](http://localhost:4200)

The Angular dev server proxies `/api` to `http://localhost:3000` (`frontend/proxy.conf.dev.json`).

---

## Docker

Copy `.env` as above first.

**Dev (live reload)** — bind-mounts the repo; `tsx watch` + `ng serve`:

```bash
docker compose up --build
```

- UI: [http://localhost:4200](http://localhost:4200)
- API: [http://localhost:3000](http://localhost:3000)

The frontend container uses `frontend/proxy.conf.js` (`/api` → `http://backend:3000`).

**Production-like** — multi-stage images; nginx on `127.0.0.1:8080`, backend not published:

```bash
docker compose -f docker-compose.prod.example.yml up --build -d
```

UI: [http://localhost:8080](http://localhost:8080) (`/api` reverse-proxied by nginx). The host bind is loopback-only so a Cloudflare Tunnel (or SSH) can reach it without exposing HTTP on the WAN.

---

## HTTP contract (OpenAPI)

TypeBox on Fastify routes is the source of truth. There is no shared TypeScript package. Live spec: [http://localhost:3000/docs](http://localhost:3000/docs). Architecture stays **one Fastify process plus the Angular SPA** — OpenAPI is not a reason to split profile, library, or games into more services.

### Backend (new Steam-backed endpoint)

1. **Steam I/O** — implement or extend a class under [`backend/src/services/api/steam/`](backend/src/services/api/steam/) with `this.client.request({ host, path, params })`. Extra methods on an existing class do **not** need a new plugin entry.
2. **Plugin** — only if you added a **new** domain class, construct it in [`backend/src/plugins/steam.plugin.ts`](backend/src/plugins/steam.plugin.ts) and hang it on `fastify.steam`.
3. **Route** — expose HTTP in [`backend/src/routes/`](backend/src/routes/) that calls `fastify.steam.*`. Register a new file in [`backend/src/routes/index.ts`](backend/src/routes/index.ts).
4. **Schemas** — TypeBox in [`backend/src/schemas/`](backend/src/schemas/) is the HTTP contract (request/response **per route**, not one file per Steam service). Attach `schema.body` / `params` / `response`, plus `tags` and `operationId`.
5. **Steam’s JSON** — keep raw Web/Store shapes in [`backend/src/types/steam-api.types.ts`](backend/src/types/steam-api.types.ts). The SPA never imports those.

### Generate the SPA client (manual, not on save)

From the **repo root**:

```bash
npm run generate:api
```

That writes (do not hand-edit):

- [`frontend/src/app/api/openapi.json`](frontend/src/app/api/openapi.json) — dumped spec
- [`frontend/src/app/api/generated/`](frontend/src/app/api/generated/) — `Api` plus functions such as `getProfile` / `getLibrary`

Commit both so the frontend Docker image can build without a running API.

### Frontend

TypeBox validates JSON on the **API**. The SPA only gets TypeScript types.

Use generated functions from stores and pages, for example `this.api.invoke(getProfile, { steamId })`. Do **not** add a hand-written `*.api.service.ts` or call `HttpClient` yourself for `/api/v1`. Short names (`OwnedGame`, `SteamProfile`) live in [`frontend/src/app/interfaces/api.ts`](frontend/src/app/interfaces/api.ts). Retries (5xx / network) are in the HTTP interceptor.

Package-level detail: [backend/README.md](backend/README.md) · [frontend/README.md](frontend/README.md).

---

## Project layout

```text
/
├── frontend/          Angular app (openapi.json + generated/ under src/app/api/)
├── backend/           Fastify API
├── scripts/           Docker dev entrypoint
├── docker-compose.yml
├── docker-compose.prod.example.yml
├── .env.example
└── package.json
```

---

## Backend API

All app routes are under `/api/v1`.

| Method | Path                              | Description                                    |
| ------ | --------------------------------- | ---------------------------------------------- |
| POST   | `/api/v1/profile/resolve`         | Resolve SteamID64, profile URL, or vanity name |
| GET    | `/api/v1/profile/:steamId`        | Normalized player profile                      |
| GET    | `/api/v1/library/:steamId`        | Owned games and library stats                  |
| GET    | `/api/v1/library/:steamId/random` | Random owned game                              |
| GET    | `/api/v1/library/:steamId/recent` | Games played in the last 2 weeks               |
| GET    | `/api/v1/library/refresh`         | Refresh cached Steam app list (`X-Admin-Key`)  |
| GET    | `/api/v1/games/:appId`            | Steam Store details for one app                |
| GET    | `/api/v1/cache/clear`             | Clear backend cache (`X-Admin-Key`)            |
| GET    | `/health`                         | Liveness                                       |

---

## Security

- `STEAM_API_KEY` is used only by the backend.
- CORS is limited to `FRONTEND_ORIGIN`.
- Helmet and rate limiting are enabled on the API (`trustProxy` is on for Cloudflare / nginx).
- Browser security headers (CSP, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, HSTS, Permissions-Policy) are set in [`frontend/nginx.conf`](frontend/nginx.conf). SPA routes use a named `@spa` location so those headers stay on `index.html` (nginx `add_header` does not inherit). CSP `img-src` allows `https:` so the browser can load Steam CDN artwork. `connect-src` stays `'self'` because `/api` is same-origin. There is no Angular service worker (same as Snippy); leftover `ngsw` clients unregister on load.
- `GET /api/v1/cache/clear` and `GET /api/v1/library/refresh` require `X-Admin-Key` matching `ADMIN_API_KEY`. In production those routes return 404 if the key is unset.

### Cloudflare Tunnel + Portainer

TLS terminates at Cloudflare. Do not put certificates in the nginx container.

| Setting           | Where                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Always Use HTTPS  | SSL/TLS → Edge Certificates                                                                                                           |
| HSTS              | Same page (skip preload until every subdomain is HTTPS). nginx also sends HSTS                                                        |
| Minimum TLS 1.2   | SSL/TLS → Edge Certificates (1.3 if clients allow). Cipher control is limited on the free plan                                        |
| WAF (PCI 6.4)     | Security → WAF → enable Cloudflare Managed Rules. Scanners may still say “no WAF” unless they see a challenge                         |
| DNSSEC            | DNS → Settings → Enable DNSSEC, then add the DS record at the registrar                                                               |
| Report-To         | Origin does not set this. Strip it with a Response Header Transform Rule, or disable Network Error Logging (the header is deprecated) |
| Tunnel origin     | `http://127.0.0.1:8080` (host) or `http://frontend:8080` (Docker network)                                                             |
| `FRONTEND_ORIGIN` | `https://your-domain` in Portainer, not `localhost`                                                                                   |

Rebuild and redeploy the frontend image after pulling these changes. ImmuniWeb findings for missing headers/CSP and “outdated Angular” are from the live image; `curl -sI https://steamstats.quantumcode.dev` must show CSP, HSTS, `X-Frame-Options`, and `nosniff` after deploy.

If a scanner reports “HTTP port open” or “SSL not available”, confirm it probed the **Cloudflare hostname** rather than the VPS IP. Cloudflare port 80 should stay open so HTTP can redirect to HTTPS. Origin 80/8080/3000 and Portainer must not be published on the WAN.

### What header/TLS scanners miss

Re-scan after deploy with `curl -sI https://your-domain` and the original tools. Also cover:

- Dependency SCA (`npm run check:audit`; Dependabot or osv-scanner for moderate issues)
- Container image CVEs (`nginx:*-alpine`, `node:22-alpine`)
- Secret scanning (Steam key, `.env`)
- DAST against `/api/v1` (authz, CORS, XSS via Store HTML, rate limits, TRACE/PUT/DELETE)
- Origin IP leak (DNS history, Portainer, SSH, Docker API)

---

## License

[MIT](LICENSE)
