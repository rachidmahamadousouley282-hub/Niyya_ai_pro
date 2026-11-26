"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DATABASE_URL ||= "postgres://niyya_test:niyya_test@127.0.0.1:5432/niyya_test";

const database = require("../src/config/database");
let queryResult = { rows: [] };
let lastQuery = null;
database.query = async (sql, params) => {
  lastQuery = { sql, params };
  return queryResult;
};

const router = require("../src/routes/characters.routes");
const profileLayer = router.stack.find(layer =>
  layer.route &&
  layer.route.path === "/:characterId" &&
  layer.route.methods.get
);
assert.ok(profileLayer, "La route de fiche personnage doit exister");

const [optionalAuth, profileHandler] = profileLayer.route.stack.map(layer => layer.handle);
const CHARACTER_ID = "123e4567-e89b-42d3-a456-426614174000";

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

test("Un visiteur anonyme peut consulter une fiche publique", async () => {
  queryResult = {
    rows: [{
      id: CHARACTER_ID,
      name: "Mira",
      tagline: "Exploratrice",
      creator_pseudonym: "Auteur"
    }]
  };
  lastQuery = null;

  const req = {
    headers: {},
    params: { characterId: CHARACTER_ID }
  };
  const res = createResponse();
  let nextCalled = false;

  await optionalAuth(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  await profileHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.character.name, "Mira");
  assert.deepEqual(lastQuery.params, [CHARACTER_ID, null]);
});

test("Un visiteur anonyme ne peut pas consulter un brouillon privé", async () => {
  queryResult = { rows: [] };
  lastQuery = null;

  const req = {
    headers: {},
    params: { characterId: CHARACTER_ID }
  };
  const res = createResponse();

  await optionalAuth(req, res, () => {});
  await profileHandler(req, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error, "Personnage introuvable ou inaccessible.");
  assert.deepEqual(lastQuery.params, [CHARACTER_ID, null]);
});

test("Le propriétaire authentifié transmet son propre identifiant à la vérification d'accès", async () => {
  const ownerId = "owner-user-id";
  queryResult = {
    rows: [{
      id: CHARACTER_ID,
      name: "Mon brouillon",
      tagline: "Privé",
      creator_pseudonym: "Créateur"
    }]
  };
  lastQuery = null;

  const req = {
    headers: {},
    params: { characterId: CHARACTER_ID },
    user: { id: ownerId, role: "user" }
  };
  const res = createResponse();

  await profileHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.character.name, "Mon brouillon");
  assert.deepEqual(lastQuery.params, [CHARACTER_ID, ownerId]);
});

test("Un identifiant de personnage invalide est refusé avant toute requête SQL", async () => {
  lastQuery = null;
  const req = {
    headers: {},
    params: { characterId: "pas-un-uuid" },
    user: null
  };
  const res = createResponse();

  await profileHandler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(lastQuery, null);
});


test("La route de modification des brouillons existe et est protégée", () => {
  const layer = router.stack.find(item =>
    item.route && item.route.path === "/:characterId" && item.route.methods.patch
  );
  assert.ok(layer, "La route PATCH /:characterId doit exister");
  assert.equal(layer.route.stack.length, 3, "La modification doit passer par authentification et contrôle d'origine");
});
