"use strict";

const express = require("express");
const { query } = require("../config/database");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT onboarded_at, adult_confirmed_at, terms_accepted_at, age_band, vip_until, daily_quota_date,
              daily_messages_used, daily_bonus_messages,
              rewarded_videos_today, rewarded_videos_day
       FROM public.users
       WHERE id = $1
       LIMIT 1`,
      [req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Compte introuvable." });
    }

    const user = result.rows[0];
    const today = new Date().toISOString().slice(0, 10);
    const quotaIsToday = user.daily_quota_date &&
      new Date(user.daily_quota_date).toISOString().slice(0, 10) === today;
    const videosAreToday = user.rewarded_videos_day &&
      new Date(user.rewarded_videos_day).toISOString().slice(0, 10) === today;
    const used = quotaIsToday ? Number(user.daily_messages_used || 0) : 0;
    const bonus = quotaIsToday ? Number(user.daily_bonus_messages || 0) : 0;
    const videos = videosAreToday ? Number(user.rewarded_videos_today || 0) : 0;
    const vip = Boolean(user.vip_until && new Date(user.vip_until) > new Date());

    return res.status(200).json({
      success: true,
      onboarded: Boolean(user.onboarded_at),
      ageBand: user.age_band || (user.adult_confirmed_at ? "18_plus" : null),
      creatorAccess: Boolean(user.onboarded_at && user.adult_confirmed_at && user.terms_accepted_at),
      tier: vip ? "vip" : "free",
      remaining: vip ? null : Math.max(30 + bonus - used, 0),
      dailyBase: 30,
      bonusMessages: bonus,
      rewardedVideosToday: videos,
      rewardedVideosRemaining: Math.max(5 - videos, 0),
      vipUntil: user.vip_until || null
    });
  } catch (error) {
    console.error("Erreur lecture quota :", error.message);
    return res.status(500).json({ error: "Impossible de charger le quota." });
  }
});

module.exports = router;
