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

1. Start infrastructure:

```bash
docker compose up -d
```

2. Install dependencies:

```bash
npm install
```

3. Apply schema:

Option A (recommended):

```bash
npm run drizzle:push
```

Option B:

Run `drizzle/0000_init.sql` manually in PostgreSQL.

4. Start server:

```bash
npm run start:dev
```

Server starts at `http://localhost:3000` by default.

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

## Notes

- REST responses are wrapped as:
  - success: `{ "success": true, "data": ... }`
  - error: `{ "success": false, "error": { "code", "message" } }`
- REST `POST /rooms/:id/messages` persists the message first, then publishes to Redis.
- WebSocket gateway listens to Redis pub/sub channels and broadcasts room-scoped events.
