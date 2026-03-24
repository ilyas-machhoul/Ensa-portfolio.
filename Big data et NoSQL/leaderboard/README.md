# APEX RANK — Real-Time Gaming Leaderboard

> Big Data & NoSQL Mini Project — Node.js + Redis + WebSocket

## Quick Start

### Option 1 — Docker (recommended)
```bash
npm run docker:up
# → http://localhost:3000
```

### Option 2 — Local dev
```bash
# Terminal 1: start Redis
docker run -p 6379:6379 redis:7-alpine

# Terminal 2: start server
npm install
npm run dev
# → http://localhost:3000
```

## Project Structure

```
leaderboard-system/
├── client/
│   └── index.html              # Frontend (HTML/CSS/JS)
├── config/
│   └── index.js                # Environment config
├── server/
│   ├── index.js                # Entry point (Express + HTTP server)
│   ├── websocket/
│   │   └── wsManager.js        # WebSocket connection registry & broadcast
│   ├── redis/
│   │   └── client.js           # Redis connection + ZSET helpers
│   ├── services/
│   │   ├── leaderboardService.js   # Score updates, leaderboard builds
│   │   ├── playerService.js        # Player CRUD, online tracking
│   │   └── achievementService.js   # Achievement detection & storage
│   └── controllers/
│       └── playerController.js     # REST API handlers
├── docker/
│   ├── docker-compose.yml
│   └── Dockerfile
├── package.json
└── README.md
```

## REST API

| Method | Endpoint                        | Description                  |
|--------|---------------------------------|------------------------------|
| POST   | /api/players                    | Register a new player        |
| GET    | /api/players/:id                | Get player + ranks           |
| GET    | /api/players/:id/neighbors      | Get surrounding players      |
| GET    | /api/leaderboard?continent=NA   | Full leaderboard snapshot    |
| GET    | /api/health                     | Health check                 |

## WebSocket Messages

### Client → Server
```json
{ "type": "player:join", "playerId": "p1", "username": "Alice", "state": "CA", "continent": "NA" }
{ "type": "score:update", "increment": 100 }
{ "type": "ping" }
```

### Server → Client
```json
{ "type": "leaderboard:update", "world": [...], "continent": [...], "state": [...] }
{ "type": "achievement:unlocked", "achievements": [...], "ranks": {...} }
{ "type": "achievement:announcement", "player": "Alice", "achievements": [...] }
```

## Redis Schema

```
leaderboard:world                  ZSET  { player_id: score }
leaderboard:continent:{continent}  ZSET  { player_id: score }
leaderboard:state:{state}          ZSET  { player_id: score }
player:{id}                        HASH  { id, username, state, continent, totalScore }
online:players                     SET   { player_id, ... }
achievements:{id}                  SET   { achievement_id, ... }
```

## Key Redis Commands

```bash
# Inspect world leaderboard
redis-cli ZREVRANGE leaderboard:world 0 9 WITHSCORES

# Get player rank
redis-cli ZREVRANK leaderboard:world <player_id>

# Count online players
redis-cli SCARD online:players

# View player profile
redis-cli HGETALL player:<player_id>
```
