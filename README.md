# Meteocontroller
Automatización meteorológica de toldos Shelly en Cloudflare Workers. MVP en observación: nunca envía órdenes físicas.

## Desarrollo
Node 22+. npm install, npm test, npm run dev. Crear una D1 con npx wrangler d1 create meteocontroller, sustituir database_id en wrangler.jsonc, aplicar migraciones con npx wrangler d1 migrations apply meteocontroller --local (o --remote). Configurar LOCATION_LAT, LOCATION_LON y TIMEZONE. Configurar ADMIN_TOKEN con wrangler secret put ADMIN_TOKEN (en local, .dev.vars). No publicar sin autenticación. npm run deploy después de validar.

Configurar los toldos y reglas mediante PUT /api/config con Authorization: Bearer TOKEN. GET /api/config y GET /api/history consultan configuración e histórico. POST /api/simulate acepta {weather, device, rules, now, timezone, maxAgeMs}. El cron evalúa cada minuto, reutiliza información meteorológica durante cinco minutos y registra cambios de decisión. Los estados de dispositivos son manuales en esta fase: no representan telemetría real.

## Pendiente
Verificar API Shelly Cloud y modelos, integrar lectura de posición y órdenes verificadas, bloqueo de recuperación tras riesgo, editor web y notificaciones. Ningún umbral por defecto se considera seguro; configurar según fabricante. No sustituye protección física. Un fallo de Internet impide actuar.

## Second iteration
Open / for the responsive editor. The admin token remains in memory only. Configure SHELLY_HOST and SHELLY_AUTH_KEY as secrets; the status endpoint reads up to ten devices using Shelly Cloud v2. Hourly forecast conditions support any/all over 60–720 minutes. No physical control yet. The status query is manual, not scheduled. Forecast intervals are hourly, not real-time measurements. Remaining: calibrated live control, recovery lock, season profiles, notifications, deployment and integration verification.
