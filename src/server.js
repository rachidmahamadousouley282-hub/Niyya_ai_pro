"use strict";

require("dotenv").config();

const app = require("./app");
const {
  testConnection,
  closeDatabase
} = require("./config/database");
const { startCommunityEvents, stopCommunityEvents } = require("./services/community-events.service");

const PORT = process.env.PORT || 10000;

let server;
let isShuttingDown = false;

async function startServer() {
  try {
    await testConnection();
    await startCommunityEvents();

    console.log("Connexion à Neon réussie.");

    server = app.listen(PORT, () => {
      console.log(`NIYYA AI V2 fonctionne sur le port ${PORT}.`);
    });

    server.on("error", (error) => {
      console.error("Erreur du serveur HTTP :", error.message);
      shutdown(1);
    });

  } catch (error) {
    console.error(
      "Impossible de démarrer NIYYA AI V2 :",
      error.message
    );

    await closeDatabase().catch(() => {});
    process.exitCode = 1;
  }
}

async function shutdown(exitCode = 0) {
  if (isShuttingDown) return;

  isShuttingDown = true;

  console.log("Arrêt de NIYYA AI V2 en cours...");

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }

    await stopCommunityEvents().catch(() => {});
    await closeDatabase();

    console.log("Serveur et connexions PostgreSQL fermés.");
  } catch (error) {
    console.error("Erreur pendant l'arrêt :", error.message);
    exitCode = 1;
  }

  process.exitCode = exitCode;
}

process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));

startServer();
