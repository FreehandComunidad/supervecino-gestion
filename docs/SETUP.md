# Puesta en marcha — SÚPERVECINO GESTIÓN

## Estado del alcance

La primera entrega implementa el POS interno: autenticación Supabase, consulta del catálogo, carrito, descuentos en pesos, un medio de pago por venta, apertura/cierre de caja y registro transaccional con actualización de stock. No emitir comprobantes fiscales todavía.

## Requisitos

- Node.js 22 LTS y npm.
- Proyecto Supabase de SÚPERVECINO: `mwpnagwjeqyibwmvcvel`.
- Acceso de administrador al proyecto y a GitHub.

## Configuración local

1. Clonar `https://github.com/FreehandComunidad/supervecino-gestion`.
2. Ejecutar `npm install`.
3. Copiar `.env.example` a `.env.local`.
4. Completar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` desde Supabase > Connect.
5. Ejecutar `npm run dev` y abrir http://localhost:3000.

## Crear el primer usuario propietario

1. En Supabase Dashboard > Authentication > Users, crear el usuario con el correo y contraseña que utilizará el propietario.
2. Abrir SQL Editor y ejecutar el contenido de `supabase/bootstrap_owner.sql`, reemplazando `REEMPLAZAR_POR_TU_CORREO` por ese correo exacto.
3. Confirmar que exista una fila en `public.profiles` con `role='owner'` y `active=true`.
4. Ingresar en la aplicación.

No se debe habilitar el registro público de usuarios. Los demás empleados se crean desde Authentication y reciben su perfil con rol `cashier` o `manager` mediante un proceso administrativo.

## Catálogo

La tabla `public.products` debe cargarse con productos reales, precios, códigos de barras, unidades y stock antes de operar. No se crean productos de prueba en la base de producción.

## Verificación antes de operar

- Ejecutar `npm run typecheck`, `npm run lint`, `npm run build` y `npm audit --audit-level=high`.
- Probar login/logout, caja, venta de prueba con producto de prueba, actualización de stock, venta sin stock, descuento inválido, pago incorrecto y cierre de caja en un entorno separado.
- No usar el negocio en producción hasta completar esas pruebas con una cuenta real y catálogo de prueba.
- Configurar copias de seguridad y un proveedor de hosting con variables de entorno seguras.

## Pendiente fuera del POS inicial

Compras, proveedores, cuentas corrientes, reportes, devoluciones/anulaciones, usuarios administrables desde la app, impresión térmica, integración fiscal ARCA (certificados, punto de venta, homologación y pruebas), auditoría ampliada y despliegue productivo.
