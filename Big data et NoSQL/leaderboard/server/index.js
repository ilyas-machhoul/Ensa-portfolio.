const http    = require('http');
const express = require('express');
const path    = require('path');
const { connect } = require('./redis/client');
const { setup: setupWS } = require('./websocket/wsManager');
const {
  createPlayer, listPlayers, getPlayerById,
  editPlayer, removePlayer, updateScore,
  getLeaderboard, getNeighbors,
} = require('./controllers/playerController');
const { getHistory }     = require('./controllers/historyController');
const { getServerStats, getGlobalFeed, getTopAll, getRooms, postRoom } = require('./controllers/adminController');
const { init: initStats } = require('./services/statsService');
const { PORT } = require('../config');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

// Player REST
app.post  ('/api/players',               createPlayer);
app.get   ('/api/players',               listPlayers);
app.get   ('/api/players/:id',           getPlayerById);
app.put   ('/api/players/:id',           editPlayer);
app.delete('/api/players/:id',           removePlayer);
app.post  ('/api/players/:id/score',     updateScore);
app.get   ('/api/players/:id/neighbors', getNeighbors);
app.get   ('/api/players/:id/history',   getHistory);
app.get   ('/api/leaderboard',           getLeaderboard);

// Admin REST
app.get ('/api/admin/stats', getServerStats);
app.get ('/api/admin/feed',  getGlobalFeed);
app.get ('/api/admin/top',   getTopAll);
app.get ('/api/admin/rooms', getRooms);
app.post('/api/admin/rooms', postRoom);

// Health
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: Date.now() }));

// SPA fallback
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../client/index.html')));

const server = http.createServer(app);
setupWS(server);

const start = async () => {
  try {
    await connect();
    await initStats();
    server.listen(PORT, () => {
      console.log(`\n  LeaderBoard  → http://localhost:${PORT}`);
      console.log(`  Admin        → http://localhost:${PORT}/admin.html\n`);
    });
  } catch (err) {
    console.error('Startup failed:', err.message);
    process.exit(1);
  }
};

start();
