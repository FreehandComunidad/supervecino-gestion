# Configuración segura de FASE 1

## Pruebas cloud

- GitHub Actions levanta una instancia Supabase efímera dentro de un runner.
- Las migraciones y fixtures son sintéticos; no se descargan datos de producción.
- El workflow no recibe SUPABASE_ACCESS_TOKEN, DB_PASSWORD ni credenciales remotas.
- El runner se destruye al finalizar cada ejecución.
- Vercel Preview de `security/phase-1-hardening` usa variables ficticias y no puede conectarse al proyecto productivo.

## Clave de respuestas del juego

La Edge Function `cryptic-score` requiere la variable secreta `CRYPTIC_ANSWERS_JSON`.
No se guarda en GitHub ni en el código fuente.

Formato esperado:

```json
{
  "1": "RESPUESTA_ETAPA_1",
  "2": "RESPUESTA_ETAPA_2"
}
```

Para configurar el valor productivo, una vez aprobada la auditoría:

1. Abrir Supabase Dashboard del proyecto.
2. Ir a Edge Functions → Secrets.
3. Crear `CRYPTIC_ANSWERS_JSON` con el mapa de respuestas entregado por el propietario.
4. Desplegar la Edge Function solo después de una autorización explícita.

Si la variable no está configurada, la función devuelve HTTP 503 de forma segura y no acredita puntos.

## Límite actual

El reinicio del ranking conserva todos los registros de participantes y pone los puntos en cero. El acceso requiere una sesión Supabase autenticada con perfil activo de rol `owner`.

No se deben desplegar migraciones ni funciones de esta rama en producción antes de completar la auditoría independiente y recibir autorización del propietario.

## Respaldo automático: alcance de la verificación

El workflow excluye servicios no utilizados (Auth, Realtime, Storage, Studio, Mail y Analytics), pero conserva PostgreSQL, REST y el runtime de Edge Functions. Las migraciones y pgTAP se ejecutan en la base efímera; la Edge Function se valida con `deno check`.

La base efímera de GitHub Actions se reconstruye desde las migraciones versionadas y fixtures sintéticos. **No es una restauración del backup físico automático de producción** y no demuestra por sí sola que ese backup pueda restaurarse.

No se descargan ni copian datos de producción al runner. No se configura una conexión remota de Supabase en los workflows.

La restauración del backup automático en un proyecto Supabase separado requiere una opción de restauración a proyecto nuevo y puede generar costos de infraestructura. No se creó ningún proyecto o rama de Supabase para esta fase.

## Bloqueo de migraciones de producción

La historia de migraciones registrada en producción no coincide completamente con los archivos SQL versionados en este repositorio. La base de CI valida la cadena que sí está en GitHub, no una réplica completa del esquema productivo. No ejecutar `supabase db push`, `supabase migration repair` ni aplicar estas migraciones en producción hasta reconciliar esa diferencia mediante una revisión independiente.
