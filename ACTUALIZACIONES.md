# Actualizaciones: Devsoul Gestión

Registro de las actualizaciones grandes del sistema: qué se está construyendo, qué viene y por qué. El detalle de cada tarea y su prompt está en `PROMPTS.md`.

Estados: 🟢 terminado · 🟡 en curso · ⚪ planificado

---

## 🟢 v0.7: Gestión de clientes (Fase 7)

**Objetivo:** tener la foto completa de cada cliente y no olvidar ningún cobro ni seguimiento.

- **Proyectos por cliente:** un cliente tiene varios proyectos y cada proyecto, varios componentes (web, app móvil, backend, panel admin, integraciones). Un componente puede apuntar a un software del catálogo, por ejemplo un SaaS propio, y guarda la URL, el repo y notas. Los contratos y los tickets se pueden asociar a un proyecto.
- **Recordatorios internos:** cobrar, enviar un mensaje, llamar, reunión, renovación o seguimiento. Tienen responsable, fecha y repetición (semanal, mensual o anual) y se pueden vincular a un cliente, un proyecto o una factura. Todos los días a la mañana, cada responsable recibe por email un resumen con sus recordatorios vencidos y los del día.
- **Ficha del cliente:** proyectos y componentes, recordatorios, facturación (pendiente, vencida y cobrada), tickets abiertos e historial de interacciones (llamadas, emails, WhatsApp, reuniones y notas), con la fecha del último contacto.

---

## ⚪ v0.8: App mobile y notificaciones push (Fase 8)

**Objetivo:** que los socios usen el sistema desde el celular como una app y reciban avisos al instante, sin depender del email.

### Enfoque recomendado: PWA instalable con Web Push

El sistema ya es mobile-first, así que lo más rápido y barato es convertirlo en una **Progressive Web App**:

- **Un solo código:** no hay que mantener una app aparte. Cada deploy en Vercel actualiza también la app.
- **Se instala desde el navegador:** en Android, desde Chrome con "Instalar app". En iPhone, desde Safari con "Compartir" → "Agregar a inicio", lo que requiere iOS 16.4 o posterior. Queda con ícono propio, pantalla completa y sin la barra del navegador.
- **Push nativo:** usa el estándar Web Push con claves VAPID, sin servicios pagos. Las notificaciones llegan aunque la app esté cerrada.
- **Sin tiendas:** no hace falta publicar en Play Store ni App Store. Es una herramienta interna de 3 socios.

> Si más adelante se quiere publicar en las tiendas, por ejemplo para darles una app a los clientes, la PWA se puede empaquetar con **Capacitor**, o se puede armar una app **Expo / React Native** que consuma la misma API. Eso queda como v0.9 opcional.

### Qué se va a construir

1. **PWA:**
   - `app/manifest.ts` con nombre, íconos en fondo negro con acento `#bdf61d`, `display: standalone` y atajos a Recordatorios, Facturación y Tickets.
   - Service worker, para que funcione la instalación, haya una pantalla offline básica y se reciban las notificaciones push.
   - Botón "Instalar app" en el perfil y una guía para iPhone.
2. **Notificaciones push:**
   - Modelo `PushSubscription` (usuario, endpoint, claves y dispositivo), con alta y baja desde **Perfil → Notificaciones**.
   - Nuevo canal `PUSH` en `NotificationChannel`, que se suma a la interfaz `Notifier` que ya existe (`lib/notifications`). El envío usa la librería `web-push` con `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT`.
   - Preferencias por usuario: qué avisos recibe y por qué canal (push, email o ambos).
   - Al tocar una notificación, se abre directamente la pantalla correspondiente: el recordatorio, la factura o el ticket.
3. **Avisos que se van a mandar:**

   | Evento | A quién |
   | --- | --- |
   | Recordatorio que vence hoy o está vencido | Responsable |
   | Recordatorio asignado por otro socio | Responsable |
   | Factura cobrada | Socios `OWNER` y `FINANCIAL` |
   | Factura vencida sin cobrar | Socios `OWNER` y `FINANCIAL` |
   | Ticket nuevo de prioridad alta | Todos, o el responsable cuando exista P5.1 |
   | Facturas recurrentes generadas | Socios `OWNER` |

### Requisitos y límites

- En iPhone, las notificaciones push solo funcionan si la app está instalada en la pantalla de inicio (iOS 16.4 o posterior).
- La app requiere HTTPS, algo que Vercel ya cubre. En desarrollo funciona en `localhost`.
- Las claves VAPID se generan una sola vez con `npx web-push generate-vapid-keys` y se cargan en Vercel.

---

## Historial

| Versión | Fecha | Contenido |
| --- | --- | --- |
| 🟢 v0.1 | 12/06/2026 | Scaffold, schema inicial, CRUD de clientes, softwares, contratos, facturación, tickets y finanzas, dashboard y chat de IA. |
| 🟢 v0.2 | 25/09/2026 | Login con roles, soft-delete, índices y seed. |
| 🟢 v0.3 | 25/09/2026 | Cuentas financieras, categorías, transferencias y cotización USD. |
| 🟢 v0.4 | 25/09/2026 | Facturación recurrente y recordatorios de vencimiento por email. |
| 🟢 v0.7 | 09/11/2026 | Proyectos, recordatorios internos y ficha del cliente. |
| ⚪ v0.8 | — | PWA y notificaciones push. |
