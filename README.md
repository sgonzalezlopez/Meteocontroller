# Meteocontroller
Automatización meteorológica de toldos Shelly en Cloudflare Workers. MVP en observación: nunca envía órdenes físicas.

## Desarrollo
Node 22+. npm install, npm test, npm run dev. Crear una D1 con npx wrangler d1 create meteocontroller, sustituir database_id en wrangler.jsonc, aplicar migraciones con npx wrangler d1 migrations apply meteocontroller --local (o --remote). Configurar LOCATION_LAT, LOCATION_LON y TIMEZONE. Configurar ADMIN_TOKEN con wrangler secret put ADMIN_TOKEN (en local, .dev.vars). No publicar sin autenticación. npm run deploy después de validar.

Configurar los toldos y reglas mediante PUT /api/config con Authorization: Bearer TOKEN. GET /api/config y GET /api/history consultan configuración e histórico. POST /api/simulate acepta {weather, device, rules, now, timezone, maxAgeMs}. El cron evalúa cada minuto, reutiliza información meteorológica durante cinco minutos y registra cambios de decisión. Los estados de dispositivos son manuales en esta fase: no representan telemetría real.

## Pendiente
Verificar API Shelly Cloud y modelos, integrar lectura de posición y órdenes verificadas, bloqueo de recuperación tras riesgo, editor web y notificaciones. Ningún umbral por defecto se considera seguro; configurar según fabricante. No sustituye protección física. Un fallo de Internet impide actuar.
