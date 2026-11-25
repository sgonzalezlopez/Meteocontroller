// Pure decision engine. Position convention: 0 retracted, 100 extended.
const metrics = new Set(["wind","gust","rain","rainProbability","solar","temperature","cloud"]);
export function evaluateCondition(c, weather) {
  if (!c || typeof c !== "object") return null;
  if (c.op === "and" || c.op === "or") {
    if (!Array.isArray(c.children) || !c.children.length) return null;
    const values=c.children.map(x=>evaluateCondition(x,weather));
    return c.op==="and" ? (values.includes(false)?false:values.includes(null)?null:true)
      : (values.includes(true)?true:values.includes(null)?null:false);
  }
  if (!metrics.has(c.metric)) return null;
  const value=weather[c.metric];
  if (!Number.isFinite(value)||!Number.isFinite(c.value)) return null;
  switch(c.op){case "gt":return value>c.value;case "gte":return value>=c.value;case "lt":return value<c.value;case "lte":return value<=c.value;case "eq":return value===c.value;default:return null;}
}
export function inSchedule(schedule, now, timezone) {
  if (!schedule) return true;
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:timezone,weekday:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now).map(p=>[p.type,p.value]));
  const day=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].indexOf(parts.weekday);
  const time=parts.hour+":"+parts.minute;
  const {start,end,days}=schedule;
  if(start===end)return days.includes(day);
  if(start<end)return days.includes(day)&&time>=start&&time<end;
  return (days.includes(day)&&time>=start)||(days.includes((day+6)%7)&&time<end);
}
export function evaluate({device,rules,weather,now=Date.now(),timezone="Europe/Madrid",maxAgeMs=900000,since={}}) {
  const state={};
  const result=(position,reason,ruleId=null)=>({position,reason,ruleId,since:state});
  if(!weather||!Number.isFinite(weather.fetchedAt)||weather.fetchedAt>now||now-weather.fetchedAt>maxAgeMs)return result(0,"weather_unavailable");
  const candidates=[];
  let unknownSafety=false;
  for(const r of rules){
    if(!r.enabled||!r.targets.includes(device.id))continue;
    if(!r.safety&&!inSchedule(r.schedule,new Date(now),timezone))continue;
    if(!r.safety&&device.mode!=="auto")continue;
    const condition=evaluateCondition(r.condition,weather);
    if(condition===null&&r.safety)unknownSafety=true;
    if(condition!==true)continue;
    state[r.id]=Number.isFinite(since[r.id])&&since[r.id]<=now?since[r.id]:now;
    if(r.safety||now-state[r.id]>=r.durationMs)candidates.push(r);
  }
  if(unknownSafety)return result(0,"safety_data_missing");
  candidates.sort((a,b)=>Number(b.safety)-Number(a.safety)||b.priority-a.priority||a.position-b.position||a.id.localeCompare(b.id));
  const winner=candidates[0];
  if(!winner)return result(null,"hold");
  if(winner.position>0&&!rules.some(r=>r.enabled&&r.safety&&r.targets.includes(device.id)))return result(null,"no_safety_rule");
  return result(winner.safety?0:winner.position,"rule",winner.id);
}
export function validateConfig(config){
  const check=(b,m)=>{if(!b)throw new Error(m);};
  check(config&&Array.isArray(config.devices)&&Array.isArray(config.rules),"Invalid config");
  check(config.devices.length<=20&&config.rules.length<=100,"Configuration too large");
  const ids=new Set();
  for(const d of config.devices){check(typeof d.id==="string"&&/^[a-zA-Z0-9_-]{1,64}$/.test(d.id)&&!ids.has(d.id),"Invalid device id");ids.add(d.id);check(["auto","manual","paused"].includes(d.mode),"Invalid mode");}
  const rids=new Set();
  function condition(c,depth=0){check(c&&depth<6,"Invalid condition");if(["and","or"].includes(c.op)){check(Array.isArray(c.children)&&c.children.length>0&&c.children.length<=20,"Invalid group");c.children.forEach(x=>condition(x,depth+1));}else{check(metrics.has(c.metric)&&["gt","gte","lt","lte","eq"].includes(c.op)&&Number.isFinite(c.value),"Invalid comparison");}}
  for(const r of config.rules){check(typeof r.id==="string"&&/^[a-zA-Z0-9_-]{1,64}$/.test(r.id)&&!rids.has(r.id),"Invalid rule id");rids.add(r.id);check(typeof r.enabled==="boolean"&&typeof r.safety==="boolean","Invalid flags");check(Array.isArray(r.targets)&&r.targets.length>0&&r.targets.every(x=>ids.has(x)),"Invalid targets");check(Number.isInteger(r.priority)&&r.priority>=0&&r.priority<=100,"Invalid priority");check(Number.isFinite(r.position)&&r.position>=0&&r.position<=100&&(!r.safety||r.position===0),"Invalid position");check(Number.isInteger(r.durationMs)&&r.durationMs>=0&&r.durationMs<=86400000,"Invalid duration");if(r.schedule){const s=r.schedule;check(/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(s.start)&&/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(s.end)&&Array.isArray(s.days)&&s.days.every(x=>Number.isInteger(x)&&x>=0&&x<=6),"Invalid schedule");}condition(r.condition);}
  return config;
}
