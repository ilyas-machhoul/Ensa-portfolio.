const { registerPlayer, getPlayer, getAllPlayers, updatePlayer, deletePlayer, adminSetScore, adminAddScore, getOnlineCount } = require('../services/playerService');
const { initPlayerLeaderboards, buildLeaderboardPayloadForPlayer, THRESHOLDS } = require('../services/leaderboardService');
const { getPlayerAchievements } = require('../services/achievementService');
const { getPlayerRank, getRankNeighbors } = require('../redis/client');
const { getPlayerHistory } = require('../services/historyService');
const { broadcastLeaderboards } = require('../websocket/wsManager');

// POST /api/players
const createPlayer = async (req, res) => {
  try {
    const { id, username, state, continent, avatar } = req.body;
    if (!id || !username || !state || !continent)
      return res.status(400).json({ error: 'id, username, state, continent are required' });
    const player = await registerPlayer({ id, username, state, continent, avatar });
    await initPlayerLeaderboards(player);
    res.status(201).json(player);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// GET /api/players
const listPlayers = async (req, res) => {
  try {
    const players = await getAllPlayers();
    res.json({ players });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// GET /api/players/:id
const getPlayerById = async (req, res) => {
  try {
    const player = await getPlayer(req.params.id);
    if (!player) return res.status(404).json({ error: 'Player not found' });
    const [ranks, achievements, history] = await Promise.all([
      getPlayerRank(player),
      getPlayerAchievements(player.id),
      getPlayerHistory(player.id, 20),
    ]);
    const score = Number(player.totalScore || 0);
    const progress = {
      world:     { score, needed: THRESHOLDS.world,     unlocked: score >= THRESHOLDS.world,     pct: Math.min(100, Math.round(score/THRESHOLDS.world*100)),     missing: Math.max(0, THRESHOLDS.world-score) },
      continent: { score, needed: THRESHOLDS.continent, unlocked: score >= THRESHOLDS.continent, pct: Math.min(100, Math.round(score/THRESHOLDS.continent*100)), missing: Math.max(0, THRESHOLDS.continent-score) },
    };
    res.json({ player: { ...player, totalScore: score }, ranks, achievements, history, progress });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// PUT /api/players/:id
const editPlayer = async (req, res) => {
  try {
    const { username, state, continent, avatar } = req.body;
    const player = await updatePlayer(req.params.id, { username, state, continent, avatar });
    if (!player) return res.status(404).json({ error: 'Player not found' });
    await broadcastLeaderboards();
    res.json(player);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// DELETE /api/players/:id
const removePlayer = async (req, res) => {
  try {
    await deletePlayer(req.params.id);
    await broadcastLeaderboards();
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// POST /api/players/:id/score  — { mode: 'set'|'add', value: number }
const updateScore = async (req, res) => {
  try {
    const { mode, value } = req.body;
    if (!['set', 'add'].includes(mode) || typeof value !== 'number')
      return res.status(400).json({ error: 'mode (set|add) and numeric value required' });
    const player = mode === 'set'
      ? await adminSetScore(req.params.id, value)
      : await adminAddScore(req.params.id, value);
    if (!player) return res.status(404).json({ error: 'Player not found' });
    await broadcastLeaderboards();
    res.json(player);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// GET /api/leaderboard
const getLeaderboard = async (req, res) => {
  try {
    const { continent, state } = req.query;
    const boards = await buildLeaderboardPayloadForPlayer(continent, state);
    const onlinePlayers = await getOnlineCount();
    res.json({ ...boards, onlinePlayers });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// GET /api/players/:id/neighbors
const getNeighbors = async (req, res) => {
  try {
    const player = await getPlayer(req.params.id);
    if (!player) return res.status(404).json({ error: 'Player not found' });
    const neighbors = await getRankNeighbors(player, req.query.scope || 'world');
    res.json({ neighbors });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

module.exports = { createPlayer, listPlayers, getPlayerById, editPlayer, removePlayer, updateScore, getLeaderboard, getNeighbors };
