const { WebSocketServer } = require('ws');
const { registerPlayer, setOnline, setOffline, getOnlineCount } = require('../services/playerService');
const { initPlayerLeaderboards, processScoreUpdate, buildLeaderboardPayload } = require('../services/leaderboardService');
const { getPlayerAchievements } = require('../services/achievementService');
const { joinRoom, leaveRoom, incrementRoomScore, getRoomLeaderboard, getRoomRank, getRoomInfo } = require('../services/roomService');
const { recordNewPlayer } = require('../services/statsService');
const { getPlayer } = require('../services/playerService');
const { MAX_SCORE_INCREMENT } = require('../../config');

// playerId → { ws, roomId, continent, state }
const connections = new Map();

const send = (ws, obj) => {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
};

const broadcast = (obj) => {
  const payload = JSON.stringify(obj);
  for (const [, conn] of connections) {
    if (conn.ws.readyState === 1) conn.ws.send(payload);
  }
};

const broadcastToRoom = (roomId, obj) => {
  const payload = JSON.stringify(obj);
  for (const [, conn] of connections) {
    if (conn.roomId === roomId && conn.ws.readyState === 1) conn.ws.send(payload);
  }
};

/**
 * FIX 1 — Build the full payload once and broadcast to ALL clients.
 * The payload now contains continents:{} and states:{} maps.
 * Each client picks its own keys.
 */
const broadcastLeaderboards = async () => {
  const boards        = await buildLeaderboardPayload();
  const onlinePlayers = await getOnlineCount();
  broadcast({ type: 'leaderboard:update', timestamp: Date.now(), onlinePlayers, ...boards });
};

const broadcastRoomLeaderboard = async (roomId) => {
  const rawEntries = await getRoomLeaderboard(roomId, 10);
  const entries = await Promise.all(rawEntries.map(async ({ value, score }) => {
    const p = await getPlayer(value);
    return { id: value, username: p?.username || value, score: Math.round(Number(score)) };
  }));
  broadcastToRoom(roomId, { type: 'room:leaderboard', roomId, entries, timestamp: Date.now() });
};

const setup = (server) => {
  const wss = new WebSocketServer({ server });
  console.log('[WS] WebSocket server ready');

  wss.on('connection', (ws) => {
    let playerId = null;

    ws.on('message', async (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      switch (msg.type) {

        case 'player:join': {
          try {
            playerId = msg.playerId;
            const isNew = !(await getPlayer(playerId));
            const player = await registerPlayer({
              id:        msg.playerId,
              username:  msg.username  || `Player_${msg.playerId.slice(-4)}`,
              state:     msg.state     || 'XX',
              continent: msg.continent || 'World',
              avatar:    msg.avatar    || '',
            });
            await initPlayerLeaderboards(player);
            await setOnline(playerId);
            if (isNew) recordNewPlayer().catch(() => {});

            connections.set(playerId, { ws, roomId: null, continent: player.continent, state: player.state });
            console.log(`[WS] ${player.username} joined (${player.state}/${player.continent})`);

            const achievements = await getPlayerAchievements(playerId);
            send(ws, { type: 'joined', player, achievements });
            // Broadcast full payload to everyone so all boards refresh
            await broadcastLeaderboards();
          } catch (err) {
            console.error('[WS] join error:', err.message);
            send(ws, { type: 'error', message: err.message });
          }
          break;
        }

        case 'score:update': {
          if (!playerId) { send(ws, { type: 'error', message: 'Not authenticated' }); return; }
          const increment = Math.min(Math.max(1, Number(msg.increment) || 0), MAX_SCORE_INCREMENT);
          try {
            const { player, ranks, newAchievements } = await processScoreUpdate(playerId, increment);
            const conn = connections.get(playerId);
            if (conn) { conn.continent = player.continent; conn.state = player.state; }

            send(ws, { type: 'score:ack', newScore: player.totalScore, increment, ranks });

            if (newAchievements.length > 0) {
              send(ws, { type: 'achievement:unlocked', achievements: newAchievements, ranks });
              broadcast({ type: 'achievement:announcement', player: player.username, achievements: newAchievements });
            }

            const roomId = connections.get(playerId)?.roomId;
            if (roomId) {
              await incrementRoomScore(roomId, playerId, increment);
              await broadcastRoomLeaderboard(roomId);
            }

            await broadcastLeaderboards();
          } catch (err) {
            console.error('[WS] score error:', err.message);
            send(ws, { type: 'error', message: err.message });
          }
          break;
        }

        case 'room:join': {
          if (!playerId) return;
          try {
            const { roomId } = msg;
            const room = await getRoomInfo(roomId);
            if (!room) { send(ws, { type: 'error', message: `Room ${roomId} not found` }); return; }
            const player = await getPlayer(playerId);
            const conn   = connections.get(playerId);
            if (conn?.roomId) await leaveRoom(conn.roomId, playerId);
            await joinRoom(roomId, playerId, player?.totalScore || 0);
            if (conn) conn.roomId = roomId;
            send(ws, { type: 'room:joined', room });
            broadcastToRoom(roomId, { type: 'room:player_joined', playerId, username: player?.username });
            await broadcastRoomLeaderboard(roomId);
          } catch (err) {
            send(ws, { type: 'error', message: err.message });
          }
          break;
        }

        case 'room:leave': {
          if (!playerId) return;
          const conn = connections.get(playerId);
          if (conn?.roomId) {
            await leaveRoom(conn.roomId, playerId);
            const rid = conn.roomId;
            conn.roomId = null;
            send(ws, { type: 'room:left', roomId: rid });
            await broadcastRoomLeaderboard(rid);
          }
          break;
        }

        case 'ping':
          send(ws, { type: 'pong', timestamp: Date.now() });
          break;
      }
    });

    ws.on('close', async () => {
      if (playerId) {
        const conn = connections.get(playerId);
        if (conn?.roomId) await leaveRoom(conn.roomId, playerId).catch(() => {});
        connections.delete(playerId);
        await setOffline(playerId);
      }
    });

    ws.on('error', (err) => console.error('[WS] socket error:', err.message));
  });
};

module.exports = { setup, broadcast, broadcastLeaderboards };
