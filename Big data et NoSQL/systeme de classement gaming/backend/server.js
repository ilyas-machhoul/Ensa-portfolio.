const express   = require("express");
const http      = require("http");
const WebSocket = require("ws");
const cors      = require("cors");
const path      = require("path");
const lb        = require("./services/leaderboard");
const apiRoutes = require("./routes/api");

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  const customPlayers  = require("./data/players.json");
  const datasetPlayers = require("./data/dataset_players.json");

  console.log("🎮 Seeding leaderboards...");
  await lb.seedLeaderboards(customPlayers);
  await lb.seedDataset(datasetPlayers);

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "../public")));
  app.use("/api", apiRoutes);

  const server = http.createServer(app);
  const wss    = new WebSocket.Server({ server });

  function broadcast(msg) {
    const raw = JSON.stringify(msg);
    wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(raw); });
  }
  app.set("broadcast", broadcast);

  wss.on("connection", (ws) => {
    console.log(`🔌 Client connected (total: ${wss.clients.size})`);
    lb.getTopN("global", 30, "custom").then(data => {
      ws.send(JSON.stringify({ type: "INIT", payload: { leaderboard: data, mode: "custom" } }));
    });
    ws.on("close", () => broadcast({ type: "ONLINE_COUNT", payload: { count: wss.clients.size } }));
    broadcast({ type: "ONLINE_COUNT", payload: { count: wss.clients.size } });
  });

  app.get("*", (req, res) => res.sendFile(path.join(__dirname, "../public/index.html")));

  server.listen(PORT, () => {
    console.log(`\n🚀 Server: http://localhost:${PORT}`);
    console.log(`📡 WebSocket ready\n`);
  });
}

bootstrap().catch(err => { console.error("❌", err.message); process.exit(1); });
