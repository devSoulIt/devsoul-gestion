# Devsoul Gestión

Sistema de gestión interna de Devsoul: clientes, softwares, contratos, facturación, finanzas, tickets e IA.

## Puesta en marcha

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Copiar `.env.example` a `.env` y completar:
   - `DATABASE_URL`: la conexión a PostgreSQL.
   - `SESSION_SECRET`: 32 caracteres o más, para firmar la cookie de sesión.
   - `SEED_PASSWORD_MARCE` y `SEED_PASSWORD_LAUTARO`: contraseñas iniciales de los socios, de 8 caracteres o más.
   - `EXCHANGE_RATE_CASA` (opcional): qué dólar usar para consolidar en ARS. Por defecto `oficial`; también acepta `bolsa` (MEP) o `blue`.
   - `CRON_SECRET`: 16 caracteres o más. Protege los endpoints `/api/cron/*`.
   - `RESEND_API_KEY`, `EMAIL_FROM` y `EMAIL_REPLY_TO` (opcional): para los recordatorios por email.
   - `INVOICE_DUE_DAY`, `REMINDER_DAYS_BEFORE` y `REMINDER_DAYS_AFTER` (opcionales): por defecto 10, 3 y 7.
   - `APP_URL` (opcional): la URL pública de la app. Se usa en el link del resumen diario de recordatorios.
   - `OPENAI_API_KEY`: para el chat de IA.

3. Aplicar las migraciones y cargar los datos iniciales:

   ```bash
   npx prisma migrate deploy
   npx prisma db seed
   ```

   El seed es idempotente. Si un usuario ya existe, solo actualiza su nombre y rol; nunca pisa la contraseña. Después del primer login, cada socio puede cambiar su contraseña en **Perfil**.

4. Levantar el entorno de desarrollo:

   ```bash
   npm run dev
   ```

   Abrir [http://localhost:3000](http://localhost:3000). Sin sesión, redirige a `/login`.

## Finanzas

- **Cuentas** (Finanzas → Configuración): dónde está el dinero (Ualá, banco, efectivo). El saldo de cada cuenta es su saldo inicial más la suma de sus movimientos. Al empezar, cargá en "Ualá ARS" el saldo real y la fecha desde la que registrás movimientos.
- **Movimientos**: cada ingreso o egreso pertenece a una cuenta y a una categoría. Al marcar una factura como cobrada se crea el ingreso automáticamente en la cuenta que elijas.
- **Transferencias**: mueven dinero entre cuentas, incluso de ARS a USD. No cuentan como ingreso ni egreso.
- **USD**: cada movimiento en dólares guarda la cotización del día, que se obtiene de una API pública o se carga a mano. Todos los reportes se consolidan en ARS.

## Automatizaciones (Vercel Cron)

`vercel.json` programa tres tareas diarias. En el plan Hobby, Vercel puede ejecutarlas en cualquier momento dentro de la hora indicada.

| Endpoint | Horario (UTC) | Qué hace |
| --- | --- | --- |
| `/api/cron/invoices` | 10:00 (7:00 ART) | Genera la factura del mes de cada contrato SaaS o de mantenimiento activo que no tenga una. Es idempotente, así que correrlo todos los días recupera las ejecuciones perdidas. |
| `/api/cron/tasks` | 11:00 (8:00 ART) | Envía a cada socio un email con sus recordatorios vencidos y los del día. Los que no tienen responsable van a todos los `OWNER`. Sale una vez por día. |
| `/api/cron/reminders` | 12:00 (9:00 ART) | Envía por email los recordatorios de facturas pendientes: 3 días antes del vencimiento, el día del vencimiento y 7 días después. Cada uno sale una sola vez por factura y los fallos se reintentan hasta 5 veces. |

Para ponerlo en marcha en Vercel:
1. Cargar `CRON_SECRET`, `RESEND_API_KEY` y `EMAIL_FROM` en *Project Settings → Environment Variables*.
2. En Resend, verificar el dominio que se usa en `EMAIL_FROM`.

Desde **Facturación → Automatizaciones**:
- Generar a mano las facturas de un período (solo `OWNER`).
- Ver qué recordatorios salen hoy y previsualizar cada email.
- Forzar el envío.

Para probar localmente:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/invoices
```

## Deploy en Vercel

1. Crear una base PostgreSQL administrada (por ejemplo, Neon desde *Vercel → Storage*). Usar la URL con pooling en `DATABASE_URL`.
2. Importar el repo en Vercel y cargar las variables de `.env.example` en *Project Settings → Environment Variables*. `APP_URL` es la URL final (por ejemplo, `https://devsoul-gestion.vercel.app`).
3. El script `vercel-build` genera el cliente de Prisma, aplica las migraciones pendientes (`prisma migrate deploy`) y compila. Las migraciones se aplican sobre la base configurada en ese entorno, así que los deploys de preview tienen que apuntar a otra base o no tener `DATABASE_URL`.
4. Cargar los socios una sola vez, desde la máquina local apuntando a la base de producción:

   ```bash
   DATABASE_URL="<url de producción>" SEED_PASSWORD_MARCE=... SEED_PASSWORD_LAUTARO=... npx prisma db seed
   ```

## App en el celular (PWA)

El sistema se instala como app desde el navegador, sin tiendas. Necesita HTTPS, así que funciona en el deploy y no por IP local.

- **Android (Chrome)**: entrar, iniciar sesión e ir a **Perfil → Instalar app**, o elegir "Instalar app" en el menú ⋮.
- **iPhone (Safari, iOS 16.4 o posterior)**: Compartir → **Agregar a inicio**.

La app abre en `/dashboard` a pantalla completa, con accesos directos a Recordatorios, Facturación y Tickets (mantener apretado el ícono en Android). Sin conexión muestra una pantalla de reintento; los datos siempre se piden al servidor y `/api` nunca se cachea.

## Clientes, proyectos y recordatorios

- **Etapas**: un cliente se registra como **posible cliente** (hubo un acercamiento o una reunión) o como **cliente** (ya estamos trabajando). Pasa a cliente solo al cargarle el primer contrato, o a mano desde la ficha. El email es obligatorio solo para los clientes.
- **Redes sociales**: web, Instagram, Facebook, LinkedIn, TikTok y X. Se puede cargar `@usuario` o el link completo.
- **Proyectos**: cada cliente tiene proyectos, y cada proyecto, varios softwares o componentes (web, app móvil, backend, panel admin, integraciones). Un componente puede apuntar a un software del catálogo. Los contratos y los tickets se pueden asociar a un proyecto.
- **Ficha del cliente** (Clientes → Ver ficha): proyectos, recordatorios, facturación, tickets e historial de contacto.
- **Recordatorios**: tareas internas del equipo, como cobrar, escribir, llamar o renovar. Tienen responsable, fecha y repetición opcional. Se ven en la sección Recordatorios, en el dashboard y en la ficha de cada cliente.

## Roles

| Rol | Permisos |
| --- | --- |
| `OWNER` | Acceso total. |
| `FINANCIAL` | Puede marcar facturas como cobradas y registrar movimientos. |
| `MANAGER` | Acceso operativo. No puede marcar facturas como cobradas ni registrar movimientos. |

## Hoja de ruta

Ver `PROMPTS.md`.
