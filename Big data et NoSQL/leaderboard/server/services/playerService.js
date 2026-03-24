/**
 * playerService.js — Redis only, no PostgreSQL
 */
const { client } = require('../redis/client');

const registerPlayer = async ({ id, username, state, continent, avatar }) => {
  const existing = await client.hGetAll(`player:${id}`);
  if (existing && existing.id) return existing;
  const player = { id, username, state, continent, avatar: avatar || '', totalScore: '0', createdAt: Date.now().toString() };
  await client.hSet(`player:${id}`, player);
  return player;
};

const getPlayer = async (id) => {
  const p = await client.hGetAll(`player:${id}`);
  if (!p || !p.id) return null;
  return { ...p, totalScore: Number(p.totalScore) };
};

const getAllPlayers = async () => {
  const keys = await client.keys('player:*');
  if (!keys.length) return [];
  const players = await Promise.all(keys.map(k => client.hGetAll(k)));
  return players
    .filter(p => p && p.id)
    .map(p => ({ ...p, totalScore: Number(p.totalScore || 0) }))
    .sort((a, b) => b.totalScore - a.totalScore);
};

// Update profile fields: username, state, continent
const updatePlayer = async (id, { username, state, continent, avatar }) => {
  const player = await getPlayer(id);
  if (!player) throw new Error('Player not found');

  const oldState     = player.state;
  const oldContinent = player.continent;

  // Update hash fields
  if (username  !== undefined) await client.hSet(`player:${id}`, 'username',  username);
  if (avatar    !== undefined) await client.hSet(`player:${id}`, 'avatar',    avatar);

  // If state changed → migrate ZSET membership
  if (state && state !== oldState) {
    const score = player.totalScore;
    await client.zRem(`leaderboard:state:${oldState}`, id);
    await client.zAdd(`leaderboard:state:${state}`, { score, value: id });
    await client.hSet(`player:${id}`, 'state', state);
  }

  // If continent changed → migrate ZSET membership
  if (continent && continent !== oldContinent) {
    const score = player.totalScore;
    await client.zRem(`leaderboard:continent:${oldContinent}`, id);
    await client.zAdd(`leaderboard:continent:${continent}`, { score, value: id });
    await client.hSet(`player:${id}`, 'continent', continent);
  }

  return getPlayer(id);
};

const updateTotalScore = async (id, newScore) => {
  await client.hSet(`player:${id}`, 'totalScore', String(newScore));
};

// Admin: set score to exact value
const adminSetScore = async (id, newScore) => {
  const player = await getPlayer(id);
  if (!player) throw new Error('Player not found');
  const score = Math.max(0, Number(newScore));

  await client.hSet(`player:${id}`, 'totalScore', String(score));

  const pipeline = client.multi();
  pipeline.zAdd('leaderboard:world',                         { score, value: id });
  pipeline.zAdd(`leaderboard:continent:${player.continent}`, { score, value: id });
  pipeline.zAdd(`leaderboard:state:${player.state}`,         { score, value: id });
  await pipeline.exec();

  return getPlayer(id);
};

// Admin: add or subtract points
const adminAddScore = async (id, increment) => {
  const player = await getPlayer(id);
  if (!player) throw new Error('Player not found');

  const newScore = Math.max(0, player.totalScore + Number(increment));
  await client.hSet(`player:${id}`, 'totalScore', String(newScore));

  const pipeline = client.multi();
  pipeline.zIncrBy('leaderboard:world',                         Number(increment), id);
  pipeline.zIncrBy(`leaderboard:continent:${player.continent}`, Number(increment), id);
  pipeline.zIncrBy(`leaderboard:state:${player.state}`,         Number(increment), id);
  await pipeline.exec();

  return getPlayer(id);
};

// Delete player from all Redis keys
const deletePlayer = async (id) => {
  const player = await getPlayer(id);
  if (!player) throw new Error('Player not found');

  const pipeline = client.multi();
  pipeline.zRem('leaderboard:world', id);
  pipeline.zRem(`leaderboard:continent:${player.continent}`, id);
  pipeline.zRem(`leaderboard:state:${player.state}`, id);
  pipeline.del(`player:${id}`);
  pipeline.sRem('online:players', id);
  pipeline.del(`achievements:${id}`);
  pipeline.del(`history:player:${id}`);
  await pipeline.exec();

  return true;
};

const setOnline    = async (id) => client.sAdd('online:players', id);
const setOffline   = async (id) => client.sRem('online:players', id);
const getOnlineCount = async () => client.sCard('online:players');
const isOnline     = async (id) => client.sIsMember('online:players', id);

module.exports = {
  registerPlayer, getPlayer, getAllPlayers,
  updatePlayer, updateTotalScore,
  adminSetScore, adminAddScore, deletePlayer,
  setOnline, setOffline, getOnlineCount, isOnline,
};
