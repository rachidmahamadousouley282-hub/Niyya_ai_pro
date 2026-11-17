
/* =================================
   NIYYA AI V2 — MAIN APPLICATION
================================= */

document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("character-search");
  const characterCards = [
    ...document.querySelectorAll(".character-card")
  ];
  const categoryButtons = [
    ...document.querySelectorAll(".category")
  ];

  let activeCategory = "all";

  // CHARACTER FILTER
  function filterCharacters() {
    const search = searchInput.value
      .trim()
      .toLowerCase();

    characterCards.forEach(card => {
      const name = card.querySelector("h3")
        .textContent.toLowerCase();

      const description = card.querySelector("p")
        .textContent.toLowerCase();

      const category = card.dataset.category;

      const matchesSearch =
        name.includes(search) ||
        description.includes(search);

      const matchesCategory =
        activeCategory === "all" ||
        category === activeCategory;

      card.hidden = !(matchesSearch && matchesCategory);
    });
  }

  // SEARCH
  searchInput.addEventListener("input", filterCharacters);

  // CATEGORY SELECTION
  categoryButtons.forEach(button => {
    button.addEventListener("click", () => {
      categoryButtons.forEach(item => {
        item.classList.remove("active");
      });

      button.classList.add("active");
      activeCategory = button.dataset.category;

      filterCharacters();
    });
  });

  // MODAL
  function openModal(title, message) {
    const oldModal = document.querySelector(".niyya-modal");

    if (oldModal) oldModal.remove();

    const modal = document.createElement("div");
    modal.className = "niyya-modal";

    modal.innerHTML = `
      <div class="modal-panel" role="dialog"
           aria-modal="true" aria-labelledby="modal-title">
        <button class="modal-close"
                aria-label="Fermer">×</button>
        <span class="eyebrow">NIYYA AI V2</span>
        <h2 id="modal-title"></h2>
        <p class="modal-message"></p>
        <button class="modal-confirm">Compris</button>
      </div>
    `;

    modal.querySelector("h2").textContent = title;
    modal.querySelector(".modal-message").textContent = message;

    document.body.appendChild(modal);

    function closeModal() {
      modal.remove();
    }

    modal.querySelector(".modal-close")
      .addEventListener("click", closeModal);

    modal.querySelector(".modal-confirm")
      .addEventListener("click", closeModal);

    modal.addEventListener("click", event => {
      if (event.target === modal) closeModal();
    });

    document.addEventListener("keydown", function escape(event) {
      if (event.key === "Escape") {
        closeModal();
        document.removeEventListener("keydown", escape);
      }
    });
  }

  // CHARACTER PREVIEW
  document.querySelectorAll("[data-character]")
    .forEach(button => {
      button.addEventListener("click", () => {
        const character = button.dataset.character;

        openModal(
          character,
          "Ce personnage est actuellement une démonstration. Son véritable profil et sa conversation IA seront connectés dans une prochaine étape."
        );
      });
    });

  // CREATE CHARACTER
  const createButton = document.getElementById("create-character");

  createButton.addEventListener("click", () => {
    openModal(
      "Créer ton personnage",
      "L'atelier de création de personnages sera bientôt disponible."
    );
  });

  // BOTTOM NAVIGATION
  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".nav-item")
        .forEach(link => link.classList.remove("selected"));

      item.classList.add("selected");
    });
  });

  console.log("NIYYA AI V2 — Interface initialisée.");
});

