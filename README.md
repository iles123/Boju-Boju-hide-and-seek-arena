# Boju Boju Arena

3D multiplayer hide-and-seek arena prototype (web). Phases 0-4 are implemented as a playable prototype: auth scaffolding, rooms/lobby/presence, greybox movement sandbox, round/phase flow, and a networked in-memory arena with basic seeker/hider gameplay.

## Stack
- Frontend: React + Vite + TypeScript + Three.js / React Three Fiber / Rapier / Zustand (`apps/web`)
- Backend: FastAPI + SQLAlchemy (async) + WebSockets (`apps/api`)
- Shared protocol/types: `packages/shared/*`
- Optional infra: Docker Compose for Postgres/Redis (`docker-compose.yml`)

## Features (current prototype)
- Auth/lobby/rooms with quick match, create/join, invite by room code/link, and password-protected rooms
- Friends can join the same room and coordinate with preferred team selection, while public rooms/matchmaking allow playing against other players
- Round flow in `apps/api/app/services/room_manager.py`: `lobby -> hiding (45s) -> seeking (300s) -> ended (10s) -> lobby`
- Team assignment (seekers/hiders), elimination to spectator, basic win conditions, and phase timers
- Networked arena prototype over room WebSocket: player state sync, remote players, seeker tagging, phase/round events
- Meccha Chameleon-inspired hide-and-seek feel: smooth WASD + mouse movement, jump/crouch, lock/pose to camouflage as a hider, 1P/3P/spectator camera modes
- Procedural character animation and game-friendly HUD/UI
- Virtual/mobile controls (on-screen joystick, look pad, jump/sprint/crouch/lock/camera/tag buttons) for touch devices and smaller screens
- Bundled looping arena music with a visible MUSIC OFF / MUSIC ON toggle (default off until clicked)
- **No-Docker local run**: API defaults to SQLite and in-memory rate limiting fallback when Redis is unavailable

## Local development (no Docker)
Prereqs: Node.js 18+, Python 3.11+.

### 1) API
```powershell
cd apps/api
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
# optional: copy .env.example to .env (defaults already work for local no-Docker)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- Health: `GET http://localhost:8000/health` -> `{"status":"ok","phase":"4"}`
- Default DB: SQLite file `boju_dev.db` in `apps/api` (`DATABASE_URL=sqlite+aiosqlite:///./boju_dev.db`)
- Redis optional: if `REDIS_URL` is not reachable, API falls back to in-memory rate limiting (suitable for local dev)

### 2) Web
```powershell
cd apps/web
npm install
# optional: copy .env.example to .env and set VITE_API_BASE_URL (defaults to http://localhost:8000)
npm run dev
```
Open the Vite URL (usually `http://localhost:5173`). Register/sign in, create/join a room (or share room code/link with friends), ready up, start round, and play.

## How to play
- **Desktop:** WASD move, mouse look, Space jump, Shift sprint, C crouch, 1/2/3 camera (1P/3P/spectator), L lock/pose (camouflage prop form for hiders), F spectator follow in sandbox/spectator modes, click near hiders as seeker during seeking phase to tag.
- **Mobile/touch:** on-screen joystick to move, drag look area to look, and action buttons for Jump/Sprint/Crouch/Lock/Cam/Tag.
- **With friends vs others:** one player creates a public room and shares the room code/invite link; friends join the same room and set preferred team (auto/hider/seeker) to coordinate; additional players can join from lobby/quick match to fill the match. Minimum 4 active players required to start a round.

## Build / lint / test
Web:
```powershell
cd apps/web
npm run lint
npm run build
```
API:
```powershell
cd apps/api
python -m ruff check .
python -m pytest -q
```

## Docker (optional)
`docker-compose.yml` provides Postgres/Redis/API/Web for local containerized runs if Docker is installed:
```powershell
docker compose up --build
```
This is optional; the app is designed to run locally without Docker.

## Deploying to Render (recommended approach)
This repo is a monorepo with separate web and API services. A practical Render setup is **one Web Service for API + one Static Site for web** (and a managed Postgres for persistence).

### 1) Database (where it is / what to use)
- **Local (no Docker):** SQLite database file at `apps/api/boju_dev.db` (created automatically). Good for local/dev only.
- **Production (Render):** create a **Render PostgreSQL** instance. Render provides an internal/external connection string. Use the **Internal Database URL** for the API service running on Render.
  - Set API env `DATABASE_URL` to the Render Postgres URL but with async driver, e.g. `postgresql+asyncpg://USER:PASSWORD@HOST:PORT/DBNAME`.
  - SQLite files on Render web services are not durable across deploys/restarts; use Postgres for hosted environments.

### 2) API service on Render (Web Service)
- Create a **Web Service** from this repo.
- Root directory: `apps/api`
- Build command:
  ```bash
  pip install -r requirements.txt
  ```
- Start command:
  ```bash
  uvicorn app.main:app --host 0.0.0.0 --port $PORT
  ```
- Environment variables (minimum): 
  - `DATABASE_URL=postgresql+asyncpg://...` (Render Postgres internal URL, asyncpg form)
  - `JWT_SECRET=<strong-random-secret>`
  - `CORS_ORIGINS=https://<your-web-static-site>.onrender.com` (comma-separated if multiple)
  - `APP_ENV=production`
  - `REDIS_URL` optional (if you provision Redis); if omitted/unavailable, app falls back to in-memory rate limiting (fine for single-instance prototype, not distributed)
- Notes: room/gameplay state is currently **in-memory** (prototype). For multi-instance scaling/persistence you would need shared state (Redis/DB) and authoritative server extensions (not yet implemented). For a demo/prototype, run a single API instance.

### 3) Web service on Render (Static Site)
- Create a **Static Site** from this repo.
- Root directory: `apps/web`
- Build command:
  ```bash
  npm install && npm run build
  ```
- Publish directory: `dist`
- Environment variable:
  - `VITE_API_BASE_URL=https://<your-api-service>.onrender.com`
- Because this is an SPA, add a rewrite rule in Render Static Site settings: `/* -> /index.html` (so routes like `/rooms/:id` work on refresh).

### 4) After deploy checklist
- Open API `/health` and confirm `{"status":"ok","phase":"4"}`
- Confirm web can register/login and create/join rooms
- Test invite link/room code flow between two browsers/devices
- If using cookies/auth across domains, ensure CORS origins and credentials settings match your deployed URLs

## Notes / limitations
- Prototype phase: server manages phases/teams/elimination but client relays movement; full authoritative movement validation, anti-cheat, persistence of full match history, and horizontal scaling are future work.
- Audio/BGM is bundled at `apps/web/public/audio/legacy.mp3` and starts only after the user enables it.
