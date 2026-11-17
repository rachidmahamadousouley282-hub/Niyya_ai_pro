require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.post('/api/guest', async (req, res) => {
  try {
    const { country, lang } = req.body;
    const result = await pool.query(
      'INSERT INTO users (country_code, lang_code, messages_left) VALUES ($1, $2, 5) RETURNING *',
      [country || 'NE', lang || 'fr']
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/send-code', async (req, res) => {
  try {
    const { email } = req.body;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60000);

    await pool.query(
      `INSERT INTO auth_codes (email, code, expires_at) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (email) DO UPDATE SET code = $2, expires_at = $3`,
      [email.toLowerCase(), code, expires]
    );

    if (process.env.RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'NIYYA AI <onboarding@resend.dev>',
          to: email,
          subject: 'Ton code de connexion NIYYA AI : ' + code,
          html: `<p>Ton code secret pour entrer sur <strong>NIYYA AI</strong> est : <h2>${code}</h2></p>`
        })
      });
    } else {
      console.log(`[CODE TEST] Pour ${email} : ${code}`);
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/verify', async (req, res) => {
  try {
    const { email, code, pseudo, country, lang, guestId } = req.body;
    const check = await pool.query(
      'SELECT * FROM auth_codes WHERE email = $1 AND code = $2 AND expires_at > NOW()',
      [email.toLowerCase(), code]
    );

    if (check.rows.length === 0) {
      return res.status(400).json({ error: 'Code invalide ou expiré.' });
    }

    await pool.query('DELETE FROM auth_codes WHERE email = $1', [email.toLowerCase()]);

    let userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    
    if (userRes.rows.length > 0) {
      return res.json(userRes.rows[0]);
    }

    if (guestId) {
      userRes = await pool.query(
        `UPDATE users SET email = $1, pseudo = $2, country_code = $3, lang_code = $4, is_verified = TRUE, messages_left = 25 
         WHERE id = $5 RETURNING *`,
        [email.toLowerCase(), pseudo, country || 'NE', lang || 'fr', guestId]
      );
    } else {
      userRes = await pool.query(
        `INSERT INTO users (email, pseudo, country_code, lang_code, is_verified, messages_left) 
         VALUES ($1, $2, $3, $4, TRUE, 25) RETURNING *`,
        [email.toLowerCase(), pseudo, country || 'NE', lang || 'fr']
      );
    }

    res.json(userRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { userId, characterId, characterName, characterTag, message, lang } = req.body;
    
    const uRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (uRes.rows.length === 0) return res.status(404).json({ error: 'Utilisateur introuvable' });
    const user = uRes.rows[0];

    if (!user.is_vip && user.messages_left <= 0) {
      return res.status(403).json({ error: 'QUOTA_EXCEEDED', isVerified: user.is_verified });
    }

    await pool.query(
      'INSERT INTO messages (user_id, character_id, sender, content) VALUES ($1, $2, $3, $4)',
      [userId, characterId, 'u', message]
    );

    let newLeft = user.messages_left;
    if (!user.is_vip) {
      newLeft = user.messages_left - 1;
      await pool.query('UPDATE users SET messages_left = $1 WHERE id = $2', [newLeft, userId]);
    }

    let aiReply = "Hmm, continue de me raconter ça… j'aime beaucoup ta façon de penser.";
    if (process.env.AI_API_KEY) {
      const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.AI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: user.is_vip ? 'llama-3.3-70b-versatile' : 'llama-3.1-8b-instant',
          messages: [
            { 
              role: 'system', 
              content: `Tu es ${characterName}. ${characterTag}. Réponds dans un style immersif, complice et naturel. Utilise parfois @${user.pseudo || 'toi'}. Langue : ${lang || user.lang_code}.` 
            },
            { role: 'user', content: message }
          ],
          max_tokens: 250
        })
      });
      const aiData = await aiRes.json();
      if (aiData.choices && aiData.choices[0]) {
        aiReply = aiData.choices[0].message.content;
      }
    }

    await pool.query(
      'INSERT INTO messages (user_id, character_id, sender, content) VALUES ($1, $2, $3, $4)',
      [userId, characterId, 'a', aiReply]
    );

    res.json({ reply: aiReply, messages_left: newLeft });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reward-video', async (req, res) => {
  try {
    const { userId } = req.body;
    const uRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = uRes.rows[0];

    const today = new Date().toISOString().split('T')[0];
    const lastDate = user.last_video_date ? new Date(user.last_video_date).toISOString().split('T')[0] : null;
    let videosToday = (lastDate === today) ? user.videos_watched_today : 0;

    if (videosToday >= 5) {
      return res.status(400).json({ error: 'Limite de 5 vidéos atteinte pour aujourd’hui.' });
    }

    const updated = await pool.query(
      `UPDATE users SET messages_left = messages_left + 5, videos_watched_today = $1, last_video_date = CURRENT_DATE 
       WHERE id = $2 RETURNING messages_left, videos_watched_today`,
      [videosToday + 1, userId]
    );

    res.json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/stats', async (req, res) => {
  try {
    if (req.query.key !== process.env.ADMIN_KEY) {
      return res.status(401).json({ error: 'Accès refusé' });
    }
    const countries = await pool.query('SELECT * FROM admin_stats_by_country');
    const languages = await pool.query('SELECT * FROM admin_stats_by_language');
    res.json({ countries: countries.rows, languages: languages.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`NIYYA AI démarré sur le port ${PORT}`));