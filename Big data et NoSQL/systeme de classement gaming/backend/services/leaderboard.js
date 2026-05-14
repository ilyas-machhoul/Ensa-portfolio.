const redis = require("./redis-client");
const { ACHIEVEMENTS } = require("./achievements");

const BOARDS = ["global", "daily", "weekly", "ranked", "casual"];

const prefix   = (mode) => mode === "dataset" ? "ds:" : "";
const boardKey = (type, mode) => `${prefix(mode)}lb:${type}`;
const playerKey = (id, mode)  => `${prefix(mode)}player:${id}`;
const achKey    = (id, mode)  => `${prefix(mode)}ach:${id}`;

async function seedLeaderboards(players) {
  const pipe = redis.pipeline();
  for (const b of BOARDS) pipe.del(boardKey(b, "custom"));
  for (const p of players) {
    pipe.hset(playerKey(p.id, "custom"),
      "id", p.id, "username", p.username, "country", p.country,
      "avatar", p.avatar, "kills", p.kills, "deaths", p.deaths,
      "wins", p.wins, "matches", p.matches, "kd_ratio", p.kd_ratio,
      "accuracy", p.accuracy, "playtime_hours", p.playtime_hours, "tier", p.tier
    );
    pipe.zadd(boardKey("global",  "custom"), p.total_score, p.id);
    pipe.zadd(boardKey("daily",   "custom"), Math.floor(p.total_score * (0.10 + Math.random() * 0.10)), p.id);
    pipe.zadd(boardKey("weekly",  "custom"), Math.floor(p.total_score * (0.30 + Math.random() * 0.20)), p.id);
    pipe.zadd(boardKey("ranked",  "custom"), p.kills * 12 + p.wins * 50, p.id);
    pipe.zadd(boardKey("casual",  "custom"), p.matches * 80 + p.wins * 20, p.id);
  }
  await pipe.exec();
  console.log(`✅ Custom: seeded ${players.length} players`);
}

async function seedDataset(players) {
  console.log(`⏳ Seeding ${players.length} dataset players...`);
  const CHUNK = 200;
  const clearPipe = redis.pipeline();
  for (const b of BOARDS) clearPipe.del(boardKey(b, "dataset"));
  await clearPipe.exec();

  for (let i = 0; i < players.length; i += CHUNK) {
    const chunk = players.slice(i, i + CHUNK);
    const pipe  = redis.pipeline();
    for (const p of chunk) {
      pipe.hset(playerKey(p.id, "dataset"),
        "id", p.id, "username", p.username, "country", p.country,
        "avatar", p.avatar, "kills", p.kills, "deaths", p.deaths,
        "wins", p.wins, "matches", p.matches, "kd_ratio", p.kd_ratio,
        "accuracy", p.accuracy, "playtime_hours", p.playtime_hours, "tier", p.tier,
        "age", p.age, "gender", p.gender, "genre", p.genre,
        "difficulty", p.difficulty, "sessions_per_week", p.sessions_per_week,
        "avg_session_min", p.avg_session_min,
        "achievements_unlocked", p.achievements_unlocked,
        "engagement", p.engagement, "in_game_purchases", p.in_game_purchases,
        "player_level", p.player_level
      );
      pipe.zadd(boardKey("global",  "dataset"), p.total_score, p.id);
      pipe.zadd(boardKey("daily",   "dataset"), Math.floor(p.total_score * (0.10 + Math.random() * 0.10)), p.id);
      pipe.zadd(boardKey("weekly",  "dataset"), Math.floor(p.total_score * (0.30 + Math.random() * 0.20)), p.id);
      pipe.zadd(boardKey("ranked",  "dataset"), p.kills * 10 + p.wins * 40, p.id);
      pipe.zadd(boardKey("casual",  "dataset"), p.matches * 60 + p.player_level * 30, p.id);
    }
    await pipe.exec();
    process.stdout.write(`\r⏳ ${Math.min(i + CHUNK, players.length)}/${players.length}`);
  }
  console.log(`\n✅ Dataset: seeded ${players.length} players`);
}

async function getTopN(type = "global", n = 30, mode = "custom") {
  const ids = await redis.zrevrange(boardKey(type, mode), 0, n - 1, "WITHSCORES");
  const players = [];
  for (let i = 0; i < ids.length; i += 2) {
    const id    = ids[i];
    const score = parseInt(ids[i + 1]);
    const meta  = await redis.hgetall(playerKey(id, mode));
    const achIds = await redis.smembers(achKey(id, mode));
    players.push({ rank: i / 2 + 1, id, score, ...meta, achievements: achIds });
  }
  return players;
}

async function getTopNPaged(type = "global", limit = 100, mode = "custom", offset = 0) {
  const ids = await redis.zrevrange(boardKey(type, mode), offset, offset + limit - 1, "WITHSCORES");
  if (!ids.length) return [];

  // Batch all hgetall + smembers in one pipeline for speed
  const pipe = redis.pipeline();
  for (let i = 0; i < ids.length; i += 2) {
    pipe.hgetall(playerKey(ids[i], mode));
    pipe.smembers(achKey(ids[i], mode));
  }
  const results = await pipe.exec();

  const players = [];
  let ri = 0;
  for (let i = 0; i < ids.length; i += 2) {
    const id    = ids[i];
    const score = parseInt(ids[i + 1]);
    const meta  = results[ri][1] || {};
    const achIds = results[ri + 1][1] || [];
    players.push({ rank: offset + i / 2 + 1, id, score, ...meta, achievements: achIds });
    ri += 2;
  }
  return players;
}

async function getBoardTotal(type = "global", mode = "custom") {
  return await redis.zcard(boardKey(type, mode));
}

async function getPlayerRank(playerId, type = "global", mode = "custom") {
  const [rank, score] = await Promise.all([
    redis.zrevrank(boardKey(type, mode), playerId),
    redis.zscore(boardKey(type, mode), playerId),
  ]);
  return { rank: rank !== null ? rank + 1 : null, score: parseInt(score) || 0 };
}

async function getNeighbors(playerId, type = "global", mode = "custom", radius = 4) {
  const rank0 = await redis.zrevrank(boardKey(type, mode), playerId);
  if (rank0 === null) return [];
  const start = Math.max(0, rank0 - radius);
  const end   = rank0 + radius;
  const ids   = await redis.zrevrange(boardKey(type, mode), start, end, "WITHSCORES");
  const result = [];
  for (let i = 0; i < ids.length; i += 2) {
    const id    = ids[i];
    const score = parseInt(ids[i + 1]);
    const meta  = await redis.hgetall(playerKey(id, mode));
    result.push({ rank: start + i / 2 + 1, id, score, ...meta, isTarget: id === playerId });
  }
  return result;
}

async function addScore(playerId, delta, boardType = "global", mode = "custom") {
  const newScore = await redis.zincrby(boardKey(boardType, mode), delta, playerId);
  if (boardType === "global" && delta > 0) {
    await redis.hincrbyfloat(playerKey(playerId, mode), "kills",   Math.floor(delta / 30));
    await redis.hincrbyfloat(playerKey(playerId, mode), "matches", 1);
  }
  const newRank = await redis.zrevrank(boardKey(boardType, mode), playerId);
  return { newScore: parseInt(newScore), newRank: newRank + 1 };
}

async function setScore(playerId, score, boardType = "global", mode = "custom") {
  await redis.zadd(boardKey(boardType, mode), score, playerId);
  const newRank = await redis.zrevrank(boardKey(boardType, mode), playerId);
  return { newScore: score, newRank: newRank + 1 };
}

async function checkAchievements(playerId, boardType = "global", mode = "custom") {
  const { score, rank } = await getPlayerRank(playerId, boardType, mode);
  const newlyUnlocked = [];
  for (const ach of ACHIEVEMENTS) {
    const already = await redis.sismember(achKey(playerId, mode), ach.id);
    if (!already && ach.condition(score, rank)) {
      await redis.sadd(achKey(playerId, mode), ach.id);
      newlyUnlocked.push(ach);
    }
  }
  return newlyUnlocked;
}

async function getAllPlayers(mode = "custom", limit = 100, board = "global") {
  // Get ALL players on the specified board (ignore limit for simulator)
  const ids = await redis.zrevrange(boardKey(board, mode), 0, -1);
  if (!ids.length) return [];

  // Batch fetch metadata in one pipeline for speed
  const pipe = redis.pipeline();
  for (const id of ids) {
    pipe.hgetall(playerKey(id, mode));
    pipe.zscore(boardKey(board, mode), id);
  }
  const results = await pipe.exec();

  const players = [];
  for (let i = 0; i < ids.length; i++) {
    const meta  = results[i * 2][1] || {};
    const score = parseInt(results[i * 2 + 1][1]) || 0;
    players.push({ id: ids[i], score, ...meta });
  }
  return players;
}

async function getBoardsSummary(mode = "custom") {
  const summary = {};
  for (const b of BOARDS) {
    const count = await redis.zcard(boardKey(b, mode));
    const top   = await redis.zrevrange(boardKey(b, mode), 0, 0, "WITHSCORES");
    summary[b]  = { count, topScore: top[1] ? parseInt(top[1]) : 0, topId: top[0] || null };
  }
  return summary;
}

async function getLiveStats(mode = "custom") {
  const total    = await redis.zcard(boardKey("global", mode));
  const topEntry = await redis.zrevrange(boardKey("global", mode), 0, 0, "WITHSCORES");
  const topMeta  = topEntry[0] ? await redis.hgetall(playerKey(topEntry[0], mode)) : {};
  return { totalPlayers: total, topPlayer: { id: topEntry[0], score: parseInt(topEntry[1]) || 0, ...topMeta } };
}

async function getDatasetStats() {
  // Genre distribution from top 500
  const ids = await redis.zrevrange(boardKey("global", "dataset"), 0, 499, "WITHSCORES");
  const genres = {}, locs = {}, tiers = {};
  for (let i = 0; i < ids.length; i += 2) {
    const m = await redis.hgetall(playerKey(ids[i], "dataset"));
    if (m.genre)   genres[m.genre]    = (genres[m.genre]   || 0) + 1;
    if (m.country) locs[m.country]    = (locs[m.country]   || 0) + 1;
    if (m.tier)    tiers[m.tier]      = (tiers[m.tier]     || 0) + 1;
  }
  return { genres, locations: locs, tiers };
}

// ─── Filtered search (username + genre + tier + engagement) ───────────────────
async function searchPlayersFiltered(query, type = "global", mode = "custom", limit = 100, offset = 0, filters = {}) {
  const q   = (query || "").toLowerCase().trim();
  const { filterGenre = "", filterTier = "", filterEng = "" } = filters;
  const CHUNK = 500;

  const totalIds = await redis.zrevrange(boardKey(type, mode), 0, -1, "WITHSCORES");
  const scoreMap = {}, orderedIds = [];
  for (let i = 0; i < totalIds.length; i += 2) {
    scoreMap[totalIds[i]] = parseInt(totalIds[i + 1]);
    orderedIds.push(totalIds[i]);
  }

  const matched = [];
  for (let i = 0; i < orderedIds.length; i += CHUNK) {
    const chunk = orderedIds.slice(i, i + CHUNK);
    const pipe  = redis.pipeline();
    chunk.forEach(id => pipe.hgetall(playerKey(id, mode)));
    const results = await pipe.exec();

    results.forEach(([, meta], idx) => {
      if (!meta || !meta.username) return;
      // Text search on username
      const textOk = !q || meta.username.toLowerCase().includes(q);
      // Hard filters
      const genreOk = !filterGenre || meta.genre === filterGenre;
      const tierOk  = !filterTier  || meta.tier  === filterTier;
      const engOk   = !filterEng   || meta.engagement === filterEng;

      if (textOk && genreOk && tierOk && engOk) {
        const id = chunk[idx];
        matched.push({ id, score: scoreMap[id], rank: orderedIds.indexOf(id) + 1, ...meta });
      }
    });
  }

  const total = matched.length;
  const page  = matched.slice(offset, offset + limit);
  return { data: page, total, offset, limit };
}

// ─── Server-side search across all players ────────────────────────────────────
async function searchPlayers(query, type = "global", mode = "custom", limit = 100, offset = 0) {
  const CHUNK = 500;
  const q = query.toLowerCase().trim();
  const matched = [];

  const totalIds = await redis.zrevrange(boardKey(type, mode), 0, -1, "WITHSCORES");
  const scoreMap = {};
  const orderedIds = [];
  for (let i = 0; i < totalIds.length; i += 2) {
    scoreMap[totalIds[i]] = parseInt(totalIds[i + 1]);
    orderedIds.push(totalIds[i]);
  }

  for (let i = 0; i < orderedIds.length; i += CHUNK) {
    const chunk = orderedIds.slice(i, i + CHUNK);
    const pipe = redis.pipeline();
    chunk.forEach(id => pipe.hgetall(playerKey(id, mode)));
    const results = await pipe.exec();

    results.forEach(([, meta], idx) => {
      if (!meta || !meta.username) return;
      const matchUser  = meta.username.toLowerCase().includes(q);
      const matchGenre = meta.genre  && meta.genre.toLowerCase().includes(q);
      const matchTier  = meta.tier   && meta.tier.toLowerCase().includes(q);
      const matchEng   = meta.engagement && meta.engagement.toLowerCase().includes(q);
      if (matchUser || matchGenre || matchTier || matchEng) {
        const id = chunk[idx];
        matched.push({ id, score: scoreMap[id], rank: orderedIds.indexOf(id) + 1, ...meta });
      }
    });
    if (matched.length >= 5000) break;
  }

  const total = matched.length;
  const page  = matched.slice(offset, offset + limit);
  return { data: page, total, offset, limit };
}

module.exports = {
  seedLeaderboards, seedDataset,
  getTopN, getTopNPaged, getBoardTotal, getPlayerRank, getNeighbors,
  addScore, setScore, checkAchievements,
  getAllPlayers, getBoardsSummary, getLiveStats,
  getDatasetStats, searchPlayers, searchPlayersFiltered, BOARDS,
};
