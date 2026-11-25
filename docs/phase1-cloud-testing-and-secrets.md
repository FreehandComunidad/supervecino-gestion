# Pruebas cloud y límites de seguridad — FASE 1

## Regla operativa

No se requiere instalar Docker Desktop, Supabase CLI, terminal ni programas en la computadora del propietario. Todo se ejecuta en GitHub Actions sobre un runner descartable.

## Arquitectura de pruebas

1. GitHub Actions descarga el repositorio y crea un workspace temporal bajo `$RUNNER_TEMP`.
2. Copia los tres archivos de baseline y el usuario owner sintético de `supabase/ci/bootstrap/` y las migraciones históricas versionadas más las nuevas de FASE 1.
3. Inicia una instancia local/efímera de Supabase en el runner con PostgreSQL, Auth y REST. No inicia Storage, Realtime, Studio, Mail ni Analytics.
4. Reconstruye la base desde cero y ejecuta pgTAP.
5. Obtiene claves efímeras locales del propio CLI y las pasa al proceso de prueba. Las claves no son de producción ni se guardan como secretos del repositorio.
6. Ejecuta pruebas de navegador Playwright contra Next.js y Supabase locales: POS, caja, compras, pagos, gastos, permisos y autorización del asistente.
7. Detiene el stack. El runner y su base se descartan al terminar el job.

El workflow falla si encuentra un token remoto de Supabase o metadatos de proyecto enlazado en el checkout. No configura una conexión a producción.

## Qué cubre

- RLS y lecturas por rol: propietario, encargado y cajero.
- Intentos directos del cajero de ejecutar RPC de compras, recepción, pagos a proveedores y ajuste de stock.
- Perfiles inactivos: deben quedar denegados aunque el JWT sea válido.
- Caja compartida: apertura, ingresos, egresos, venta en efectivo, pagos no efectivos, cierre y conciliación.
- POS: descuentos, producto con stock, producto que no administra stock, reintentos y llamadas concurrentes con la misma clave idempotente.
- Compras: creación, recepción única, actualización de stock/costo, pagos parciales, cancelación del saldo y prevención de sobrepago.
- Gastos operativos y lectura de reportes.
- Asistente central: el cajero debe recibir 403; el encargado supera la autorización, pero el proveedor de IA está deliberadamente deshabilitado en CI para evitar llamadas externas o costos.
- La nota de interfaz del asistente aclara que el margen mostrado es bruto/estimado y que los gastos operativos no se incluyen en un cálculo de ganancia neta.

## Backups: alcance real de la prueba

La reconstrucción de CI no es una restauración del backup físico automático de producción. Verifica que la base de pruebas puede construirse desde el baseline de CI y el SQL versionado.

La existencia del backup automático se había confirmado previamente, pero no se comprobó desde esta fase su fecha, integridad ni restaurabilidad física. No se descargaron backups ni datos productivos. La restauración física en un proyecto independiente puede requerir un plan o recursos pagos y no se hará sin autorización expresa.

## Vercel

No se ejecuta ningún deploy desde este workflow. El Preview que pueda generar automáticamente la integración Git de Vercel no se utiliza como base de datos de pruebas: sus variables de Supabase son ficticias. Las pruebas comerciales usan la instancia efímera de GitHub Actions.

## Límites para producción

- No ejecutar `db push`, `migration repair` ni SQL de FASE 1 en producción.
- No copiar usuarios, ventas, clientes, proveedores, compras ni otros datos productivos al runner.
- No agregar claves remotas a GitHub Actions.
- No integrar el PR hasta revisar el documento `docs/migration-reconciliation.md` y recibir la autorización del propietario.
