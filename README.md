# BOJU BOJU Arena

3D multiplayer hide-and-seek arena prototype (React + Three.js + FastAPI).

## Repo layout

- `apps/web` - React + Vite + TypeScript client (Three.js / R3F / Rapier / Zustand)
- `apps/api` - FastAPI backend (auth, rooms/lobby, WebSocket, round manager)
- `packages/shared/ts` - shared TypeScript protocol/types/constants
- `packages/shared/py` - shared Python package scaffold
- `infra` - infrastructure notes/scaffold
- `.github/workflows` - CI (web build/lint, api lint/tests, docker compose config)
- `docker-compose.yml` - local dev stack (web, api, postgres, redis)

## Local run (no Docker, easiest)

### API

```bash
cd apps/api
pip install -r requirements.txt
copy .env.example .env
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Uses SQLite by default (`boju_dev.db`) and in-memory fallback when Redis is unavailable. Check: `GET http://localhost:8000/health`

### Web

```bash
cd apps/web
npm install
copy .env.example .env
npm run dev
```

Open: http://localhost:5173

## Local run (Docker Compose, optional)

1. Copy env files:
   - `copy apps\api\.env.example apps\api\.env`
   - `copy apps\web\.env.example apps\web\.env`
2. Set `DATABASE_URL`/`REDIS_URL` for Postgres/Redis services if needed, then start:
   - `docker compose up --build`
3. Open web: `http://localhost:5173` (API: `http://localhost:8000`)

## Tests / lint

API (from `apps/api`):
```bash
ruff check .
pytest -q
```

Web (from `apps/web`):
```bash
npm run lint
npm run build
```

## Implemented phases

- **Phase 0**: monorepo scaffold, Docker Compose (api/postgres/redis/web), CI, shared protocol/constants/noise stubs, `GET /health`.
- **Phase 1**: auth (register/login/refresh/logout/forgot/reset/verify), `/auth/me`, `/auth/ws-ticket`, argon2 + JWT access/rotating refresh cookie + DB token hashes, rate limiting/lockout basics, user/profile/stats/roles, reports/admin basics, web auth pages/profile.
- **Phase 2**: lobby/room REST (`GET/POST /rooms`, `/rooms/{id}/join|leave`, `/rooms/quick-match`) + WebSocket presence (`/ws/rooms/{id}?ticket=...`), 20-player capacity, ready system, host start/auto-start, host migration, 30s reconnect grace, room browser UI.
- **Phase 3**: greybox 3D map + first/third-person movement + spectator camera + client-side physics (single-player sandbox), `/play` page (Three.js/R3F/Rapier/Zustand).
- **Phase 4 (prototype)**: server-authoritative room round flow (hiding -> seeking -> ended -> lobby), team assignment (seekers/hiders), round timers/win conditions, WebSocket gameplay messages (`player.state` sync, `player.tag`, `player.eliminated`, snapshots/phase events), and in-room 3D arena view with networked player proxies, seeker tagging, elimination-to-spectator, and phase/role HUD.

## How to test

### Phase 2 (lobby/rooms)
1. Start API + web (and Postgres/Redis via compose or local env).
2. Sign in in the web app.
3. Open **Lobby**: create room, quick match, list/join rooms.
4. In a room: observe live WebSocket state, ready/unready, host start, multiple sessions, leave/rejoin, disconnect grace/host migration (in-memory; API restart resets rooms).

### Phase 3 (greybox sandbox)
1. `cd apps/web && npm install && npm run dev` (or build/preview).
2. Open http://localhost:5173/play.
3. Click scene to pointer-lock mouse. Controls: **WASD** move, **mouse** look, **Space** jump, **Shift** sprint, **C** crouch, **1/2/3** first/third/spectator, **L** lock prop, **F** spectator follow, **Esc** unlock.

### Phase 4 (room rounds / networked arena)
1. Start API + web and sign in with 4+ accounts/sessions (or enough connected players).
2. Create/join the same room; ready up and start (or auto-start when all ready).
3. When round begins, click **Enter Arena** in the room page (auto-enters on phase change).
4. Hiding phase: hiders move/hide (use **L** to lock as prop). Seekers are held until seeking.
5. Seeking phase: seekers chase and click near hiders to tag; tagged hiders are eliminated and spectate. Round ends when hiders are eliminated (seekers win) or timer expires (hiders win), then returns to lobby.

## Notes

- Room/game/round state is in-memory (Redis-backed scaling hooks can be added later).
- Phase 4 is a playable prototype: client relays movement state and tagging intents over room WebSocket while server manages phases/teams/elimination/win conditions. Further hardening can add authoritative movement validation, prop system, voice/noise mechanics, anti-cheat, persistence, and deployment polish.
- No-Docker local run is supported (SQLite + in-memory rate-limit fallback). Redis/Postgres/Docker are optional and not required for basic local functionality.
