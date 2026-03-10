// app/services/redis.js

const Redis = require("ioredis");

// connexion au service redis défini dans docker-compose
const redis = new Redis({
  host: "redis",
  port: 6379
});

redis.on("connect", () => {
  console.log("✅ Redis connecté");
});

redis.on("error", (err) => {
  console.error("❌ Erreur Redis :", err);
});

module.exports = redis;