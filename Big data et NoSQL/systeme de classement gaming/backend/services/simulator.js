const lb = require("./leaderboard");
const redis = require("./redis-client");

let simulationInterval = null;
let isRunning = false;
let speed = 3000;
let currentMode = "custom";
let currentBoard = "global";

async function simulationTick(broadcast) {
  try {
    // Pass currentBoard so all players on that board are eligible (no rank cap)
    const all   = await lb.getAllPlayers(currentMode, 9999, currentBoard);
    if (!all.length) return;

    const count  = 2 + Math.floor(Math.random() * 3);
    const chosen = all.sort(() => Math.random() - 0.5).slice(0, count);

    for (const player of chosen) {
      const delta = 50 + Math.floor(Math.random() * 950);
      const board = currentBoard;

      const prefixStr = currentMode === "dataset" ? "ds:" : "";
      const oldRankRaw = await redis.zrevrank(`${prefixStr}lb:${board}`, player.id);
      const oldRank = oldRankRaw !== null ? oldRankRaw + 1 : null;

      const { newScore, newRank } = await lb.addScore(player.id, delta, board, currentMode);
      const unlocked = await lb.checkAchievements(player.id, board, currentMode);

      broadcast({ type: "SCORE_UPDATE", payload: {
        playerId: player.id, username: player.username, avatar: player.avatar,
        delta, newScore, newRank, oldRank, board, mode: currentMode, source: "auto"
      }});

      for (const ach of unlocked) {
        broadcast({ type: "ACHIEVEMENT_UNLOCKED", payload: {
          playerId: player.id, username: player.username, avatar: player.avatar,
          achievement: ach, mode: currentMode
        }});
      }

      if (oldRank && Math.abs(oldRank - newRank) >= 2) {
        broadcast({ type: "RANK_CHANGE", payload: {
          playerId: player.id, username: player.username, avatar: player.avatar,
          oldRank, newRank, mode: currentMode
        }});
      }
    }
  } catch (err) { console.error("Simulation error:", err.message); }
}

function startSimulation(broadcast, intervalMs, mode, board) {
  if (isRunning) stopSimulation();
  speed       = Math.max(500, intervalMs || speed);
  currentMode = mode || currentMode;
  currentBoard = board || "global";
  isRunning   = true;
  simulationInterval = setInterval(() => simulationTick(broadcast), speed);
  console.log(`🤖 Simulation started [${currentMode}] board=[${currentBoard}] every ${speed}ms`);
  return true;
}

function stopSimulation() {
  if (!isRunning) return false;
  clearInterval(simulationInterval);
  isRunning = false;
  return true;
}

function getStatus() { return { isRunning, speed, mode: currentMode, board: currentBoard }; }

module.exports = { startSimulation, stopSimulation, getStatus };
