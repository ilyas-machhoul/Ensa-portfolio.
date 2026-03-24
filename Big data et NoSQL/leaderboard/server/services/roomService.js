/**
 * roomService.js
 * Game rooms give players an isolated, named leaderboard context.
 *
 * Redis keys:
 *   room:{roomId}            HASH  — { id, name, createdAt, playerCount }
 *   room:{roomId}:players    SET   — player IDs in this room
 *   leaderboard:room:{roomId} ZSET — room-scoped scores
 *   rooms:active             SET   — all active room IDs
 */
const { client } = require('../redis/client');

const createRoom = async (roomId, name) => {
  const exists = await client.exists(`room:${roomId}`);
  if (exists) return getRoomInfo(roomId);

  const room = { id: roomId, name, createdAt: Date.now().toString(), playerCount: '0' };
  await client.hSet(`room:${roomId}`, room);
  await client.sAdd('rooms:active', roomId);
  return room;
};

const getRoomInfo = async (roomId) => {
  const r = await client.hGetAll(`room:${roomId}`);
  if (!r || !r.id) return null;
  return { ...r, playerCount: Number(r.playerCount) };
};

const listRooms = async () => {
  const ids = await client.sMembers('rooms:active');
  if (!ids.length) return [];
  return Promise.all(ids.map(getRoomInfo)).then(rs => rs.filter(Boolean));
};

const joinRoom = async (roomId, playerId, currentScore = 0) => {
  await client.sAdd(`room:${roomId}:players`, playerId);
  await client.zAdd(`leaderboard:room:${roomId}`, { score: currentScore, value: playerId });
  const count = await client.sCard(`room:${roomId}:players`);
  await client.hSet(`room:${roomId}`, 'playerCount', String(count));
};

const leaveRoom = async (roomId, playerId) => {
  await client.sRem(`room:${roomId}:players`, playerId);
  await client.zRem(`leaderboard:room:${roomId}`, playerId);
  const count = await client.sCard(`room:${roomId}:players`);
  await client.hSet(`room:${roomId}`, 'playerCount', String(count));
};

const incrementRoomScore = async (roomId, playerId, increment) => {
  return client.zIncrBy(`leaderboard:room:${roomId}`, increment, playerId);
};

const getRoomLeaderboard = async (roomId, count = 10) => {
  return client.zRangeWithScores(`leaderboard:room:${roomId}`, 0, count - 1, { REV: true });
};

const getRoomRank = async (roomId, playerId) => {
  const rank = await client.zRevRank(`leaderboard:room:${roomId}`, playerId);
  return rank != null ? rank + 1 : null;
};

module.exports = {
  createRoom, getRoomInfo, listRooms,
  joinRoom, leaveRoom,
  incrementRoomScore, getRoomLeaderboard, getRoomRank,
};
