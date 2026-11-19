# SÚPERVECINO GESTIÓN

Sistema web de gestión comercial para SÚPERVECINO.

## Módulo en desarrollo

El primer módulo es el punto de venta (POS):
- Inicio de sesión con Supabase Auth y perfiles activos.
- Búsqueda por nombre, SKU y código de barras; lector de barras con Enter.
- Alta de productos para propietario/encargado, carrito, cantidades, precios consultados en base de datos y descuento en pesos.
- Medios de pago (un medio por operación en esta primera entrega).
- Apertura y cierre de caja.
- Registro atómico de ventas, pagos y movimientos de stock.

## Tecnologías

- Next.js 15.5.29 / React 19.2.4 / TypeScript
- Supabase Auth + PostgreSQL + RLS
- Node.js 22

## Importante

**No está autorizado todavía para ventas reales.** El proyecto de base de datos no tiene usuarios/perfiles ni productos cargados y falta ejecutar las pruebas end-to-end con una cuenta real. El flujo fiscal ARCA no está implementado. No se debe emitir un comprobante fiscal con este sistema.

## Configuración

Ver [guía de instalación y puesta en marcha](docs/SETUP.md).

## Calidad

GitHub Actions ejecuta auditoría de dependencias, tests unitarios, TypeScript, ESLint y build de producción en cada push a `main`.

Las pruebas unitarias iniciales cubren cálculos monetarios. No sustituyen pruebas de integración reales contra Supabase.
