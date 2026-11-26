"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DATABASE_URL ||= "postgres://niyya_test:niyya_test@127.0.0.1:5432/niyya_test";

const database = require("../src/config/database");
let queryQueue = [];
let recordedQueries = [];
database.query = async (sql, params = []) => {
  recordedQueries.push({ sql, params });
  return queryQueue.length ? queryQueue.shift() : { rows: [] };
};

const charactersRouter = require("../src/routes/characters.routes");
const creatorLayer = charactersRouter.stack.find(layer =>
  layer.route && layer.route.path === "/" && layer.route.methods.post
);
assert.ok(creatorLayer, "La route POST /api/characters doit exister");
const createHandler = creatorLayer.route.stack.at(-1);

const CHARACTER_ID = "123e4567-e89b-42d3-a456-426614174000";
const OWNER_ID = "owner-user-id";

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function validCharacterPayload() {
  return {
    name: "Mira",
    tagline: "Une exploratrice curieuse",
    shortBio: "Mira explore des mondes imaginaires avec prudence.",
    backstory: "Elle vient d'une cité ancienne et cherche à comprendre le monde.",
    personalityPrompt: "Mira est curieuse, réfléchie, patiente et respectueuse.",
    scenario: "Une aventure fictive et bienveillante.",
    greeting: "Bonjour ! Que souhaites-tu découvrir aujourd'hui ?",
    category: "adventure",
    traits: ["curieuse", "patiente"],
    tags: ["aventure", "mystère"]
  };
}

test("La création enregistre réellement un brouillon privé et renvoie son identifiant", async () => {
  const saved = {
    id: CHARACTER_ID,
    name: "Mira",
    tagline: "Une exploratrice curieuse",
    short_bio: "Mira explore des mondes imaginaires avec prudence.",
    backstory: "Elle vient d'une cité ancienne et cherche à comprendre le monde.",
    personality_prompt: "Mira est curieuse, réfléchie, patiente et respectueuse.",
    scenario: "Une aventure fictive et bienveillante.",
    greeting: "Bonjour ! Que souhaites-tu découvrir aujourd'hui ?",
    category: "adventure",
    personality_traits: ["curieuse", "patiente"],
    tags: ["aventure", "mystère"],
    visibility: "private",
    publication_status: "none",
    created_at: new Date("2026-01-01T00:00:00Z"),
    updated_at: new Date("2026-01-01T00:00:00Z")
  };
  queryQueue = [
    { rows: [{ onboarded_at: new Date(), terms_accepted_at: new Date(), pseudonym: "Membre", age_band: "16_17" }] },
    { rows: [saved] },
    { rows: [{ onboarded_at: new Date(), adult_confirmed_at: null, terms_accepted_at: new Date(), pseudonym: "Membre" }] }
  ];
  recordedQueries = [];

  const req = {
    user: { id: OWNER_ID, role: "user" },
    body: validCharacterPayload(),
    get(name) {
      return ({ origin: "https://niyya.example", host: "niyya.example", "sec-fetch-site": "same-origin" })[name.toLowerCase()];
    }
  };
  const res = response();
  await createHandler(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.character.id, CHARACTER_ID);
  assert.equal(res.body.character.name, "Mira");
  assert.equal(res.body.character.visibility, "private");
  assert.equal(res.body.character.publication_status, "none");
  assert.equal(res.body.canSubmit, false, "Un compte mineur ne reçoit pas le droit de publier");
  assert.match(recordedQueries[1].sql, /INSERT INTO public\.characters/);
  assert.match(recordedQueries[1].sql, /'private', 'none', 'none'/);
  assert.deepEqual(recordedQueries[1].params.slice(0, 4), [
    OWNER_ID, "Mira", "Une exploratrice curieuse",
    "Mira est curieuse, réfléchie, patiente et respectueuse."
  ]);
  assert.equal(queryQueue.length, 0, "Toutes les étapes de persistance doivent être exécutées");
});

test("Un brouillon privé est utilisable par son propriétaire dans le moteur de conversation", async () => {
  const characterEngine = require("../src/engines/character.engine");
  let captured = null;
  database.query = async (sql, params = []) => {
    captured = { sql, params };
    return { rows: [{
      id: CHARACTER_ID,
      owner_user_id: OWNER_ID,
      name: "Mira",
      visibility: "private",
      publication_status: "none",
      status: "active",
      is_system: false,
      personality_prompt: "Personnalité de test",
      greeting: "Bonjour"
    }] };
  };

  const character = await characterEngine.getCharacterForConversation({
    characterId: CHARACTER_ID,
    userId: OWNER_ID
  });

  assert.equal(character.id, CHARACTER_ID);
  assert.equal(character.visibility, "private");
  assert.match(captured.sql, /owner_user_id = \$2/);
  assert.deepEqual(captured.params, [CHARACTER_ID, OWNER_ID]);
});

test("L'accès à un brouillon privé dépend du propriétaire et non de sa visibilité publique", async () => {
  const characterEngine = require("../src/engines/character.engine");
  let captured = null;
  database.query = async (sql, params = []) => {
    captured = { sql, params };
    return { rows: [] };
  };

  const character = await characterEngine.getCharacterForConversation({
    characterId: CHARACTER_ID,
    userId: "another-user-id"
  });

  assert.equal(character, null);
  assert.deepEqual(captured.params, [CHARACTER_ID, "another-user-id"]);
  assert.match(captured.sql, /visibility = 'public'[\s\S]*publication_status = 'approved'[\s\S]*owner_user_id = \$2/);
});
