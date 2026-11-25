# Reconciliación del historial de migraciones — SÚPERVECINO GESTIÓN

## Fuente y método

Se consultó en modo de solo lectura `supabase_migrations.schema_migrations` del proyecto Supabase productivo, incluyendo `version`, `name` y `statements`. Se comparó con el árbol de `main` y con el esquema actual de tablas, funciones, restricciones y políticas.

**No se ejecutó SQL de escritura, `db push`, `migration repair`, restauración ni despliegue.**

## Correspondencia de las 13 migraciones registradas en producción

Los archivos actuales en `supabase/migrations/` se reconstruyeron con el SQL guardado en la propia tabla `schema_migrations`, usando las versiones reales. La tabla indica cómo estaban representados en el repositorio antes de esta reconciliación.

| Versión productiva | Nombre registrado | Representación anterior en GitHub | Estado actual |
|---|---|---|---|
| `20261119014539` | `sales_cash_history_product_subcategories` | `202611180002_sales_cash_history_product_subcategories.sql` | Restaurada con versión y SQL registrados |
| `20261119014933` | `product_price_history_audit` | `202611180003_product_price_history.sql` | Restaurada con versión y SQL registrados |
| `20261119015245` | `fix_profiles_rls_recursion` | `202611180004_fix_profiles_rls_recursion.sql` | Restaurada con versión y SQL registrados |
| `20261119015736` | `product_vat_and_price_list_import` | `202611180005_product_vat_and_price_list_import.sql` | Restaurada con versión y SQL registrados |
| `20261119021956` | `oasis_hq_multi_business_foundation` | Ausente | Incorporada desde el historial remoto |
| `20261119022019` | `oasis_hq_secure_membership_helpers` | Ausente | Incorporada desde el historial remoto |
| `20261119022121` | `restrict_price_audit_trigger_execution` | Ausente | Incorporada desde el historial remoto |
| `20261119022258` | `oasis_agent_conversation_link` | Ausente | Incorporada desde el historial remoto |
| `20261124141533` | `pet_food_product_brand_and_presentation` | `202611240001_pet_food_product_brand_presentation.sql` | Restaurada con versión y SQL registrados |
| `20261124141722` | `secure_inventory_adjustment_rpc` | `202611240002_secure_inventory_adjustment.sql` | Restaurada con versión y SQL registrados |
| `20261124144247` | `atomic_multi_item_purchases` | `202611240004_atomic_multi_item_purchases.sql` | Restaurada con versión y SQL registrados |
| `20261125062010` | `operating_expenses_tracking` | `202611250001_operating_expenses_tracking.sql` | Restaurada con versión y SQL registrados |
| `20261125062201` | `supplier_payment_tracking` | `202611250002_supplier_payment_tracking.sql` | Restaurada con versión y SQL registrados |

Los cuatro registros que faltaban en el árbol anterior ya están representados, incluidas las tres migraciones OASIS. En las migraciones de historial, el SQL se tomó de `statements` de Supabase; no se inventaron equivalencias.

## Archivos del repositorio que no aparecen en el historial remoto

Estos tres archivos existían en `main`, pero no tienen una versión correspondiente en `supabase_migrations.schema_migrations`:

1. `202611170001_initial_schema.sql`
2. `202611180001_pos_security_cash.sql`
3. `202611240003_supplier_purchasing.sql`

El esquema productivo sí contiene las estructuras comerciales relacionadas —incluidas caja, compras, proveedores y funciones POS—, pero no se puede demostrar desde el historial que esos archivos sean el SQL histórico exacto que se ejecutó. Por eso se movieron a:

- `supabase/ci/bootstrap/00000000000001_initial_schema.sql`
- `supabase/ci/bootstrap/00000000000002_pos_security_cash.sql`
- `supabase/ci/bootstrap/00000000000003_supplier_purchasing.sql`

Son una base de reconstrucción para pruebas aisladas. **No forman parte de las 13 migraciones productivas ni deben aplicarse a producción.** El archivo de compras/proveedores es una reconstrucción desde el repositorio y debe seguir identificado como tal hasta que se pueda contrastar con el SQL original.

## Migraciones nuevas de FASE 1

Después de la última versión registrada en producción (`20261125062201`), la rama contiene las migraciones nuevas:

- `20261125100001_phase1_role_access.sql`
- `20261125100002_phase1_pos_idempotency.sql`
- `20261125100003_phase1_stock_transaction_hardening.sql`
- `20261125100004_cash_movement_workflow.sql`

Estas son propuestas nuevas, no migraciones ya aplicadas en producción.

## Reconstrucción aislada en GitHub Actions

El workflow crea un directorio temporal fuera del árbol de producción y copia, en este orden:

1. Los tres archivos `supabase/ci/bootstrap/`, con versiones sintéticas locales.
2. Las 13 migraciones históricas exactas y versionadas.
3. Las cuatro migraciones nuevas de FASE 1.
4. Las suites pgTAP.

Supabase CLI inicia PostgreSQL, Auth y REST en el runner. `db reset` y pgTAP trabajan únicamente contra esa instancia efímera. Los usuarios, productos, compras y ventas de prueba son sintéticos. No se copia ni consulta información productiva durante la ejecución de CI.

## Bloqueo antes de integrar o desplegar

Aunque el historial de 13 migraciones ya está representado versión por versión, la base inicial y la migración de proveedores no tienen registro remoto. Antes de cualquier integración que habilite un `db push` o despliegue de SQL hay que acordar y revisar el baseline de producción, verificar los objetos actuales contra ese baseline y decidir cómo registrar formalmente los cambios históricos no versionados.

Hasta entonces:

- No ejecutar `supabase db push` contra producción.
- No ejecutar `supabase migration repair`.
- No mover los archivos de `supabase/ci/bootstrap/` a `supabase/migrations/`.
- No aplicar ninguna migración de FASE 1 en el proyecto productivo.
