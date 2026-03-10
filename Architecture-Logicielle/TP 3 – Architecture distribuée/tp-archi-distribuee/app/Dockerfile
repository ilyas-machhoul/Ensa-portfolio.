# app/Dockerfile

# ── Image de base Node.js ────────────────────────────────
FROM node:18-alpine

# ── Définir le répertoire de travail dans le conteneur
WORKDIR /app

# ── Copier les fichiers de dépendances et installer les packages
COPY package*.json ./
RUN npm install

# ── Copier le reste du code de l'application
COPY . .

# ── Commande de démarrage de l'application
CMD ["node", "server.js"]