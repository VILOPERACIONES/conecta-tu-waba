# WhatsApp Onboarding — Tech Provider

Panel interno para hacer onboarding de clientes de WhatsApp Business Platform usando **Meta Embedded Signup** en modo **WhatsApp Business App Onboarding / Coexistence**.

## Flujo

1. Un administrador entra al panel (`/auth`) y crea un cliente.
2. Genera un **enlace de conexión único** para ese cliente.
3. El cliente abre el enlace (`/connect/:token`) e inicia Meta Embedded Signup.
4. El servidor intercambia el `code` por un access token, guarda los datos, y suscribe la app al WABA.
5. Los eventos de WhatsApp llegan al webhook y se reenvían automáticamente a **n8n**.

## Arquitectura

- **Frontend**: TanStack Start (React + TS). Nunca ve el App Secret ni el access token.
- **Backend**: Server routes (`/api/public/*`) para llamadas externas y server functions para operaciones autenticadas de administrador.
- **DB**: Lovable Cloud (Postgres + RLS).

## Tablas

- `clients` — clientes finales.
- `onboarding_links` — tokens únicos con vencimiento.
- `whatsapp_accounts` — datos de la conexión (WABA, número, token cifrado).
- `webhook_events` — todos los eventos recibidos de Meta.
- `user_roles` — roles admin/user.

## Endpoints del servidor

| Ruta | Método | Uso |
|------|--------|-----|
| `/api/public/onboarding/validate` | POST | Valida un token público de onboarding. |
| `/api/public/onboarding/complete` | POST | Recibe el `code` de Meta, intercambia el token, guarda la cuenta, suscribe el webhook. |
| `/api/public/whatsapp/webhook` | GET/POST | Verificación + recepción de eventos. Reenvía a n8n. |
| `/api/public/meta-config` | GET | Expone `META_APP_ID` y `META_CONFIGURATION_ID` (identificadores públicos, no secretos). |
| `sendWhatsAppMessage` (server fn) | — | Envía mensajes desde el panel usando el token del cliente (nunca expuesto al browser). |

## Variables de entorno requeridas

Configurar en Lovable Cloud → Secrets:

| Variable | Descripción |
|----------|-------------|
| `META_APP_ID` | ID público de la app de Meta. |
| `META_APP_SECRET` | 🔒 App Secret. **Nunca en frontend.** |
| `META_CONFIGURATION_ID` | ID de la configuración de Embedded Signup. |
| `META_GRAPH_API_VERSION` | Ej. `v21.0`. |
| `WHATSAPP_VERIFY_TOKEN` | Cadena aleatoria; pégala en Meta al configurar el webhook. |
| `N8N_WHATSAPP_WEBHOOK_URL` | URL del webhook en tu n8n. |
| `N8N_WEBHOOK_SECRET` | Se envía en el header `x-internal-secret` al reenviar a n8n. |

## Configuración de Meta

1. En tu app de Meta, activa el producto **WhatsApp** y luego **Embedded Signup**.
2. Crea una **Configuration** de Embedded Signup en modo *WhatsApp Business App Onboarding (Coexistence)* y copia su ID a `META_CONFIGURATION_ID`.
3. En el webhook de la app, configura:
   - **Callback URL**: `https://<tu-dominio>/api/public/whatsapp/webhook`
   - **Verify Token**: el valor de `WHATSAPP_VERIFY_TOKEN`
   - Subscribe a los campos relevantes (`messages`, `message_template_status_update`, etc.).

## Crear el primer administrador

Como el registro público está deshabilitado:

1. En Lovable Cloud → Users, crea manualmente el usuario admin (email + password).
2. En SQL: `INSERT INTO public.user_roles (user_id, role) VALUES ('<uuid>', 'admin');`

## TODOs pendientes de Meta

Buscar `TODO Meta` en el código:

- `src/routes/api/public/onboarding/complete.ts` — confirmar parámetros exactos del intercambio de `code` para el flujo de Tech Provider / Coexistence, incluido `redirect_uri` si aplica.
- `src/routes/connect.$token.tsx` — confirmar los `extras` exactos de `FB.login()` para *WhatsApp Business App Onboarding (Coexistence)*.
- Cifrado adicional para `token_encrypted` (actualmente se guarda como texto en una tabla ya protegida por RLS + service role). Considerar Supabase Vault o KMS antes de producción.
