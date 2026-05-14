# ⚔️ NEXUS ARENA — Système de Classement Gaming
## Projet 08 · Module M123 Big Data NoSQL · ENSA Beni Mellal

---

## 🛠️ Technologies
| Composant | Technologie |
|-----------|-------------|
| Base de données | **Redis** (Sorted Sets, Hashes, Sets) |
| Backend | **Node.js** + Express |
| Temps réel | **WebSocket** (ws) |
| Frontend | HTML5 + CSS3 + JS Vanilla |

---

## 📋 Fonctionnalités implémentées

| # | Fonctionnalité | Description |
|---|---------------|-------------|
| ✅ | **Leaderboards multiples** | Global, Daily, Weekly, Ranked, Casual |
| ✅ | **Mise à jour instantanée** | WebSocket broadcast en temps réel |
| ✅ | **Classement + Voisins** | Affichage des ±4 joueurs autour d'un joueur |
| ✅ | **Achievements/Badges** | 10 badges automatiques selon score/rang |
| ✅ | **Notifications temps réel** | Feed live + toasts animés |
| ✅ | **Simulation automatique** | Scores auto avec vitesse réglable |
| ✅ | **Mise à jour manuelle** | Ajout rapide, personnalisé, ou absolu |
| ✅ | **Dataset réel** | 30 joueurs avec stats réalistes |

---

## 🗄️ Architecture Redis

```
lb:global          → ZSET (playerId → score)  — leaderboard principal
lb:daily           → ZSET (playerId → score)  — scores du jour
lb:weekly          → ZSET (playerId → score)  — scores hebdo
lb:ranked          → ZSET (playerId → score)  — mode classé
lb:casual          → ZSET (playerId → score)  — mode casual
player:{id}        → HASH (username, avatar, kd_ratio, tier, ...)
achievements:{id}  → SET  (achievement_ids obtenus)
```

### Commandes Redis utilisées
- `ZADD`     — Ajouter/mettre à jour un score
- `ZINCRBY`  — Incrémenter un score atomiquement
- `ZREVRANK` — Rang d'un joueur (0-indexed)
- `ZREVRANGE ... WITHSCORES` — Top N joueurs avec scores
- `ZCARD`    — Nombre de joueurs dans un board
- `HSET/HGETALL` — Métadonnées joueur
- `SADD/SISMEMBER` — Gestion des achievements

---

## 🚀 Installation & Démarrage

### Prérequis
- Node.js ≥ 18
- Redis Server (local ou Docker)

### 1. Démarrer Redis
```bash
# Option A — Redis local
redis-server

# Option B — Docker
docker run -d -p 6379:6379 redis:alpine
```

### 2. Installer les dépendances
```bash
cd project8
npm install
```

### 3. Lancer le serveur
```bash
npm start
# ou en mode dev
npm run dev
```

### 4. Ouvrir le navigateur
```
http://localhost:3000
```

---

## 📡 API Endpoints

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/leaderboard/:type` | Top 25 d'un board |
| GET | `/api/players` | Tous les joueurs |
| GET | `/api/neighbors/:id` | Joueurs voisins |
| POST | `/api/score/add` | Ajouter des points |
| POST | `/api/score/set` | Définir un score absolu |
| GET | `/api/stats` | Statistiques globales |
| GET | `/api/achievements` | Liste des achievements |
| POST | `/api/simulation/start` | Démarrer l'auto-sim |
| POST | `/api/simulation/stop` | Arrêter l'auto-sim |
| POST | `/api/reset` | Réinitialiser depuis le dataset |

---

## 📊 Dataset
30 joueurs réels avec : username, pays, avatar, score, kills, deaths, wins, matches, K/D ratio, accuracy, heures de jeu, tier.

---

## 👥 Groupe
- MACHHOUL ILYAS
- ELKHAYAR YOUSSEF
- KHAMRICH MOHAMMED
