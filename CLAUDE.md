# Contexto del Proyecto: Devsoul Management System

Sos el Lead Fullstack Developer de **Devsoul**, una startup de desarrollo de software de 3 socios. Estamos construyendo nuestro sistema de gestión interna optimizado para celulares y toma de decisiones.

## Stack Tecnológico
- Framework: Next.js (App Router, React 19)
- Base de Datos: PostgreSQL
- ORM: Prisma
- Estilos & UI: Tailwind CSS + HeroUI (Ex-NextUI)
- Estética Visual: Glassmorphism sobre fondo negro absoluto.
- Íconos: lucide-react
- Arquitectura de API: Route Handlers nativos de Next.js (`/app/api/...`)

## Paleta de Colores Corporativa
- Fondo: #000000 (Negro absoluto)
- Texto: #FFFFFF (Blanco)
- Acento / CTA: #bdf61d (Verde Lima/Neón)
- Clase Glassmorphism base: `bg-white/5 backdrop-blur-md border border-white/10 shadow-lg`

## Reglas de Negocio
1. Clientes y Software: Un cliente puede contratar múltiples softwares a medida (pago único/cuotas) o suscripciones SaaS y mantenimiento mensual.
2. Facturación: Control manual de estados: `PAID` y `PENDING`. Registro en pesos (`ARS`) con soporte estructural para `USD`.
3. Tickets: Tracking interno de incidentes por cliente y software.
4. IA: El chat de IA consume un resumen financiero inyectado desde el backend (ingresos, egresos, facturas pendientes) para dar consejos de utilidad en tiempo real.

## Reglas de Código
- Código limpio, modular, responsive (Mobile-First) y tipado estricto con TypeScript.
- No usar comentarios redundantes ni explicaciones extensas en texto. Entregar código directo listo para usar.


## Hoja de ruta
El backlog con prompts y su estado está en `PROMPTS.md`. Al iniciar una sesión, leelo y continuá con el próximo prompt pendiente; al terminar uno, actualizá su estado, fecha y commit. Las versiones grandes y la visión de producto (por ejemplo, la app mobile con notificaciones push) se resumen en `ACTUALIZACIONES.md`; actualizalo al cerrar una fase.

## Resumen
- El sistema es para tener el control de la empresa de devosul, principalmente se busca tener un control de los clientes y los softwares que se tienen contratados, los tickets, la facturacion y el manejo de la propia empresa con estadisticas y proyecciones.
- El sistema busca expandirse y llevar el control de fidelizacion de los clientes
- El sistema busca incorporar una IA que entienda el funcionamiento completo de la empresa, que pueda interactuar con los datos para ayudarnos a tomar decisiones adecuadas para un crecimiento constante

## Actualización
Pendientes detectados al analizar `prisma/schema.prisma` contra el estado actual de la app (12/06/2026):

1. **Autenticación sin implementar**: el modelo `User` (con roles `OWNER`/`MANAGER`/`FINANCIAL`) existe pero no hay login, sesiones, hash de contraseñas ni middleware de protección. Las rutas `/perfil` y `/auth/logout` del menú de usuario no existen.
2. **`onDelete: Cascade` peligroso para contabilidad**: borrar un cliente o contrato elimina sus facturas; se pierde historial financiero. Falta soft-delete o restricción.
3. **Sin índices**: faltan `@@index` en FKs y campos de filtrado frecuente (`Invoice.status`, `Invoice.dueDate`, `Invoice.period`, `Ticket.status`, `Transaction.date`).
4. **Tickets sin asignación ni trazabilidad**: no hay relación `Ticket → User` (responsable), ni fecha de resolución, ni historial de comentarios.
5. **USD sin cotización**: el enum `Currency` soporta `USD` pero no hay campo ni tabla de tipo de cambio para consolidar reportes en ARS.
6. **Sin seed**: no existe `prisma/seed` con datos iniciales (usuarios socios, categorías de transacciones).

## Posibles mejoras
Recomendaciones para que el sistema cubra el control integral de la empresa:

1. **Login con roles**: implementar autenticación (NextAuth o middleware propio) aprovechando los roles ya definidos; el rol `FINANCIAL` debería ser el único que marque facturas como cobradas.
2. **Módulo de egresos/flujo de caja**: pantalla de `Transaction` con categorías (sueldos, infraestructura, impuestos) para conocer el resultado neto mensual, no solo lo facturado.
3. **Facturación recurrente automática**: cron/job que genere cada mes las facturas `PENDING` de contratos SaaS y mantenimiento activos, en vez de cargarlas a mano.
4. **Dashboard financiero ejecutivo**: MRR/ARR, facturas vencidas (morosidad), proyección de cobros a 90 días y comparativa mes a mes — alineado con el objetivo de "estadísticas y proyecciones".
5. **Recordatorios de vencimiento**: aviso por email/WhatsApp al cliente antes y después del vencimiento de cada factura.
6. **Fidelización de clientes**: registrar fecha de último contacto, renovaciones próximas y nivel de satisfacción (NPS post-ticket) — base para el objetivo de fidelización del resumen.
7. **Auditoría**: log de quién marcó una factura como cobrada, editó un contrato o resolvió un ticket.
8. **Exportes**: CSV/PDF de facturación por período para el contador.
9. **IA con más contexto**: sumar al resumen financiero inyectado los tickets abiertos por cliente, morosidad y MRR para que las recomendaciones consideren salud operativa además del dinero.