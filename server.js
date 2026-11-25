const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 10000;

// Connexion à la base de données Neon PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

app.use(express.json());

// Servir les fichiers statiques du frontend depuis le dossier public
app.use(express.static(path.join(__dirname, 'public')));

// Route de test API
app.get('/api/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ status: 'success', time: result.rows[0].now, message: 'NIYYA AI Backend opérationnel !' });
    } catch (err) {
        res.status(500).json({ status: 'error', error: err.message });
    }
});

// Route d'administration sécurisée
app.get('/admin', (req, res) => {
    const adminKey = req.query.key;
    if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(403).send('Accès refusé : Clé administrateur incorrecte ou manquante.');
    }
    res.send(`<h1>🔑 Dashboard Admin NIYYA AI</h1><p>Bienvenue, fondateur. Le système est en ligne.</p>`);
});

// Démarrage du serveur
app.listen(port, () => {
    console.log(`NIYYA AI démarré sur le port ${port}`);
});
