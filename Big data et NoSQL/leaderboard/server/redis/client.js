const { createClient } = require('redis');
const { REDIS_URL } = require('../../config');

const client = createClient({ url: REDIS_URL });

client.on('error', (err) => console.error('[Redis] Error:', err));
client.on('connect', () => console.log('[Redis] Connected to', REDIS_URL));
client.on('reconnecting', () => console.log('[Redis] Reconnecting...'));

const connect = async () => {
  await client.connect();
};

// Returns all leaderboard keys a player belongs to
const getLeaderboardKeys = (player) => [
  'leaderboard:world',
  `leaderboard:continent:${player.continent}`,
  `leaderboard:state:${player.state}`,
];

// Atomic pipeline: increment score in all 3 leaderboards at once
const incrementScore = async (player, increment) => {
  const pipeline = client.multi();
  for (const key of getLeaderboardKeys(player)) {
    pipeline.zIncrBy(key, increment, player.id);
  }
  const results = await pipeline.exec();
  return results;
};

// Top N players from a leaderboard scope
const getTopPlayers = async (scope, scopeValue, count = 10) => {
  const key = scope === 'world'
    ? 'leaderboard:world'
    : `leaderboard:${scope}:${scopeValue}`;
  return client.zRangeWithScores(key, 0, count - 1, { REV: true });
};

// Rank of a player across all 3 scopes (0-based from Redis, we add +1 for display)
const getPlayerRank = async (player) => {
  const [world, continent, state] = await Promise.all([
    client.zRevRank('leaderboard:world', player.id),
    client.zRevRank(`leaderboard:continent:${player.continent}`, player.id),
    client.zRevRank(`leaderboard:state:${player.state}`, player.id),
  ]);
  return {
    world:     world     != null ? world + 1     : null,
    continent: continent != null ? continent + 1 : null,
    state:     state     != null ? state + 1     : null,
  };
};

// Neighbors: players just above/below a given player
const getRankNeighbors = async (player, scope = 'world', window = 2) => {
  const key = scope === 'world'
    ? 'leaderboard:world'
    : `leaderboard:${scope}:${player[scope]}`;
  const rank = await client.zRevRank(key, player.id);
  if (rank == null) return [];
  const start = Math.max(0, rank - window);
  const end   = rank + window;
  return client.zRangeWithScores(key, start, end, { REV: true });
};

module.exports = { client, connect, getLeaderboardKeys, incrementScore, getTopPlayers, getPlayerRank, getRankNeighbors };
