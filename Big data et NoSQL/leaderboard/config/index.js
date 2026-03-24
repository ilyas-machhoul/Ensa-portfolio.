module.exports = {
  PORT: process.env.PORT || 3000,
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  MAX_LEADERBOARD_SIZE: 100,
  SCORE_BROADCAST_THROTTLE_MS: 100,
  MAX_SCORE_INCREMENT: 1000,
};
