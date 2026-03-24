const { client, getLeaderboardKeys, getPlayerRank } = require('../redis/client');
const { getPlayer, updateTotalScore, getOnlineCount } = require('./playerService');
const { checkAchievements } = require('./achievementService');
const { recordEvent } = require('./historyService');
const { recordScoreEvent } = require('./statsService');

const THRESHOLDS = {
  world:     1000,
  continent:  750,
  state:        0,
};

const initPlayerLeaderboards = async (player) => {
  const pipeline = client.multi();
  for (const key of getLeaderboardKeys(player)) {
    pipeline.zAdd(key, { score: 0, value: player.id });
  }
  await pipeline.exec();
};

const processScoreUpdate = async (playerId, increment) => {
  const player = await getPlayer(playerId);
  if (!player) throw new Error(`Player ${playerId} not found`);

  const pipeline = client.multi();
  for (const key of getLeaderboardKeys(player)) {
    pipeline.zIncrBy(key, increment, playerId);
  }
  const results = await pipeline.exec();
  const newScore = Number(results[0]);

  await updateTotalScore(playerId, newScore);
  player.totalScore = newScore;

  const ranks       = await getPlayerRank(player);
  const newAch      = await checkAchievements(playerId, ranks, player);
  const online      = await getOnlineCount();
  recordEvent(player, increment, newScore, ranks).catch(() => {});
  recordScoreEvent(online).catch(() => {});

  return { player: { ...player, totalScore: newScore }, ranks, newAchievements: newAch };
};

/**
 * FIX: use zRangeWithScores REV + filter client-side.
 * zRangeByScoreWithScores with REV+LIMIT is unreliable across redis@4 versions.
 * We fetch top N*3 by rank (guaranteed correct order), then filter by minScore.
 * For leaderboards ≤ a few thousand players this is perfectly fine.
 */
const getTopWithThreshold = async (key, minScore, count = 10) => {
  // Fetch more than needed so filtering doesn't leave us short
  const raw = await client.zRangeWithScores(key, 0, count * 5 - 1, { REV: true });
  const filtered = minScore > 0
    ? raw.filter(e => Number(e.score) >= minScore)
    : raw;
  return filtered.slice(0, count);
};

const enrichEntries = async (entries) =>
  Promise.all(entries.map(async ({ value, score }) => {
    const p = await getPlayer(value);
    return {
      id:        value,
      username:  p?.username  || value,
      avatar:    p?.avatar    || '',
      state:     p?.state     || '',
      continent: p?.continent || '',
      score:     Math.round(Number(score)),
    };
  }));

/**
 * Build full payload: world + all continent sub-lists + all state sub-lists.
 * Broadcast once to all clients; each client picks its own keys.
 */
const buildLeaderboardPayload = async () => {
  // 1. World
  const worldRaw = await getTopWithThreshold('leaderboard:world', THRESHOLDS.world, 10);
  const world    = await enrichEntries(worldRaw);

  // 2. All continent keys
  const contKeys  = await client.keys('leaderboard:continent:*');
  const contNames = contKeys.map(k => k.replace('leaderboard:continent:', ''));

  // 3. All state keys
  const stateKeys  = await client.keys('leaderboard:state:*');
  const stateNames = stateKeys.map(k => k.replace('leaderboard:state:', ''));

  // 4. Continent boards in parallel
  const continents = {};
  await Promise.all(contNames.map(async (cont) => {
    const raw = await getTopWithThreshold(`leaderboard:continent:${cont}`, THRESHOLDS.continent, 10);
    continents[cont] = await enrichEntries(raw);
  }));

  // 5. State boards in parallel
  const states = {};
  await Promise.all(stateNames.map(async (state) => {
    const raw = await getTopWithThreshold(`leaderboard:state:${state}`, THRESHOLDS.state, 10);
    states[state] = await enrichEntries(raw);
  }));

  return { world, continents, states, thresholds: THRESHOLDS };
};

// REST endpoint backward-compat
const buildLeaderboardPayloadForPlayer = async (continent, state) => {
  const full = await buildLeaderboardPayload();
  return {
    world:      full.world,
    continent:  full.continents[continent] || [],
    state:      full.states[state]         || [],
    continents: full.continents,
    states:     full.states,
    thresholds: full.thresholds,
  };
};

module.exports = {
  initPlayerLeaderboards,
  processScoreUpdate,
  buildLeaderboardPayload,
  buildLeaderboardPayloadForPlayer,
  THRESHOLDS,
};
