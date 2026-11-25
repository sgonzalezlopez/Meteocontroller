export interface ShellyEnv {SHELLY_HOST?:string;SHELLY_AUTH_KEY?:string}
export async function shellyStatus(env:ShellyEnv,ids:string[]){
  if(!env.SHELLY_HOST||!env.SHELLY_AUTH_KEY)throw new Error("Shelly not configured");
  if(!/^[a-z0-9-]+\.shelly\.cloud$/i.test(env.SHELLY_HOST))throw new Error("Invalid Shelly host");
  if(!ids.length||ids.length>10||ids.some(id=>! /^[a-f0-9]{6,16}$/i.test(id)))throw new Error("Invalid device IDs");
  const url=new URL("https://"+env.SHELLY_HOST+"/v2/devices/api/get");
  url.searchParams.set("auth_key",env.SHELLY_AUTH_KEY);
  const res=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ids,select:["status"]}),redirect:"error",signal:AbortSignal.timeout(10000)});
  if(!res.ok)throw new Error("Shelly HTTP "+res.status);
  const rows=await res.json() as any;
  if(!Array.isArray(rows))throw new Error("Unexpected Shelly response");
  return rows.map(x=>({id:x.id,online:x.online===1,gen:x.gen,cover:x.status?.["cover:0"]??x.status?.rollers?.[0]??null}));
}
