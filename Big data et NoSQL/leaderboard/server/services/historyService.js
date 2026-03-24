/**
 * historyService.js
 * Stores the last N score events per player using a Redis List.
 * Also maintains a global event stream (LPUSH history:global) for the admin dashboard.
 *
 * Redis keys:
 *   history:player:{id}   LIST  — last 50 events for one player
 *   history:global        LIST  — last 200 events across all players
 */
const { client } = require('../redis/client');

const PLAYER_HISTORY_MAX = 50;
const GLOBAL_HISTORY_MAX = 200;

/**
 * Record a score event.
 * @param {object} player  — { id, username, state, continent }
 * @param {number} increment
 * @param {number} newScore
 * @param {object} ranks   — { world, continent, state }
 */
const recordEvent = async (player, increment, newScore, ranks) => {
  const event = JSON.stringify({
    playerId:  player.id,
    username:  player.username,
    state:     player.state,
    continent: player.continent,
    increment,
    newScore,
    ranks,
    ts: Date.now(),
  });

  const pipeline = client.multi();

  // Per-player history (capped list)
  pipeline.lPush(`history:player:${player.id}`, event);
  pipeline.lTrim(`history:player:${player.id}`, 0, PLAYER_HISTORY_MAX - 1);

  // Global event stream
  pipeline.lPush('history:global', event);
  pipeline.lTrim('history:global', 0, GLOBAL_HISTORY_MAX - 1);

  await pipeline.exec();
};

/** Last N events for a specific player */
const getPlayerHistory = async (playerId, count = 20) => {
  const raw = await client.lRange(`history:player:${playerId}`, 0, count - 1);
  return raw.map(r => JSON.parse(r));
};

/** Last N global events (for admin feed) */
const getGlobalHistory = async (count = 50) => {
  const raw = await client.lRange('history:global', 0, count - 1);
  return raw.map(r => JSON.parse(r));
};

module.exports = { recordEvent, getPlayerHistory, getGlobalHistory };
