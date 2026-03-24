/**
 * adminController.js
 * REST endpoints for the admin dashboard.
 * No auth in this mini-project — add middleware in production.
 */
const { getGlobalHistory } = require('../services/historyService');
const { listRooms, createRoom } = require('../services/roomService');
const { getStats } = require('../services/statsService');
const { getOnlineCount } = require('../services/playerService');
const { getTopPlayers } = require('../redis/client');
const { getPlayer } = require('../services/playerService');

// GET /api/admin/stats
const getServerStats = async (req, res) => {
  try {
    const [stats, online] = await Promise.all([getStats(), getOnlineCount()]);
    res.json({ ...stats, onlineNow: online });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/admin/feed?count=50
const getGlobalFeed = async (req, res) => {
  try {
    const count = Math.min(Number(req.query.count) || 50, 200);
    const events = await getGlobalHistory(count);
    res.json({ events });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/admin/top?count=20
const getTopAll = async (req, res) => {
  try {
    const count = Math.min(Number(req.query.count) || 20, 100);
    const raw   = await getTopPlayers('world', null, count);
    const players = await Promise.all(
      raw.map(async ({ value, score }) => {
        const p = await getPlayer(value);
        return { id: value, username: p?.username || value, state: p?.state || '', continent: p?.continent || '', score: Math.round(Number(score)) };
      })
    );
    res.json({ players });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/admin/rooms
const getRooms = async (req, res) => {
  try {
    const rooms = await listRooms();
    res.json({ rooms });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/admin/rooms  { id, name }
const postRoom = async (req, res) => {
  try {
    const { id, name } = req.body;
    if (!id || !name) return res.status(400).json({ error: 'id and name required' });
    const room = await createRoom(id, name);
    res.status(201).json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getServerStats, getGlobalFeed, getTopAll, getRooms, postRoom };
