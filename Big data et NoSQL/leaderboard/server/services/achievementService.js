const { client } = require('../redis/client');

const ACHIEVEMENTS = [
  { id: 'first_score',    label: 'First Blood',       icon: 'sword',   check: (r, p) => p.totalScore > 0 },
  { id: 'top1_world',     label: '#1 in the World',   icon: 'trophy',  check: (r)    => r.world === 1 },
  { id: 'top3_world',     label: 'Global Top 3',      icon: 'medal',   check: (r)    => r.world <= 3 },
  { id: 'top10_world',    label: 'Top 10 World',      icon: 'star',    check: (r)    => r.world <= 10 },
  { id: 'top1_continent', label: 'Continent Leader',  icon: 'globe',   check: (r)    => r.continent === 1 },
  { id: 'top1_state',     label: 'State Champion',    icon: 'flag',    check: (r)    => r.state === 1 },
  { id: 'score_1k',       label: '1,000 Club',        icon: 'fire',    check: (r, p) => p.totalScore >= 1000 },
  { id: 'score_5k',       label: '5,000 Legend',      icon: 'crown',   check: (r, p) => p.totalScore >= 5000 },
  { id: 'score_10k',      label: '10K God',           icon: 'diamond', check: (r, p) => p.totalScore >= 10000 },
];

// Returns list of newly unlocked achievements for this player
const checkAchievements = async (playerId, ranks, player) => {
  const key = `achievements:${playerId}`;
  const newlyUnlocked = [];

  for (const ach of ACHIEVEMENTS) {
    const alreadyEarned = await client.sIsMember(key, ach.id);
    if (!alreadyEarned && ach.check(ranks, player)) {
      await client.sAdd(key, ach.id);
      newlyUnlocked.push(ach);
    }
  }
  return newlyUnlocked;
};

const getPlayerAchievements = async (playerId) => {
  const earned = await client.sMembers(`achievements:${playerId}`);
  return ACHIEVEMENTS.filter((a) => earned.includes(a.id));
};

module.exports = { ACHIEVEMENTS, checkAchievements, getPlayerAchievements };
