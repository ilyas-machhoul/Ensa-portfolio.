// app/services/mongodb.js

const mongoose = require("mongoose");

// ── Schéma de la collection Commande ─────────────────────────
const CommandeSchema = new mongoose.Schema({
  produit:  { type: String, required: true },
  quantite: { type: Number, required: true },
  client:   { type: String, required: true },
  statut:   { type: String, default: "en_attente" },
  date:     { type: Date, default: Date.now }
});

// ── Modèle MongoDB
const Commande = mongoose.model("Commande", CommandeSchema);

// ── Connexion à MongoDB
async function connectMongo() {
  try {
    await mongoose.connect("mongodb://mongodb:27017/boutique");
    console.log("✅ MongoDB connecté");
  } catch (error) {
    console.error("❌ Erreur connexion MongoDB :", error);
    process.exit(1);
  }
}

module.exports = { connectMongo, Commande };