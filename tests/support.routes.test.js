"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
process.env.DATABASE_URL ||= "postgres://niyya_test:niyya_test@127.0.0.1:5432/niyya_test";
const member=require("../src/routes/support.routes");
const admin=require("../src/routes/support-admin.routes");
const routes=router=>router.stack.filter(x=>x.route).map(x=>({path:x.route.path,methods:Object.keys(x.route.methods).filter(m=>x.route.methods[m]),handlers:x.route.stack}));
test("Member support routes require an authenticated owner and expose private ticket threads",()=>{
 const paths=routes(member);
 const has=(method,path)=>paths.some(r=>r.path===path&&r.methods.includes(method));
 assert.equal(has("get","/tickets"),true);
 assert.equal(has("post","/tickets"),true);
 assert.equal(has("get","/tickets/:ticketId"),true);
 assert.equal(has("post","/tickets/:ticketId/messages"),true);
 assert.ok(paths.filter(r=>r.path.startsWith("/tickets")).every(r=>typeof r.handlers[0].handle==="function"));
 const source=require("node:fs").readFileSync(require("node:path").join(__dirname,"../src/routes/support.routes.js"),"utf8");
 assert.match(source,/WHERE t\.user_id=\$1/);
 assert.match(source,/WHERE id=\$1 AND user_id=\$2/);
});
test("Support administration is protected by the admin role",()=>{
 const paths=routes(admin);
 const has=(method,path)=>paths.some(r=>r.path===path&&r.methods.includes(method));
 assert.equal(has("get","/tickets"),true);
 assert.equal(has("get","/tickets/:id"),true);
 assert.equal(has("post","/tickets/:id/messages"),true);
 assert.equal(has("patch","/tickets/:id"),true);
 const source=require("node:fs").readFileSync(require("node:path").join(__dirname,"../src/routes/support-admin.routes.js"),"utf8");
 assert.match(source,/req\.user\.role!==\"admin\"/);
});
test("Support schema stores replies separately from public community content",()=>{
 const fs=require("node:fs"),path=require("node:path");
 const migration=fs.readFileSync(path.join(__dirname,"../database/migrations/0016_private_support_messages.sql"),"utf8");
 assert.match(migration,/CREATE TABLE IF NOT EXISTS public\.support_ticket_messages/);
 assert.match(migration,/sender_role IN \('member','admin'\)/);
 const app=fs.readFileSync(path.join(__dirname,"../src/app.js"),"utf8");
 assert.match(app,/app\.use\("\/api\/support", supportRoutes\)/);
 assert.match(app,/app\.use\("\/api\/admin\/support", supportAdminRoutes\)/);
});
