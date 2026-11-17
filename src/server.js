

require("dotenv").config();

const app = require("./app");
const { testConnection } = require("./config/database");

const PORT = process.env.PORT || 10000;

async function startServer() {
  try {
    await testConnection();
    console.log("Connexion à Neon réussie.");

    app.listen(PORT, () => {
      console.log(`NIYYA AI V2 fonctionne sur le port ${PORT}.`);
    });
  } catch (error) {
    console.error("Impossible de démarrer NIYYA AI V2 :", error.message);
    process.exit(1);
  }
}

startServer();
