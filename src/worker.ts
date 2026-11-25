import {evaluate,validateConfig} from "./engine.mjs";
import {getWeather} from "./weather";
import {shellyStatus} from "./shelly";
import {page} from "./page";
interface Env {SHELLY_HOST?:string; SHELLY_AUTH_KEY?:string; DB:D1Database; ADMIN_TOKEN?:string; LOCATION_LAT?:string; LOCATION_LON?:string; TIMEZONE?:string}
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
async function config(env:Env){const row=await env.DB.prepare("SELECT body FROM config WHERE id=1").first<{body:string}>();return JSON.parse(row!.body);}
async function tick(env:Env){
  const now=Date.now();
  const lock=await env.DB.prepare("UPDATE leases SET until_ms=? WHERE id=1 AND until_ms<=?").bind(now+120000,now).run();
  if(!lock.meta.changes)return;
  try{
    const cfg=await config(env);
    if(!cfg.devices.length)return;
    const cached=await env.DB.prepare("SELECT body FROM weather_cache WHERE id=1").first<{body:string}>();
    let weather=cached?JSON.parse(cached.body):null;
    if(!weather||now-weather.fetchedAt>=300000){try{weather=await getWeather(env.LOCATION_LAT??"",env.LOCATION_LON??"");await env.DB.prepare("INSERT INTO weather_cache VALUES(1,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body").bind(JSON.stringify(weather)).run();}catch(e){console.error("Weather update failed");}}
    for(const device of cfg.devices){
      const prefix=device.id+":";
      const rows=await env.DB.prepare("SELECT key,since FROM rule_state WHERE substr(key,1,?)=?").bind(prefix.length,prefix).all<{key:string,since:number}>();
      const since=Object.fromEntries(rows.results.map(x=>[x.key.slice(prefix.length),x.since]));
      const decision=evaluate({device,rules:cfg.rules,weather,now:Date.now(),timezone:env.TIMEZONE??"Europe/Madrid",since});
      const {since:next,...summary}=decision;
      const body=JSON.stringify({...summary,mode:"observation"});
      const previous=await env.DB.prepare("SELECT body FROM decisions WHERE device_id=?").bind(device.id).first<{body:string}>();
      const statements=[env.DB.prepare("DELETE FROM rule_state WHERE substr(key,1,?)=?").bind(prefix.length,prefix)];
      for(const [id,time] of Object.entries(next))statements.push(env.DB.prepare("INSERT INTO rule_state VALUES(?,?)").bind(prefix+id,time));
      if(previous?.body!==body){statements.push(env.DB.prepare("INSERT INTO decisions VALUES(?,?) ON CONFLICT(device_id) DO UPDATE SET body=excluded.body").bind(device.id,body),env.DB.prepare("INSERT INTO history(at,device_id,body) VALUES(?,?,?)").bind(now,device.id,body));}
      await env.DB.batch(statements);
    }
  }finally{await env.DB.prepare("UPDATE leases SET until_ms=0 WHERE id=1 AND until_ms=?").bind(now+120000).run();}
}
export default {
  async fetch(req:Request,env:Env):Promise<Response>{
    const path=new URL(req.url).pathname;
    if(path==="/"&&req.method==="GET")return new Response(page,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Content-Security-Policy":"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'","X-Content-Type-Options":"nosniff"}});
    if(!env.ADMIN_TOKEN||req.headers.get("Authorization")!=="Bearer "+env.ADMIN_TOKEN)return json({error:"Unauthorized"},401);
    try{
      if(path==="/api/status"&&req.method==="GET"){const weather=await env.DB.prepare("SELECT body FROM weather_cache WHERE id=1").first<{body:string}>();return json({mode:"observation",weather:weather?JSON.parse(weather.body):null,decisions:(await env.DB.prepare("SELECT * FROM decisions").all()).results});}
      if(path==="/api/shelly/status"&&req.method==="GET"){const cfg=await config(env);const ids=[...new Set<string>(cfg.devices.map((d:any)=>d.shellyId).filter(Boolean))];return json(ids.length?await shellyStatus(env,ids):[]);}
      if(path==="/api/config"&&req.method==="GET")return json(await config(env));
      if(path==="/api/config"&&req.method==="PUT"){const cfg=validateConfig(await req.json());await env.DB.batch([env.DB.prepare("UPDATE config SET body=? WHERE id=1").bind(JSON.stringify(cfg)),env.DB.prepare("DELETE FROM rule_state")]);return json({ok:true});}
      if(path==="/api/history"&&req.method==="GET")return json((await env.DB.prepare("SELECT * FROM history ORDER BY id DESC LIMIT 100").all()).results);
      if(path==="/api/simulate"&&req.method==="POST"){const input=await req.json() as any;validateConfig({devices:[input.device],rules:input.rules});return json(evaluate(input));}
      return json({error:"Not found"},404);
    }catch(e){return json({error:"Invalid request or database error"},400);}
  },
  async scheduled(_event:ScheduledController,env:Env){await tick(env);}
} satisfies ExportedHandler<Env>;
