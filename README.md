# Anonymous Chat API

Backend implementation of the interview task using NestJS, PostgreSQL + Drizzle ORM, Redis, and Socket.io.

## Tech

- NestJS
- PostgreSQL
- Drizzle ORM
- Redis
- Socket.io
- TypeScript

## Base URL and API prefix

- API prefix: `/api/v1`
- WebSocket namespace: `/chat`

## Environment variables

Copy `.env.example` to `.env` and adjust values:

```bash
cp .env.example .env
```

| Variable | Description |
| --- | --- |
| `PORT` | HTTP server port |
| `APP_ORIGIN` | CORS origin (default `*`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `SESSION_TTL_SECONDS` | Session token TTL in seconds (default `86400`) |

## Run locally

1. Start API + infrastructure:

```bash
docker compose up -d
```

2. Verify services are running:

```bash
docker ps
```

3. Apply schema:

Option A (recommended):

```bash
docker exec -it anonchat-api sh -lc "npm run drizzle:push"
```

Option B:

Run `drizzle/0000_init.sql` manually in PostgreSQL:

```bash
Get-Content .\drizzle\0000_init.sql | docker exec -i anonchat-postgres-1 psql -U postgres -d anon_chat
```

4. Follow API logs (optional):

```bash
docker logs -f anonchat-api
```

Server starts at `http://localhost:3000` by default.

Note: in Docker Compose, the API runs via `npm run start:dev`.

## API auth

- `POST /api/v1/login` is public.
- Every other HTTP endpoint requires:

```http
Authorization: Bearer <sessionToken>
```

Session tokens are stored in Redis and expire automatically after 24 hours (configurable by `SESSION_TTL_SECONDS`).

## WebSocket

Connect via:

```text
ws://host/chat?token=<sessionToken>&roomId=<roomId>
```

Supported server events:

- `room:joined`
- `room:user_joined`
- `message:new`
- `room:user_left`
- `room:deleted`

Supported client events:

- `room:leave`

## Deployment

- Deployed URL: `TBD` (set this after deploy)
- For Render (or any cloud host), do not use local defaults from `.env.example` for data services.
- Set `DATABASE_URL` and `REDIS_URL` to your managed service connection strings.
- `REDIS_URL=redis://localhost:6379` is for local development only and will fail in Render with `ECONNREFUSED`.
- Render build command: `npm install && npm run build:render`
- Render start command: `npm run start:prod`
- Do not run Prisma commands in this project (it uses Drizzle, not Prisma).

## Notes

- REST responses are wrapped as:
  - success: `{ "success": true, "data": ... }`
  - error: `{ "success": false, "error": { "code", "message" } }`
- REST `POST /rooms/:id/messages` persists the message first, then publishes to Redis.
- WebSocket gateway listens to Redis pub/sub channels and broadcasts room-scoped events.
