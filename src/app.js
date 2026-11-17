
const express = require("express");
const path = require("path");

const app = express();

app.disable("x-powered-by");

app.use(express.json({ limit: "1mb" }));

app.use(express.urlencoded({
  extended: false,
  limit: "1mb"
}));

// Fichiers du site NIYYA AI
app.use(express.static(
  path.join(__dirname, "../../public")
));

// Vérification du serveur
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    application: "NIYYA AI V2",
    message: "Le serveur fonctionne."
  });
});

// Route inconnue
app.use("/api", (req, res) => {
  res.status(404).json({
    error: "Route API introuvable."
  });
});

// Gestion générale des erreurs
app.use((err, req, res, next) => {
  console.error("Erreur serveur :", err.message);

  res.status(500).json({
    error: "Une erreur interne est survenue."
  });
});

module.exports = app;
