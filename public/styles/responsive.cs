
/* NIYYA AI V2 — RESPONSIVE DESIGN */

/* TABLETS */
@media (max-width: 850px) {
  .app-shell {
    padding-left: 22px;
    padding-right: 22px;
  }

  .character-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .hero {
    padding-top: 48px;
  }
}

/* MOBILE */
@media (max-width: 600px) {
  .app-shell {
    padding-left: 16px;
    padding-right: 16px;
    padding-bottom: 100px;
  }

  .topbar {
    height: 65px;
  }

  .hero {
    padding-top: 38px;
  }

  .hero h1 {
    font-size: clamp(32px, 9vw, 42px);
  }

  .hero > p {
    font-size: 13px;
  }

  .search-box {
    height: 51px;
  }

  .category-list {
    overflow-x: auto;
    flex-wrap: nowrap;
    padding-bottom: 8px;
    scrollbar-width: none;
  }

  .category-list::-webkit-scrollbar {
    display: none;
  }

  .character-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .character-art {
    height: 145px;
  }

  .character-info {
    padding: 11px;
  }

  .character-info p {
    min-height: 52px;
  }

  .creator-banner {
    padding: 24px 18px;
  }

  .bottom-nav {
    width: calc(100% - 20px);
    bottom: 8px;
  }
}

/* SMALL PHONES */
@media (max-width: 360px) {
  .app-shell {
    padding-left: 12px;
    padding-right: 12px;
  }

  .character-grid {
    gap: 8px;
  }

  .character-art {
    height: 125px;
  }

  .nav-item {
    min-width: 42px;
    font-size: 8px;
  }

  .nav-item span {
    font-size: 19px;
  }
}

/* LARGE SCREENS */
@media (min-width: 1100px) {
  .hero {
    padding-top: 90px;
  }

  .character-grid {
    gap: 22px;
  }

  .character-art {
    height: 235px;
  }
}
