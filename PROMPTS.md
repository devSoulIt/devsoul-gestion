# Hoja de ruta con prompts: Devsoul Gestión

Este archivo es el backlog vivo del sistema. Cada bloque trae un prompt listo para pegar en una sesión nueva de Claude Code.

## Cómo usarlo en cada sesión

1. Empezar la sesión con: `Leé CLAUDE.md y PROMPTS.md y continuá con el próximo prompt pendiente.`
2. Los prompts se ejecutan en orden, porque cada uno puede depender de los anteriores (se indica en **Depende de**).
3. Al terminar un prompt:
   - Cambiar su estado a `[x]` y completar **Fecha** y **Commit**.
   - Anotar en **Notas** cualquier decisión tomada o algo que haya quedado a medias.
   - Si surge trabajo nuevo, agregarlo como prompt al final de la sección que corresponda.
4. Estados: `[ ]` pendiente · `[~]` en curso o parcial · `[x]` terminado · `[-]` descartado.

---

## Ya implementado (base al 25/09/2026)

- [x] Scaffold de Next.js 16 con App Router, Tailwind 4, HeroUI, Prisma 6 y PostgreSQL. Commit `4986e68`.
- [x] Schema de Prisma: `User`, `Client`, `Software`, `Contract`, `Invoice`, `Transaction` y `Ticket`, más la migración `init`.
- [x] CRUD por API y pantallas de clientes, softwares, contratos, facturación, tickets y finanzas. Commit `2898806`.
- [x] Al marcar una factura como `PAID` se crea automáticamente una `Transaction` de tipo `INCOME` (`app/api/invoices/[id]/route.ts`).
- [x] Dashboard con métricas (`/api/dashboard/metrics`).
- [x] Chat de IA con resumen financiero inyectado: ingresos y egresos del mes, pendientes y top 3 de softwares (`/api/ia/chat`, con OpenAI a través del AI SDK).

---

## Fase 0: Cimientos de datos

### P0.1: Índices, soft-delete y protección contable
- **Estado:** [x]
- **Depende de:** nada
- **Fecha:** 25/09/2026 · **Commit:** `45df90b` · **Notas:** Migración `20260925150353_soft_delete_indexes_restrict`.
  - Todas las FKs pasaron a `Restrict`, así que la base rechaza el borrado físico de un registro que tenga dependencias.
  - `DELETE` de clientes y softwares hace soft-delete, pero responde 409 si tienen contratos activos.
  - Nuevo `DELETE /api/contracts/[id]`: responde 409 si el contrato tiene facturas `PENDING`.
  - Los GET y las validaciones de creación ignoran los registros archivados.
  - Botón "Archivar", con doble confirmación, en el modal de edición de clientes y softwares. Contratos: solo por API, porque la UI ya tiene activar/desactivar.
  - Lint: quedan 2 errores preexistentes de `react-hooks/set-state-in-effect` en `facturacion` y `finanzas`, sin tocar.

```
Leé CLAUDE.md y prisma/schema.prisma. Quiero proteger el historial contable:
1. Reemplazá onDelete: Cascade de Contract→Client, Contract→Software, Invoice→Contract, Ticket→Client y Ticket→Software por Restrict.
2. Agregá soft-delete (deletedAt DateTime?) a Client, Software y Contract. Los DELETE de la API tienen que hacer soft-delete y los GET tienen que excluir los borrados por defecto.
3. Agregá @@index en todas las FKs y en Invoice.status, Invoice.dueDate, Invoice.period, Ticket.status y Transaction.date.
4. Generá la migración con prisma migrate dev y ajustá las pantallas que borran para que muestren "Archivar".
Verificá con npm run build y npm run lint.
```

### P0.2: Seed inicial
- **Estado:** [~]
- **Depende de:** P0.1
- **Fecha:** 25/09/2026 · **Commit:** `45df90b` · **Notas:**
  - `prisma/seed.ts` se ejecuta con tsx, configurado en `prisma.config.ts`, y crea 2 OWNER: Marce (garridomarcex@gmail.com) y Lautaro (lautarooyt837@gmail.com).
  - Las contraseñas salen de `SEED_PASSWORD_MARCE` y `SEED_PASSWORD_LAUTARO`. Si un usuario ya existe, el seed no pisa su contraseña.
  - Desde P2.1 el seed también crea las categorías base y la cuenta "Ualá ARS".
  - Falta que los socios carguen sus contraseñas en `.env` y ejecuten `npx prisma db seed`.

```
Creá prisma/seed.ts (con tsx) y configuralo en package.json o prisma.config.ts. Tiene que cargar:
- Los 3 socios como User (rol OWNER, uno además FINANCIAL si P1.1 ya separa los permisos) con contraseña hasheada a partir de variables de entorno SEED_*.
- Las categorías base de transacciones (ver P2.1 si ya existe el modelo): Sueldos, Infraestructura, Impuestos, Herramientas/SaaS, Comisiones bancarias, Cobro de factura, Otros.
- La cuenta financiera "Ualá ARS" (si P2.1 ya existe).
Tiene que ser idempotente (upsert). Documentá el comando en README.md.
```

---

## Fase 1: Autenticación y roles

### P1.1: Login con roles
- **Estado:** [x]
- **Depende de:** P0.2
- **Fecha:** 25/09/2026 · **Commit:** `45df90b` · **Notas:**
  - Sesión stateless: JWT HS256 con `jose` en la cookie httpOnly `devsoul_session`, válida por 7 días. Las contraseñas se hashean con `bcryptjs` (costo 12).
  - `proxy.ts` (el middleware de Next 16) protege todo salvo `/login`, `/api/auth/*` y `/api/webhooks/*`: la API responde 401 y las páginas redirigen a `/login?from=`.
  - `lib/auth/session.ts` expone `getSession`, `getCurrentUser`, `requireUser` y `requireRole(roles)`. `FINANCIAL_ROLES` (OWNER y FINANCIAL) protege `PATCH /api/invoices/[id]` y `POST /api/transactions`.
  - Login, logout y cambio de contraseña son server actions en `app/actions/auth.ts`. El perfil quedó en `/dashboard/perfil` y no en `/perfil`, para reutilizar el layout.
  - `app/dashboard/layout.tsx` es un server component que carga el usuario. El shell cliente pasó a `dashboard-shell.tsx`.
  - Probado con curl: redirecciones, 401, 403 para MANAGER, token adulterado rechazado, redirect abierto bloqueado. El logout desde el menú no se probó en el navegador.
  - Pendiente para después: rate-limit del login y ocultar en la UI las acciones que el rol no puede ejecutar.

```
Leé CLAUDE.md, AGENTS.md y la documentación de Next 16 en node_modules/next/dist/docs/ (middleware/proxy, cookies y server actions) antes de escribir código.
Implementá autenticación con email y contraseña sobre el modelo User existente:
- Hash con bcrypt o argon2 y sesión con cookie httpOnly firmada (JWT con jose, o Auth.js si es compatible con Next 16; justificá la elección).
- Página /login con estética glassmorphism, mobile-first y acento #bdf61d.
- Protección de /dashboard/** y /api/** (salvo /api/auth/** y webhooks) mediante middleware o proxy.
- Rutas /perfil (ver datos y cambiar contraseña) y /auth/logout, que ya están linkeadas desde app/dashboard/layout.tsx.
- Helper requireRole(roles[]) para route handlers. Solo FINANCIAL u OWNER pueden marcar facturas como PAID y registrar movimientos.
```

---

## Fase 2: Registro contable (núcleo del pedido)

### P2.1: Cuentas financieras, categorías y saldos
- **Estado:** [x]
- **Depende de:** P0.1
- **Fecha:** 25/09/2026 · **Commit:** `d1fcdaa` · **Notas:** Migración `20260925180000_finance_accounts_categories_rates`, escrita a mano porque migra datos.
  - Los movimientos existentes pasaron a "Ualá ARS". Las categorías se crearon a partir del texto que tenían, y los cobros automáticos quedaron vinculados a su factura.
  - Transferencias: no hay un modelo aparte. Se agregaron los tipos `TRANSFER_IN` y `TRANSFER_OUT`, y las dos patas comparten `transferGroupId`. No cuentan como ingreso ni egreso y admiten monedas distintas (compra de USD).
  - APIs nuevas:
    - `/api/accounts`: devuelve los saldos calculados.
    - `/api/categories`
    - `/api/transfers`
    - `DELETE /api/transactions/[id]`: solo MANUAL o TRANSFER, y en una transferencia borra las dos patas.
  - `PATCH /api/invoices/[id]` ahora exige `accountId`. Acepta `paymentDate`, y `amountReceived` cuando la moneda de la cuenta difiere de la de la factura. Es idempotente frente a dobles cobros.
  - UI:
    - `/dashboard/finanzas`: saldos por cuenta, liquidez total, filtros por tipo, cuenta, categoría y mes, y modales de movimiento y transferencia.
    - `/dashboard/finanzas/configuracion`: cuentas, categorías y cotización.
    - Facturación: modal de cobro con cuenta destino.
  - Utilidades nuevas: `lib/hooks/use-json.ts` (sin setState en effects, lo que resolvió los 2 errores de lint), `components/form-modal.tsx` y `lib/format.ts`.
  - Probado end-to-end con datos de prueba (ya borrados): saldos, cotización histórica, transferencia ARS→USD, cobros, validaciones y bloqueo de doble cobro. La UI no se revisó visualmente en el navegador.

```
Quiero un registro contable real de dónde está el dinero de Devsoul (hoy todo está en Ualá).
Modelá en Prisma:
- FinancialAccount: name, provider (UALA, CASH, BANK, OTHER), currency, openingBalance, openingDate y active.
- TransactionCategory: name, type (INCOME/EXPENSE) y active. Migrá el string Transaction.category a una FK, conservando los datos.
- Transaction: sumá accountId (obligatorio), invoiceId? (vínculo con la factura cobrada), externalId? @unique (id del movimiento en Ualá, para deduplicar), source (MANUAL, INVOICE, UALA_IMPORT, UALA_WEBHOOK), reconciled Boolean y createdById?.
- Transferencias entre cuentas: TransferGroup, o dos transacciones enlazadas que no cuenten como ingreso ni egreso.
Actualizá el flujo de "marcar factura PAID" para que pida la cuenta de destino y enlace invoiceId.
Pantalla /dashboard/finanzas: saldo actual por cuenta (apertura + movimientos), filtros por cuenta, categoría y mes, y resultado neto mensual.
Verificá con build y lint.
```

### P2.2: Tipo de cambio USD
- **Estado:** [x]
- **Depende de:** P2.1
- **Fecha:** 25/09/2026 · **Commit:** `d1fcdaa` · **Notas:**
  - Modelo `ExchangeRate`, único por (currency, date).
  - `getRateToArs` en `lib/finance/rates.ts` resuelve en este orden:
    1. La base de datos.
    2. dolarapi.com para el día de hoy.
    3. argentinadatos.com para fechas pasadas, retrocediendo hasta 7 días por fines de semana.
    4. La última cotización guardada.
    5. Si no hay ninguna, responde 422 y pide cargarla a mano.
  - Qué dólar se usa se configura con `EXCHANGE_RATE_CASA` (por defecto `oficial`, venta).
  - `Transaction` guarda `rateToArs` y `amountArs`. `Invoice.rateToArs` se fija al cobrarla; las facturas pendientes en USD se valúan con la cotización actual (`lib/finance/invoices.ts`).
  - Consolidado en ARS: el resumen de `/api/transactions`, `/api/dashboard/metrics` (que suma `cotizacionUsd`) y el prompt de la IA, que ahora incluye la liquidez total y el saldo de cada cuenta.
  - `POST /api/exchange-rates` permite cargar o corregir una cotización a mano.

```
Agregá el modelo ExchangeRate (date, currency, rateToArs y source: MANUAL o API) y guardá en cada Transaction e Invoice en USD el rateToArs usado.
Creá una función getRate(date) que tome la cotización del día (API pública del dólar oficial o MEP; proponé cuál y dejala configurable) con fallback manual.
Todos los reportes y el resumen de la IA tienen que consolidar en ARS.
```

---

## Fase 3: Integración con Ualá

> **Contexto:** Ualá no ofrece una API pública para leer los movimientos de una cuenta personal. Hay dos vías reales:
> 1. **Importar el extracto o los movimientos** que se exportan desde la app (P3.1). Sirve para cualquier movimiento: gastos, transferencias y cobros.
> 2. **Ualá Bis, API Cobros Online** (https://developers.ualabis.com.ar): genera links de pago por factura y notifica el cobro por webhook (P3.2). Solo cubre los cobros hechos a través de Ualá Bis; no permite leer el resto de la cuenta.
> Con las dos juntas se logra que los cobros se concilien solos y que el resto de la cuenta se cargue mediante importación periódica.

### P3.1: Importador de extracto de Ualá y conciliación
- **Estado:** [ ]
- **Depende de:** P2.1
- **Fecha:** · **Commit:** · **Notas:**

```
Voy a darte un archivo de ejemplo con movimientos exportados de Ualá (ruta: ____). Primero analizá su formato (CSV, XLSX o PDF) y confirmame las columnas antes de codificar.
Después implementá:
- Un endpoint POST /api/import/uala (multipart) con un parser para ese formato: fecha, descripción, monto con signo, saldo e id o referencia si existe.
- Deduplicación por externalId (o por un hash de fecha+monto+descripción si no hay id).
- Una pantalla /dashboard/finanzas/importar: subir el archivo, previsualizar en tabla, autocategorizar con reglas (modelo CategoryRule: patrón de texto → categoría, editable) y confirmar.
- Conciliación automática: si un ingreso coincide en monto (±1%) y fecha (±7 días) con una Invoice PENDING, sugerir el match. Al confirmar, marcar la factura como PAID, enlazar invoiceId y marcar reconciled=true.
- Validar que el saldo final del extracto coincida con el saldo calculado de la cuenta y mostrar la diferencia si no coincide.
```

### P3.2: Cobros con Ualá Bis (links de pago y webhook)
- **Estado:** [ ]
- **Depende de:** P2.1, P1.1
- **Fecha:** · **Commit:** · **Notas:**

```
Leé la documentación de https://developers.ualabis.com.ar (API Cobros Online v2 y su SDK de Node) antes de codificar.
- Variables de entorno: UALA_BIS_USERNAME, UALA_BIS_CLIENT_ID, UALA_BIS_CLIENT_SECRET y UALA_BIS_ENV (stage/prod). Documentalas en README.md sin valores.
- Botón "Generar link de pago" en cada factura PENDING. Guardar en Invoice los campos paymentLinkUrl, paymentProviderOrderId y paymentLinkCreatedAt.
- Webhook POST /api/webhooks/uala-bis: validar el origen según la documentación, buscar la orden, marcar la factura PAID de forma idempotente y crear la Transaction (source UALA_BIS_WEBHOOK, cuenta Ualá, externalId = id de la orden, con la comisión registrada como EXPENSE aparte si la API la informa).
- Job de respaldo que consulte las órdenes pendientes por si un webhook no llegó.
- Probar primero contra el entorno stage.
```

---

## Fase 4: Automatización

### P4.1: Facturación recurrente automática
- **Estado:** [x]
- **Depende de:** P0.1
- **Fecha:** 25/09/2026 · **Commit:** `8e734dc` · **Notas:** Deploy decidido: Vercel. Migración `20260925200000_recurring_invoices_reminders`.
  - Idempotencia: no hay `@@unique([contractId, period])`, porque impediría cargar a mano una factura extra en el mismo mes. En su lugar, `Invoice.recurringKey` (`contractId:period`) es único, y el generador omite los contratos que ya tienen cualquier factura en ese período.
  - `lib/billing/recurring.ts` incluye contratos SAAS_SUBSCRIPTION y MAINTENANCE activos, no archivados, iniciados antes de fin de mes y sin `endDate` anterior al período. El monto es `totalAmount`, que es la cuota mensual.
  - El vencimiento es el día `INVOICE_DUE_DAY` (10 por defecto). Si la generación corre después de ese día, la factura vence a hoy + 7 días, para no nacer vencida.
  - Los períodos y el "hoy" se calculan en hora argentina (`lib/dates.ts`).
  - Endpoints:
    - `GET /api/cron/invoices`: protegido por `CRON_SECRET` con comparación timing-safe. En `proxy.ts` se excluyó `/api/cron/` del chequeo de sesión.
    - `POST /api/invoices/generate {period}`: solo OWNER.
  - `vercel.json` programa los crons todos los días. La UI está en Facturación → Automatizaciones, y cada factura generada automáticamente muestra un ícono ↻.
  - Pendiente: cuando exista P3.2, generar el link de pago al crear la factura.

```
Creá un job que el día 1 de cada mes genere las Invoice PENDING de cada Contract activo de tipo SAAS_SUBSCRIPTION o MAINTENANCE para el período YYYY-MM:
- Idempotente, con @@unique([contractId, period]).
- dueDate configurable (por ejemplo, día 10).
- Respetar startDate y endDate del contrato.
- Endpoint /api/cron/invoices protegido con CRON_SECRET.
- Preguntame dónde se despliega (Vercel Cron, cron del servidor, etc.) antes de configurar el scheduler.
- Botón manual "Generar facturas del mes" para OWNER.
Si P3.2 ya está hecho, generar el link de pago de Ualá Bis automáticamente.
```

### P4.2: Recordatorios de vencimiento
- **Estado:** [x]
- **Depende de:** P4.1
- **Fecha:** 25/09/2026 · **Commit:** `8e734dc` · **Notas:** Proveedor decidido: Resend, con `fetch` directo y sin SDK.
  - `ReminderLog` es único por (invoiceId, kind, channel) y guarda estado, reintentos y el id del proveedor.
  - Tipos de recordatorio:
    - `BEFORE_DUE`: desde `REMINDER_DAYS_BEFORE` (3) días antes del vencimiento.
    - `DUE_DAY`: entre el día del vencimiento y el día +6.
    - `OVERDUE`: desde `REMINDER_DAYS_AFTER` (7) días después.
  - En cada corrida se manda solo el tipo que corresponde a ese día, y si una corrida se pierde se recupera en la siguiente.
  - Contra envíos duplicados: la fila se reclama antes de enviar (una en PENDING por más de 1 h se puede volver a reclamar) y se manda `Idempotency-Key` a Resend. Hasta 5 intentos; los FAILED se reintentan en la corrida siguiente.
  - Canales: interfaz `Notifier` en `lib/notifications/index.ts`. El enum `NotificationChannel` ya incluye WHATSAPP, así que alcanza con registrar un notifier nuevo.
  - La plantilla HTML de marca está en `lib/billing/reminder-template.ts`, con escape de HTML y versión en texto plano, y ya admite `paymentUrl` para P3.2.
  - Endpoints:
    - `GET /api/cron/reminders`
    - `GET /api/reminders`: dry run de lo que sale hoy.
    - `POST /api/reminders`: envío manual, solo OWNER.
    - `GET /api/reminders/preview?invoiceId=&kind=`: muestra el HTML del email.
  - Probado con fixtures, ya borrados:
    - Tipos de recordatorio correctos; las facturas pagadas y las que vencen dentro de 10 días quedan afuera.
    - Sin configuración: 503 y no se registra nada.
    - Con una key inválida: queda FAILED con el error de Resend y se reintenta (attempts 2).
  - No probado: un envío real exitoso (falta la cuenta de Resend y un dominio verificado).
  - Nota: los textos de la UI dicen "3 días antes / 7 después" fijos; si se cambian las variables de entorno, hay que actualizarlos.

```
Enviar recordatorios por email (Resend o SMTP; proponé uno) 3 días antes del vencimiento, el día del vencimiento y 7 días después, incluyendo el link de pago si existe.
- Registrar los envíos en un modelo ReminderLog para no duplicarlos.
- Plantilla HTML con la marca Devsoul.
- Dejar preparada una interfaz para sumar WhatsApp más adelante.
- Ejecutarlo desde el mismo sistema de cron que P4.1.
```

---

## Fase 5: Operación y trazabilidad

### P5.1: Tickets con responsable e historial
- **Estado:** [ ]
- **Depende de:** P1.1
- **Fecha:** · **Commit:** · **Notas:**

```
Extendé Ticket con assignedToId (User), resolvedAt (se completa al pasar a RESOLVED) y el modelo TicketComment (autor, texto, fecha).
UI: asignar responsable, timeline de comentarios, filtro "mis tickets" y tiempo promedio de resolución.
```

### P5.2: Auditoría
- **Estado:** [ ]
- **Depende de:** P1.1
- **Fecha:** · **Commit:** · **Notas:**

```
Modelo AuditLog (userId, action, entity, entityId, diff JSON y createdAt).
Registrar: factura marcada como PAID o revertida, cambios de contrato, resolución de tickets, importaciones de Ualá y movimientos manuales.
Pantalla /dashboard/auditoria, solo para OWNER, con filtros.
```

### P5.3: Exportes para el contador
- **Estado:** [ ]
- **Depende de:** P2.1
- **Fecha:** · **Commit:** · **Notas:**

```
Exportar a CSV y PDF, por período:
- Facturación (emitidas y cobradas).
- Libro de movimientos por cuenta.
- Resultado mensual por categoría.
Botones en facturación y finanzas.
```

---

## Fase 6: Inteligencia y crecimiento

### P6.1: Dashboard financiero ejecutivo
- **Estado:** [ ]
- **Depende de:** P2.1, P2.2
- **Fecha:** · **Commit:** · **Notas:**

```
Agregá al dashboard:
- MRR y ARR a partir de los contratos recurrentes activos.
- Morosidad (facturas vencidas, con monto y antigüedad).
- Proyección de cobros a 90 días.
- Saldo por cuenta.
- Burn rate y runway (saldo / egreso promedio de 3 meses).
- Comparativa mes a mes con Recharts.
Todo consolidado en ARS y mobile-first.
```

### P6.2: Fidelización de clientes
- **Estado:** [ ]
- **Depende de:** P5.1
- **Fecha:** · **Commit:** · **Notas:** `Client.lastContactAt` y `ClientInteraction` ya se hicieron en P7.3; falta NPS, alertas de renovación y health score.

```
Agregá a Client lastContactAt y el modelo ClientInteraction (tipo, nota, fecha, usuario).
- Encuesta NPS post-ticket con un link público firmado y el modelo NpsResponse.
- Alertas de renovaciones próximas (contratos con endDate a menos de 60 días).
- Health score por cliente: morosidad + tickets abiertos + NPS + días sin contacto.
```

### P6.3: IA con contexto completo
- **Estado:** [ ]
- **Depende de:** P6.1
- **Fecha:** · **Commit:** · **Notas:**

```
Ampliá el resumen que se inyecta en /api/ia/chat con:
- Saldos por cuenta, MRR, morosidad por cliente, tickets abiertos por cliente, health score, runway y la proyección a 90 días.
- Tools (function calling del AI SDK) para que la IA consulte datos puntuales (un cliente, un período) en lugar de recibir todo en el prompt.
- Solo lectura: la IA no modifica datos.
```

---

## Fase 7: Gestión de clientes

> Proyectos por cliente con varios softwares, recordatorios internos del equipo y ficha completa del cliente. El resumen de esta versión está en `ACTUALIZACIONES.md` (v0.7).

### P7.1: Proyectos y componentes
- **Estado:** [x]
- **Depende de:** P0.1
- **Fecha:** 09/11/2026 · **Commit:** `a52b719` · **Notas:** Migración `20261109120000_projects_tasks_interactions`.
  - Modelo: `Client → Project → ProjectComponent`. Un componente (WEB, MOBILE, BACKEND, ADMIN, INTEGRATION u OTHER) puede apuntar a un `Software` del catálogo y guarda la URL, el repo y notas. Las URLs se normalizan agregando `https://` si falta.
  - `Contract.projectId` y `Ticket.projectId` son opcionales, así que los datos existentes no cambian. El proyecto se valida contra el cliente (400 si es de otro), con `findClientProject` de `lib/projects.ts`.
  - Los proyectos tienen soft-delete. `DELETE` responde 409 si el proyecto tiene contratos activos; los componentes, en cambio, se borran físicamente porque no tienen dependencias.
  - API:
    - `/api/projects` (GET con `?clientId` y POST) y `/api/projects/[id]` (GET, PUT y DELETE).
    - `/api/projects/[id]/components` (POST) y `/api/project-components/[id]` (PUT y DELETE).
    - `PATCH /api/contracts/[id]` acepta `projectId`, para asignar contratos existentes a un proyecto.
  - UI:
    - Pestaña Proyectos de la ficha del cliente.
    - Bloque "Contratos sin proyecto" con un selector para asignarlos.
    - Selector de proyecto en los formularios de contratos y tickets.

### P7.2: Recordatorios internos
- **Estado:** [x]
- **Depende de:** P1.1
- **Fecha:** 09/11/2026 · **Commit:** `a52b719` · **Notas:**
  - Modelo `Task` (en la UI, "Recordatorio"):
    - Tipos: COLLECTION, MESSAGE, CALL, MEETING, RENEWAL, FOLLOW_UP y OTHER.
    - Estados: PENDING, DONE y CANCELLED.
    - Repetición: semanal, mensual o anual.
    - Se puede vincular a un cliente, un proyecto o una factura. Si se indica el proyecto o la factura, el cliente se completa solo.
    - Por defecto, el responsable es quien crea el recordatorio.
  - Al completar un recordatorio que se repite, la próxima ocurrencia se crea en la misma transacción y siempre cae después de hoy.
    - Si la fecha original es el último día del mes, se mantiene a fin de mes (31/01 → 28/02 → 31/03).
    - Caso que no se cubre: un día 29 o 30 que cae en febrero queda corrido al 28 en las ocurrencias siguientes.
    - Completar dos veces responde 409, así que no se duplican ocurrencias.
  - `DELETE` no borra: marca el recordatorio como CANCELLED.
  - Resumen diario por email (`lib/tasks/digest.ts`, `GET /api/cron/tasks` a las 11:00 UTC, que son las 8:00 ART):
    - A cada responsable le llegan sus vencidos y los del día. Los recordatorios sin responsable van a todos los OWNER.
    - Se usa la `Idempotency-Key` de Resend y `Task.notifiedAt` para no mandar el mismo resumen dos veces el mismo día.
    - `APP_URL` (opcional) agrega al email el link "Ver recordatorios".
  - UI:
    - `/dashboard/recordatorios`: filtros "Míos / Todos" y "Pendientes / Vencidos / Hoy / 7 días / Hechos".
    - Widget "Mis pendientes de la semana" en el dashboard.
    - Botón para crear un recordatorio de cobro en las facturas vencidas, desde Facturación y desde la ficha del cliente.
  - IA: el prompt incluye los recordatorios vencidos y los proyectos activos por cliente.
  - No probado: un envío real del resumen, porque falta la cuenta de Resend. Con el email sin configurar, el cron responde `configured:false` y los resultados quedan en DRY_RUN.

### P7.3: Ficha del cliente e historial de contacto
- **Estado:** [x]
- **Depende de:** P7.1, P7.2
- **Fecha:** 09/11/2026 · **Commit:** `a52b719` · **Notas:**
  - `GET /api/clients/[id]` devuelve la ficha agregada:
    - Proyectos, contratos y tickets abiertos.
    - Facturas pendientes (con `amountArs` y `overdue`) y las últimas 10 cobradas.
    - Recordatorios pendientes y las últimas 30 interacciones.
    - Un `summary` con los totales.
  - `ClientInteraction` (llamada, email, WhatsApp, reunión o nota): `POST /api/clients/[id]/interactions` actualiza `Client.lastContactAt` solo si la interacción es más reciente que la última registrada. Rechaza fechas futuras.
  - `/dashboard/clientes/[id]`:
    - Header con email, teléfono y link a WhatsApp, más 4 KPIs.
    - Pestañas: Proyectos, Recordatorios, Facturación, Tickets e Historial (timeline).
  - Las tarjetas del listado de clientes muestran la cantidad de proyectos y de recordatorios pendientes, y "Ver ficha" lleva a la ficha.
  - `GET /api/users` lista a los usuarios para elegir el responsable.
  - Probado end-to-end en una base descartable con un script de 59 checks: validaciones cruzadas cliente/proyecto/factura, 409s, recurrencia, filtros, ficha, digest y páginas. También se revisó la UI en el navegador en desktop; no se pudo probar a 375px porque la ventana no se redimensionó.

### P7.5: Etapas del cliente y redes sociales
- **Estado:** [x]
- **Depende de:** P7.3
- **Fecha:** 09/11/2026 · **Commit:** `7c4c729` · **Notas:** Migración `20261109180000_client_stage_socials`.
  - `Client.stage` (`PROSPECT` = posible cliente, cuando hubo un acercamiento o una reunión; `CLIENT` = ya estamos trabajando) y `convertedAt`. La migración pasa a todos los clientes existentes a `CLIENT`.
  - Un cliente nuevo arranca por defecto como posible cliente. Pasa a `CLIENT` de alguna de estas formas:
    - Automáticamente, al crearle el primer contrato (`POST /api/contracts`).
    - A mano, con el botón "Pasar a cliente" de la ficha o desde la edición.
    - Volver a posible cliente responde 409 si tiene contratos activos.
  - `Client.email` pasa a ser opcional para los posibles clientes. Es obligatorio para la etapa `CLIENT` y para crear un contrato, porque los avisos de facturas salen por email. `lib/billing/reminders.ts` omite a los clientes sin email.
  - Redes: `website`, `instagram`, `facebook`, `linkedin`, `tiktok` y `x`.
    - Se acepta `@usuario`, el usuario solo o el link, y se guarda como URL (`normalizeSocial` en `lib/clients.ts`).
    - Un valor solo se interpreta como link si trae `http` o una `/`, así que `clinica.sur` se toma como usuario.
  - UI:
    - Clientes: filtros "Todos / Posibles clientes / Clientes" con contadores, badge de etapa, redes en cada tarjeta y formulario con selector de etapa y sección de redes.
    - Ficha: badge de etapa, redes, "Cliente desde…" y aviso con el botón "Pasar a cliente".
    - Contratos: el selector marca "(posible cliente)" y avisa que al crear el contrato pasa a la etapa Cliente.
  - El KPI "Clientes activos" del dashboard cuenta solo la etapa `CLIENT`.
  - Probado: validación y normalización (19 casos) y smoke test de solo lectura contra la base de desarrollo, que no tiene usuarios porque el seed de P0.2 sigue pendiente.

### P7.4: Bug de período en facturas de contratos nuevos
- **Estado:** [ ]
- **Depende de:** nada
- **Fecha:** · **Commit:** · **Notas:** Se detectó al probar P7.

```
En app/api/contracts/route.ts, el período y los vencimientos de las facturas iniciales se calculan con getFullYear/getMonth/getDate en hora local sobre una fecha que llega como UTC ("2026-10-01" → 30/09 21:00 ART), así que un contrato que empieza el 01/10 genera una factura con período 2026-09.
Usá los helpers de lib/dates.ts (hora argentina / UTC) para el período y las cuotas, y agregá una verificación.
```

---

## Fase 8: App mobile y notificaciones push

> Detalle y motivos en `ACTUALIZACIONES.md` (v0.8). Enfoque: PWA instalable con Web Push (VAPID), sin tiendas.

### P8.1: PWA instalable
- **Estado:** [~]
- **Depende de:** nada
- **Fecha:** 10/11/2026 · **Commit:** · **Notas:**
  - `app/manifest.ts` con shortcuts a Recordatorios, Facturación y Tickets. Íconos en `public/icons/`: 192, 512, maskable 512, apple-touch 180 y SVG (una "D" lima sobre negro, generados con sharp).
  - `public/sw.js`: los HTML van a la red primero y caen en `public/offline.html` si no hay conexión; `/_next/static` e íconos usan cache-first; `/api` y los pedidos de otro origen no se tocan. Se registra desde `components/pwa/service-worker-registrar.tsx` en el layout del dashboard.
  - Meta tags de iOS desde `metadata.appleWebApp` y `viewport` en `app/layout.tsx`. Next 16 emite `mobile-web-app-capable`, no la variante `apple-`; iOS 16.4+ usa `display: standalone` del manifest.
  - Perfil → "App en el celular": botón "Instalar app" (`beforeinstallprompt`, guardado en `components/pwa/install-store.ts` porque puede dispararse antes de entrar a Perfil), guía para iPhone y aviso si ya está instalada.
  - `proxy.ts` excluye `manifest.webmanifest`, `sw.js`, `offline.html` e `icons/`. `next.config.ts` agrega headers de seguridad y `no-cache` para `sw.js`.
  - Deploy: `postinstall` y `vercel-build` (`prisma generate && prisma migrate deploy && next build`); pasos en README.
  - Probado: `tsc`, eslint, `next build` y `next start`. Manifest, sw.js, offline e íconos responden 200 sin sesión y `/dashboard` sigue redirigiendo. Falta Lighthouse y probarlo en Android e iOS, que necesitan el deploy con HTTPS.

```
Leé la documentación de Next 16 en node_modules/next/dist/docs/ sobre manifest y metadata antes de codificar.
Convertí el sistema en una PWA instalable:
- app/manifest.ts: nombre "Devsoul Gestión", display standalone, fondo y theme #000000, íconos 192/512 y maskable con el logo en #bdf61d, y shortcuts a Recordatorios, Facturación y Tickets.
- Service worker en public/sw.js, registrado desde el layout del dashboard: cachea el shell, muestra una página offline básica y no cachea /api.
- Meta tags para iOS (apple-touch-icon, apple-mobile-web-app-capable, status bar black).
- Botón "Instalar app" en Perfil (beforeinstallprompt) y una guía para iPhone (Compartir → Agregar a inicio).
- proxy.ts no tiene que bloquear manifest, sw.js ni los íconos.
Verificá con Lighthouse (PWA instalable) y probalo en Android y en iOS 16.4 o posterior.
```

### P8.2: Notificaciones push
- **Estado:** [ ]
- **Depende de:** P8.1, P7.2
- **Fecha:** · **Commit:** · **Notas:**

```
Implementá Web Push con la librería web-push y claves VAPID (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY y VAPID_SUBJECT; documentalas en README.md sin valores).
- Modelo PushSubscription (userId, endpoint @unique, p256dh, auth, userAgent, createdAt, lastUsedAt) y NotificationPreference (userId, evento, canal: PUSH/EMAIL).
- Agregá PUSH a NotificationChannel y un notifier push en lib/notifications que reciba el userId. Si el servicio responde 404 o 410, la suscripción se borra.
- API: POST/DELETE /api/push/subscriptions y GET /api/push/public-key.
- En el service worker: eventos push y notificationclick, que abren la URL del payload (recordatorio, factura o ticket).
- Perfil → Notificaciones: activar o desactivar push en este dispositivo, probar el envío y elegir preferencias por evento.
- Eventos:
  - Recordatorio que vence hoy o está vencido: se suma al resumen de /api/cron/tasks.
  - Recordatorio asignado por otro socio.
  - Factura cobrada.
  - Factura vencida: desde /api/cron/reminders, para OWNER y FINANCIAL.
  - Ticket nuevo de prioridad alta.
  - Facturas recurrentes generadas.
- Los envíos tienen que ser idempotentes, igual que los emails. Registrá los envíos o reutilizá ReminderLog si encaja.
```

---

## Backlog de ideas (sin prompt todavía)

- Integración con AFIP/ARCA para facturación electrónica.
- App nativa (Capacitor o Expo) publicada en las tiendas, si más adelante se quiere una app para clientes.
- Presupuesto mensual por categoría con alertas.
