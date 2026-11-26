"use strict";
const { Client } = require("pg");
const { query } = require("../config/database");
const CHANNEL = "niyya_community_events";
const subscribers = new Set(), subscribersByUser = new Map();
let listener = null, retryTimer = null, heartbeatTimer = null, stopped = false;
function sendEvent(res,type,data={}) {
  if(res.destroyed||res.writableEnded)return false;
  try{res.write("event: "+type+"\ndata: "+JSON.stringify(data)+"\n\n");return true;}catch{return false;}
}
function dispatch(event) {
  const targets=event.userId?(subscribersByUser.get(String(event.userId))||[]):subscribers;
  for(const res of targets)sendEvent(res,event.type);
}
function scheduleReconnect(client) {
  if(listener!==client)return;
  listener=null;client.end().catch(()=>{});
  if(!stopped&&!retryTimer){retryTimer=setTimeout(()=>{retryTimer=null;connectListener();},5000);retryTimer.unref?.();}
}
async function connectListener() {
  if(stopped||listener)return;
  const client=new Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:true},application_name:"niyya-community-events"});
  listener=client;
  client.on("notification",msg=>{
    if(msg.channel!==CHANNEL||!msg.payload)return;
    try{const event=JSON.parse(msg.payload);if(["activity","feed_changed"].includes(event.type))dispatch(event);}
    catch(error){console.error("Événement communautaire invalide :",error.message);}
  });
  client.on("error",error=>{console.error("Écoute communautaire interrompue :",error.message);scheduleReconnect(client);});
  client.on("end",()=>scheduleReconnect(client));
  try{await client.connect();if(stopped||listener!==client){await client.end().catch(()=>{});return;}await client.query("LISTEN "+CHANNEL);console.log("Écoute des événements communautaires active.");}
  catch(error){console.error("Écoute communautaire indisponible :",error.message);scheduleReconnect(client);}
}
function startCommunityEvents() {
  stopped=false;
  if(!heartbeatTimer){heartbeatTimer=setInterval(()=>{for(const res of subscribers)if(!res.destroyed&&!res.writableEnded)res.write(": keep-alive\n\n");},25000);heartbeatTimer.unref?.();}
  return connectListener();
}
function subscribeCommunityUser(userId,res) {
  const key=String(userId),current=subscribersByUser.get(key)||new Set();
  if(current.size>=4)return false;
  current.add(res);subscribersByUser.set(key,current);subscribers.add(res);
  const remove=()=>{current.delete(res);subscribers.delete(res);if(!current.size)subscribersByUser.delete(key);};
  res.on("close",remove);res.on("error",remove);sendEvent(res,"ready");return true;
}
async function publishCommunityEvent(userId,type) {
  if(!["activity","feed_changed"].includes(type))return;
  try{await query("SELECT pg_notify($1,$2)",[CHANNEL,JSON.stringify({userId:userId?String(userId):null,type})]);}
  catch(error){console.error("Émission communautaire indisponible :",error.message);}
}
async function stopCommunityEvents() {
  stopped=true;if(retryTimer)clearTimeout(retryTimer);retryTimer=null;
  if(heartbeatTimer)clearInterval(heartbeatTimer);heartbeatTimer=null;
  if(listener){const current=listener;listener=null;await current.end().catch(()=>{});}
  for(const res of subscribers)res.end();subscribers.clear();subscribersByUser.clear();
}
module.exports={startCommunityEvents,stopCommunityEvents,subscribeCommunityUser,publishCommunityEvent};
