/**
 * statsService.js
 * Lightweight server statistics using Redis counters and hashes.
 *
 * Redis keys:
 *   stats:global       HASH  — { totalEvents, totalPlayers, peakOnline, startedAt }
 *   stats:hourly:{HH}  HASH  — { events, uniquePlayers } — rolling 24-h buckets
 */
const { client } = require('../redis/client');

const init = async () => {
  const exists = await client.hExists('stats:global', 'startedAt');
  if (!exists) {
    await client.hSet('stats:global', {
      totalEvents:  '0',
      totalPlayers: '0',
      peakOnline:   '0',
      startedAt:    Date.now().toString(),
    });
  }
};

const recordScoreEvent = async (onlineNow) => {
  const hour = new Date().getHours().toString().padStart(2, '0');
  const pipeline = client.multi();
  pipeline.hIncrBy('stats:global', 'totalEvents', 1);
  pipeline.hIncrBy(`stats:hourly:${hour}`, 'events', 1);

  // Update peak online
  pipeline.hGet('stats:global', 'peakOnline');
  const results = await pipeline.exec();
  const peak = Number(results[2]) || 0;
  if (onlineNow > peak) await client.hSet('stats:global', 'peakOnline', String(onlineNow));
};

const recordNewPlayer = async () => {
  await client.hIncrBy('stats:global', 'totalPlayers', 1);
};

const getStats = async () => {
  const global = await client.hGetAll('stats:global');
  const hours  = await Promise.all(
    Array.from({ length: 24 }, (_, i) => {
      const h = String(i).padStart(2, '0');
      return client.hGetAll(`stats:hourly:${h}`).then(d => ({ hour: h, events: Number(d?.events || 0) }));
    })
  );
  return {
    totalEvents:  Number(global.totalEvents  || 0),
    totalPlayers: Number(global.totalPlayers || 0),
    peakOnline:   Number(global.peakOnline   || 0),
    startedAt:    Number(global.startedAt    || 0),
    hourly: hours,
  };
};

module.exports = { init, recordScoreEvent, recordNewPlayer, getStats };
