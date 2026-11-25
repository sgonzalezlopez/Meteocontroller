export async function getWeather(lat:string,lon:string){
  if(!lat||!lon||!Number.isFinite(Number(lat))||!Number.isFinite(Number(lon))||Math.abs(Number(lat))>90||Math.abs(Number(lon))>180)throw new Error("Invalid location");
  const url=new URL("https://api.open-meteo.com/v1/forecast");
  url.search=new URLSearchParams({latitude:lat,longitude:lon,current:"temperature_2m,cloud_cover,rain,wind_speed_10m,wind_gusts_10m,shortwave_radiation",hourly:"temperature_2m,cloud_cover,rain,wind_speed_10m,wind_gusts_10m,shortwave_radiation,precipitation_probability",forecast_days:"2",timezone:"GMT",wind_speed_unit:"kmh"}).toString();
  const res=await fetch(url,{signal:AbortSignal.timeout(10000)});
  if(!res.ok)throw new Error("Weather HTTP "+res.status);
  const data=await res.json() as any; const c=data.current;
  if(!c||typeof c.time!=="string")throw new Error("Missing weather");
  const observed=Date.parse(c.time+"Z"), now=Date.now();
  if(!Number.isFinite(observed)||observed>now+900000||now-observed>1800000)throw new Error("Stale weather");
  const h=data.hourly; const forecast=Array.isArray(h?.time)?h.time.map((t:string,i:number)=>({at:Date.parse(t+"Z"),wind:h.wind_speed_10m?.[i],gust:h.wind_gusts_10m?.[i],rain:h.rain?.[i],solar:h.shortwave_radiation?.[i],temperature:h.temperature_2m?.[i],cloud:h.cloud_cover?.[i],rainProbability:h.precipitation_probability?.[i]})).filter((x:any)=>x.at>now&&x.at<=now+86400000):[];
  return {forecast,fetchedAt:now,observedAt:observed,wind:c.wind_speed_10m,gust:c.wind_gusts_10m,rain:c.rain,solar:c.shortwave_radiation,temperature:c.temperature_2m,cloud:c.cloud_cover};
}
