"use strict";

/* NIYYA.ai V2 — privacy-conscious age-aware onboarding */
(() => {
  const copy = {
    fr: {
      title: "Bienvenue dans NIYYA.ai",
      intro: "Configure ton profil en quelques étapes. Nous ne demandons pas ta date de naissance : seule une tranche d’âge est enregistrée.",
      age: "Ta tranche d’âge déclarée",
      age13: "13 à 15 ans",
      age16: "16 à 17 ans",
      age18: "18 ans ou plus",
      under13: "NIYYA est accessible à partir de 13 ans. Si tu as moins de 13 ans, ne crée pas de compte.",
      pseudo: "Pseudo",
      pseudoHint: "3 à 20 caractères : lettres, chiffres ou _",
      country: "Code pays (2 lettres)",
      language: "Langue",
      consent: "J’ai lu et j’accepte les Conditions d’utilisation et la Politique de confidentialité.",
      terms: "Conditions d’utilisation",
      privacy: "Politique de confidentialité",
      submit: "Terminer l’inscription",
      working: "Enregistrement…",
      error: "Impossible de terminer l’inscription.",
      close: "Fermer"
    },
    en: {
      title: "Welcome to NIYYA.ai",
      intro: "Set up your profile. We do not ask for your date of birth; only an age band is stored.",
      age: "Your self-declared age band",
      age13: "13 to 15",
      age16: "16 to 17",
      age18: "18 or older",
      under13: "NIYYA is available from age 13. If you are under 13, do not create an account.",
      pseudo: "Username",
      pseudoHint: "3–20 characters: letters, numbers or _",
      country: "Country code (2 letters)",
      language: "Language",
      consent: "I have read and accept the Terms of Use and Privacy Policy.",
      terms: "Terms of Use",
      privacy: "Privacy Policy",
      submit: "Complete sign-up",
      working: "Saving…",
      error: "Unable to complete sign-up.",
      close: "Close"
    },
    es: {
      title: "Te damos la bienvenida a NIYYA.ai",
      intro: "Configura tu perfil. No pedimos tu fecha de nacimiento; solo guardamos un rango de edad.",
      age: "Tu rango de edad declarado",
      age13: "De 13 a 15 años",
      age16: "De 16 a 17 años",
      age18: "18 años o más",
      under13: "NIYYA está disponible a partir de los 13 años. Si tienes menos de 13, no crees una cuenta.",
      pseudo: "Nombre de usuario",
      pseudoHint: "3–20 caracteres: letras, números o _",
      country: "Código de país (2 letras)",
      language: "Idioma",
      consent: "He leído y acepto los Términos de uso y la Política de privacidad.",
      terms: "Términos de uso",
      privacy: "Política de privacidad",
      submit: "Completar registro",
      working: "Guardando…",
      error: "No se pudo completar el registro.",
      close: "Cerrar"
    },
    ar: {
      title: "مرحبًا بك في NIYYA.ai",
      intro: "أنشئ ملفك الشخصي. لا نطلب تاريخ ميلادك؛ نخزن فئة عمرية فقط.",
      age: "الفئة العمرية التي تصرّح بها",
      age13: "من 13 إلى 15 عامًا",
      age16: "من 16 إلى 17 عامًا",
      age18: "18 عامًا أو أكثر",
      under13: "NIYYA متاحة ابتداءً من عمر 13 عامًا. إذا كان عمرك أقل من 13 عامًا، فلا تنشئ حسابًا.",
      pseudo: "اسم المستخدم",
      pseudoHint: "من 3 إلى 20 حرفًا أو رقمًا أو _",
      country: "رمز الدولة (حرفان)",
      language: "اللغة",
      consent: "قرأت شروط الاستخدام وسياسة الخصوصية وأوافق عليهما.",
      terms: "شروط الاستخدام",
      privacy: "سياسة الخصوصية",
      submit: "إكمال التسجيل",
      working: "جارٍ الحفظ…",
      error: "تعذر إكمال التسجيل.",
      close: "إغلاق"
    }
  };

  function node(tag, className, text) {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (text !== undefined) item.textContent = text;
    return item;
  }

  function open({ onComplete } = {}) {
    document.querySelector(".niyya-modal")?.remove();
    const language = window.NiyyaI18n?.getLanguage?.() || "fr";
    const t = copy[language] || copy.fr;
    const modal = node("div", "niyya-modal onboarding-modal");
    const panel = node("section", "modal-panel onboarding-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "niyya-onboarding-title");

    const header = node("div", "onboarding-header");
    header.append(node("span", "eyebrow", "NIYYA.ai"));
    const close = node("button", "modal-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", t.close);
    header.append(close);

    const title = node("h2", "", t.title);
    title.id = "niyya-onboarding-title";
    const intro = node("p", "onboarding-intro", t.intro);
    const form = node("form", "onboarding-form");

    const ageLabel = node("label", "onboarding-field");
    ageLabel.append(node("span", "onboarding-label", t.age));
    const age = node("select", "language-select");
    age.name = "ageBand";
    age.required = true;
    [["13_15", t.age13], ["16_17", t.age16], ["18_plus", t.age18]].forEach(([value, label]) => {
      const option = node("option", "", label);
      option.value = value;
      age.append(option);
    });
    ageLabel.append(age);

    const under13 = node("p", "onboarding-note", t.under13);
    const pseudoLabel = node("label", "onboarding-field");
    pseudoLabel.append(node("span", "onboarding-label", t.pseudo));
    const pseudo = node("input", "language-select");
    pseudo.name = "pseudonym";
    pseudo.required = true;
    pseudo.minLength = 3;
    pseudo.maxLength = 20;
    pseudo.pattern = "[A-Za-z0-9_]{3,20}";
    pseudo.autocomplete = "nickname";
    pseudo.placeholder = t.pseudoHint;
    pseudoLabel.append(pseudo);

    const countryLabel = node("label", "onboarding-field");
    countryLabel.append(node("span", "onboarding-label", t.country));
    const country = node("input", "language-select");
    country.name = "country";
    country.required = true;
    country.minLength = 2;
    country.maxLength = 2;
    country.pattern = "[A-Za-z]{2}";
    country.autocomplete = "country";
    country.placeholder = "NE";
    country.addEventListener("input", () => { country.value = country.value.toUpperCase(); });
    countryLabel.append(country);

    const languageLabel = node("label", "onboarding-field");
    languageLabel.append(node("span", "onboarding-label", t.language));
    const languageSelect = node("select", "language-select");
    languageSelect.name = "language";
    [["fr","Français"],["en","English"],["es","Español"],["ar","العربية"]].forEach(([value,label]) => {
      const option = node("option", "", label);
      option.value = value;
      option.selected = value === language;
      languageSelect.append(option);
    });
    languageLabel.append(languageSelect);

    const consentLabel = node("label", "onboarding-consent");
    const consent = node("input");
    consent.type = "checkbox";
    consent.required = true;
    const consentText = node("span", "", t.consent);
    consentLabel.append(consent, consentText);
    const links = node("p", "onboarding-links");
    const terms = node("a", "", t.terms);
    terms.href = "/terms.html";
    terms.target = "_blank";
    terms.rel = "noopener";
    const privacy = node("a", "", t.privacy);
    privacy.href = "/privacy.html";
    privacy.target = "_blank";
    privacy.rel = "noopener";
    links.append(terms, node("span", "", " · "), privacy);

    const status = node("p", "chat-status", "");
    status.setAttribute("role", "status");
    const submit = node("button", "chat-send onboarding-submit", t.submit);
    submit.type = "submit";
    form.append(ageLabel, under13, pseudoLabel, countryLabel, languageLabel, consentLabel, links, status, submit);
    panel.append(header, title, intro, form);
    modal.append(panel);
    document.body.append(modal);

    const dismiss = () => modal.remove();
    close.addEventListener("click", dismiss);
    modal.addEventListener("click", event => { if (event.target === modal) dismiss(); });

    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (submit.disabled) return;
      submit.disabled = true;
      status.textContent = t.working;
      try {
        await window.NiyyaAPI.completeOnboarding({
          ageBand: age.value,
          pseudonym: pseudo.value.trim(),
          country: country.value.trim().toUpperCase(),
          language: languageSelect.value,
          acceptedTerms: consent.checked
        });
        dismiss();
        if (typeof onComplete === "function") onComplete();
      } catch (error) {
        status.textContent = error.message || t.error;
        submit.disabled = false;
      }
    });
    age.focus();
  }

  window.NiyyaOnboarding = Object.freeze({ open });
})();
