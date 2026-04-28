# Architecture

## Overview

This service is split into four runtime layers:

1. HTTP API (Nest controllers)
2. Domain services (auth, rooms/messages)
3. Storage layer (PostgreSQL via Drizzle + Redis)
4. Realtime delivery layer (Socket.io gateway + Redis pub/sub + Redis adapter)

### Request flow (REST)

1. Client calls `/api/v1/*`.
2. Global session guard validates `Authorization: Bearer <token>` against Redis.
3. Controller delegates to service.
4. Service reads/writes PostgreSQL through Drizzle.
5. If needed, service publishes realtime events to Redis channels.
6. Global response interceptor wraps success payload in `{ success: true, data }`.
7. Global exception filter wraps errors in `{ success: false, error }`.

### Realtime flow (WebSocket)

1. Client connects to `/chat` namespace with `token` and `roomId`.
2. Gateway validates token from Redis and room existence from PostgreSQL.
3. Socket joins Socket.io room `<roomId>`.
4. Presence state is written to Redis (no in-memory maps).
5. Redis pub/sub events (`chat:message_new`, `chat:room_deleted`) are consumed by every instance.
6. Each instance fans events out to its connected sockets in the target room.

## Component Diagram

```text
Client
  | HTTP (/api/v1)                          WebSocket (/chat)
  v                                          v
Nest Controllers -----------------------> Socket.io Gateway
  |                                           |
  v                                           |
Domain Services                               |
  | \                                         |
  |  \ publish events                         |
  v   v                                       v
PostgreSQL (Drizzle ORM)                 Redis Pub/Sub Channels
  ^                                           |
  |                                           |
  +-------------------- Redis (sessions + presence + socket state)
```

## Session Strategy

- Token generation: cryptographically random 64-char hex string.
- Stored in Redis as `session:<token>`.
- Value contains `{ userId, username }`.
- TTL enforced by Redis `EX`.
- Expiry: default 24h (`SESSION_TTL_SECONDS=86400`).
- Login is idempotent by username:
  - if user exists, reuse existing user row
  - issue a fresh session token each call

## Redis Pub/Sub and Multi-instance Fan-out

- REST does not emit Socket.io events directly for message creation.
- `POST /rooms/:id/messages` publishes `chat:message_new`.
- `DELETE /rooms/:id` publishes `chat:room_deleted` before DB delete.
- Every API instance has a gateway subscriber listening to those channels.
- Each instance emits to its local sockets in the room.
- Socket.io Redis adapter is enabled so cross-instance room semantics remain consistent.

## Redis Data Model

- Sessions:
  - `session:<token>` -> JSON payload, TTL
- Presence:
  - `room:<roomId>:active_users` (Set of usernames)
  - `room:<roomId>:sockets` (Set of socket IDs)
  - `room:<roomId>:user:<username>:sockets` (Set of socket IDs for per-user presence correctness)
- Socket state:
  - `socket:<socketId>` (Hash with `roomId`, `username`)

## Estimated Single-instance Capacity

Conservative estimate on a typical 1 vCPU / 1-2 GB node:

- 2,000-4,000 concurrent websocket connections
- 150-400 messages/sec sustained room traffic (depending on message fan-out width)

Reasoning:

- Socket.io + Redis operations are network-bound and lightweight per event.
- Main bottlenecks are:
  - outbound fan-out volume per message
  - Redis round-trips for presence operations
  - PostgreSQL write throughput for message persistence

## Scaling to 10x Load

1. Horizontal scale API/WebSocket instances behind a load balancer.
2. Move Redis to managed high-memory plan, consider Redis Cluster for throughput.
3. Add PostgreSQL read replicas for read-heavy endpoints (`GET /rooms`, history).
4. Partition `messages` table (time or room hash) to reduce index/write contention.
5. Add caching layer for room metadata and paginated hot history windows.
6. Introduce backpressure/rate limiting per user and per room.
7. Add observability (OpenTelemetry, p95/p99 latency, pub/sub lag, dropped sockets).

## Limitations / Trade-offs

1. Cursor pagination uses message `id` as API cursor but ordering is by `createdAt`; if many rows share identical timestamps, strict deterministic ordering can be improved with a composite cursor.
2. Username identity is intentionally weak (no password/verification) by product requirement.
3. Room list endpoint calculates active user counts with per-room Redis calls; for very high room counts, batching or cached counters would reduce overhead.
4. No message edit/delete workflow (out of scope for contract).
