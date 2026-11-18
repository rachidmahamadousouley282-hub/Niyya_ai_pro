
"use strict";

const express = require("express");
const path = require("path");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");

const authRoutes = require("./routes/auth.routes");
const characterRoutes = require("./routes/characters.routes");

const app = express();

app.disable("x-powered-by");

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(express.json({ limit: "1mb" }));

app.use(express.urlencoded({
  extended: false,
  limit: "1mb"
}));

app.use(express.static(path.join(__dirname, "../public")));

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Trop de requêtes. Réessaie dans quelques minutes."
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Trop de tentatives. Réessaie dans quelques minutes."
  }
});

app.use("/api", generalLimiter);
app.use("/api/auth", authLimiter);

app.get("/api/health", (req, res) => {
  return res.status(200).json({
    status: "ok",
    application: "NIYYA.ai V2",
    message: "Le serveur fonctionne."
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/characters", characterRoutes);

app.use("/api", (req, res) => {
  return res.status(404).json({
    error: "Route API introuvable."
  });
});

app.use((err, req, res, next) => {
  console.error("Erreur serveur :", err.message);

  return res.status(500).json({
    error: "Une erreur interne est survenue."
  });
});

module.exports = app;
