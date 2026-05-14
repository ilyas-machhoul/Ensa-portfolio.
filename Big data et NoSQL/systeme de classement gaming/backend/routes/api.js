const express = require("express");
const router  = express.Router();
const lb      = require("../services/leaderboard");
const sim     = require("../services/simulator");
const redis   = require("../services/redis-client");
const { ACHIEVEMENTS } = require("../services/achievements");

// helper to get mode from query (default: custom)
const getMode = (req) => req.query.mode === "dataset" ? "dataset" : "custom";

// GET /api/leaderboard/:type?mode=custom|dataset&limit=100&page=0
router.get("/leaderboard/:type", async (req, res) => {
  try {
    const mode  = getMode(req);
    const limit = Math.min(parseInt(req.query.limit) || (mode === "dataset" ? 100 : 30), 200);
    const page  = Math.max(0, parseInt(req.query.page) || 0);
    const offset = page * limit;
    const data  = await lb.getTopNPaged(req.params.type, limit, mode, offset);
    const total = await lb.getBoardTotal(req.params.type, mode);
    res.json({ ok: true, type: req.params.type, mode, data, total, page, limit, hasMore: offset + limit < total });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// GET /api/neighbors/:id?board=global&mode=custom&radius=4
router.get("/neighbors/:id", async (req, res) => {
  try {
    const mode   = getMode(req);
    const board  = req.query.board || "global";
    const radius = parseInt(req.query.radius) || 4;
    const data   = await lb.getNeighbors(req.params.id, board, mode, radius);
    res.json({ ok: true, data });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// GET /api/players?mode=custom|dataset&limit=100
router.get("/players", async (req, res) => {
  try {
    const mode  = getMode(req);
    const limit = Math.min(parseInt(req.query.limit) || 100, 5000);
    const data  = await lb.getAllPlayers(mode, limit);
    res.json({ ok: true, mode, data });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/score/add  { playerId, delta, board, mode }
router.post("/score/add", async (req, res) => {
  try {
    const { playerId, delta, board = "global", mode = "custom" } = req.body;
    if (!playerId || !delta) return res.status(400).json({ ok: false, error: "Missing fields" });

    const oldRankRaw = await redis.zrevrank(`${mode === "dataset" ? "ds:" : ""}lb:${board}`, playerId);
    const oldRank = oldRankRaw !== null ? oldRankRaw + 1 : null;

    const result   = await lb.addScore(playerId, parseInt(delta), board, mode);
    const unlocked = await lb.checkAchievements(playerId, board, mode);

    const broadcast = req.app.get("broadcast");
    if (broadcast) {
      const meta = await redis.hgetall(`${mode === "dataset" ? "ds:" : ""}player:${playerId}`);
      broadcast({ type: "SCORE_UPDATE", payload: { playerId, username: meta.username, avatar: meta.avatar, delta: parseInt(delta), ...result, board, mode, source: "manual", oldRank } });
      for (const ach of unlocked) {
        broadcast({ type: "ACHIEVEMENT_UNLOCKED", payload: { playerId, username: meta.username, avatar: meta.avatar, achievement: ach, mode } });
      }
      if (oldRank && oldRank !== result.newRank) {
        broadcast({ type: "RANK_CHANGE", payload: { playerId, username: meta.username, avatar: meta.avatar, oldRank, newRank: result.newRank, mode } });
      }
    }
    res.json({ ok: true, ...result, newAchievements: unlocked });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/score/set  { playerId, score, board, mode }
router.post("/score/set", async (req, res) => {
  try {
    const { playerId, score, board = "global", mode = "custom" } = req.body;
    if (!playerId || score === undefined) return res.status(400).json({ ok: false, error: "Missing fields" });

    const result   = await lb.setScore(playerId, parseInt(score), board, mode);
    const unlocked = await lb.checkAchievements(playerId, board, mode);

    const broadcast = req.app.get("broadcast");
    if (broadcast) {
      const meta = await redis.hgetall(`${mode === "dataset" ? "ds:" : ""}player:${playerId}`);
      broadcast({ type: "SCORE_UPDATE", payload: { playerId, username: meta.username, avatar: meta.avatar, delta: null, ...result, board, mode, source: "manual-set" } });
    }
    res.json({ ok: true, ...result, newAchievements: unlocked });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// GET /api/stats?mode=custom|dataset
router.get("/stats", async (req, res) => {
  try {
    const mode = getMode(req);
    const [summary, live] = await Promise.all([lb.getBoardsSummary(mode), lb.getLiveStats(mode)]);
    res.json({ ok: true, summary, live, simulation: sim.getStatus() });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// GET /api/dataset/stats  (genre/loc/tier distribution)
router.get("/dataset/stats", async (req, res) => {
  try {
    const data = await lb.getDatasetStats();
    res.json({ ok: true, data });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// GET /api/search?q=...&mode=dataset&board=global&limit=100&page=0&genre=&tier=&engagement=
router.get("/search", async (req, res) => {
  try {
    const q          = (req.query.q || "").trim();
    const mode       = getMode(req);
    const board      = req.query.board || "global";
    const limit      = Math.min(parseInt(req.query.limit) || 100, 200);
    const page       = Math.max(0, parseInt(req.query.page) || 0);
    const offset     = page * limit;
    const filterGenre = req.query.genre || "";
    const filterTier  = req.query.tier  || "";
    const filterEng   = req.query.engagement || "";

    const hasFilters = q || filterGenre || filterTier || filterEng;

    if (!hasFilters) {
      // No filters → fast paginated list
      const total = await lb.getBoardTotal(board, mode);
      const data  = await lb.getTopNPaged(board, limit, mode, offset);
      return res.json({ ok: true, data, total, page, limit, hasMore: offset + limit < total, query: "" });
    }

    // Build compound query string for searchPlayers
    const compoundQ = [q, filterGenre, filterTier, filterEng].filter(Boolean).join(" ");
    const result = await lb.searchPlayersFiltered(q, board, mode, limit, offset, { filterGenre, filterTier, filterEng });
    res.json({ ok: true, ...result, page, query: q, hasMore: result.offset + result.limit < result.total });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});


router.get("/achievements", async (req, res) => {
  res.json({ ok: true, data: ACHIEVEMENTS.map(a => ({ id: a.id, name: a.name, icon: a.icon, desc: a.desc })) });
});

// POST /api/simulation/start  { speed, mode }
router.post("/simulation/start", async (req, res) => {
  try {
    const speed     = parseInt(req.body.speed) || 3000;
    const simMode   = req.body.mode || "custom";
    const simBoard  = req.body.board || "global";
    const broadcast = req.app.get("broadcast");
    if (sim.getStatus().isRunning) sim.stopSimulation();
    sim.startSimulation(broadcast, speed, simMode, simBoard);
    broadcast && broadcast({ type: "SIM_STATUS", payload: { isRunning: true, speed, mode: simMode, board: simBoard } });
    res.json({ ok: true, message: "Simulation started", speed });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/simulation/stop
router.post("/simulation/stop", async (req, res) => {
  try {
    sim.stopSimulation();
    const broadcast = req.app.get("broadcast");
    broadcast && broadcast({ type: "SIM_STATUS", payload: { isRunning: false } });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/reset?mode=custom|dataset
router.post("/reset", async (req, res) => {
  try {
    const mode = getMode(req);
    if (mode === "dataset") {
      const players = require("../data/dataset_players.json");
      await lb.seedDataset(players);
    } else {
      const players = require("../data/players.json");
      await lb.seedLeaderboards(players);
    }
    res.json({ ok: true, message: `${mode} leaderboards reset` });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

module.exports = router;
