const ACHIEVEMENTS = [
  { id: "first_blood",    name: "First Blood",      icon: "🩸", desc: "Score your first point",        condition: s => s >= 1 },
  { id: "rookie",         name: "Rookie",           icon: "🎮", desc: "Reach 10,000 points",           condition: s => s >= 10000 },
  { id: "warrior",        name: "Warrior",          icon: "⚔️", desc: "Reach 25,000 points",           condition: s => s >= 25000 },
  { id: "veteran",        name: "Veteran",          icon: "🎖️", desc: "Reach 50,000 points",           condition: s => s >= 50000 },
  { id: "champion",       name: "Champion",         icon: "🏆", desc: "Reach 75,000 points",           condition: s => s >= 75000 },
  { id: "legend",         name: "Legend",           icon: "👑", desc: "Reach 90,000 points",           condition: s => s >= 90000 },
  { id: "godlike",        name: "Godlike",          icon: "🌟", desc: "Reach 100,000 points",          condition: s => s >= 100000 },
  { id: "top10",          name: "Elite Top 10",     icon: "💎", desc: "Enter the Top 10",              condition: (s, rank) => rank <= 10 },
  { id: "top5",           name: "Top 5 Predator",   icon: "🔱", desc: "Enter the Top 5",               condition: (s, rank) => rank <= 5 },
  { id: "top1",           name: "Numero Uno",       icon: "🥇", desc: "Reach #1 on the leaderboard",  condition: (s, rank) => rank === 1 },
];

module.exports = { ACHIEVEMENTS };
