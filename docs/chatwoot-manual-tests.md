# Chatwoot integration — pruebas manuales

Checklist end-to-end para validar la integración por cliente. Todas las pruebas
se hacen contra un cliente con `chatwoot_enabled=true` y credenciales válidas.
Ningún caso debe filtrar tokens ni cabeceras `Authorization` en logs ni en la
UI de monitoreo.

## 0. Preparación

- [ ] Cliente con `whatsapp_accounts.status = 'connected'`
- [ ] `client_integrations` con `base_url`, `account_id`, `inbox_id`,
      `api_access_token`, `webhook_secret` configurados
- [ ] Webhook de Chatwoot apuntando a `/api/public/chatwoot/webhook` con
      HMAC-SHA256 y el mismo `webhook_secret`
- [ ] Ver `Monitoreo Chatwoot` en el detalle del cliente

## 1. Bot activo (baseline)

- [ ] Enviar mensaje entrante desde WhatsApp → aparece en Chatwoot como
      `incoming` con `content_attributes.source = "meta"`
- [ ] Se reenvía a n8n (log `forwarded_to_n8n` en `n8n_forward_logs`)
- [ ] Respuesta del bot llega al usuario en WhatsApp
- [ ] La misma respuesta aparece en Chatwoot como `outgoing` con
      `content_attributes.source = "bot"` (evento `outbound_mirrored`)

## 2. Pausar bot con label `human`

- [ ] Aplicar label `human` a la conversación en Chatwoot
- [ ] Llega evento `conversation_updated` (o `labels`) al webhook
- [ ] Log `bot_paused_by_label` con `bot_paused = true`
- [ ] Nuevo mensaje entrante NO se reenvía a n8n (log
      `n8n_forward_logs.status = "chatwoot_paused"`)
- [ ] El mensaje sí se sincroniza en Chatwoot

## 3. Reanudar bot al quitar el label

- [ ] Remover label `human`
- [ ] Log `bot_resumed` con `bot_paused = false`
- [ ] Nuevo mensaje entrante vuelve a reenviarse a n8n

## 4. Pausa por asignación (si `pause_on_assigned = true`)

- [ ] Asignar la conversación a un agente
- [ ] Log `bot_paused_by_label` (sin label, con `assignee_id` presente)
- [ ] Desasignar → log `bot_resumed`

## 5. Agente humano responde desde Chatwoot

- [ ] Enviar mensaje `outgoing` público desde la UI de Chatwoot
- [ ] Webhook `message_created` llega firmado (HMAC)
- [ ] Log `agent_message_sent` con `status = success`
- [ ] Aparece en WhatsApp del usuario
- [ ] Fila en `whatsapp_send_logs` con `source = "chatwoot_agent"`
- [ ] Fila en `chatwoot_message_mappings` con `direction = "outgoing"` y
      `source = "chatwoot_agent"`

## 6. Anti-loop del mirror del bot

- [ ] Cuando el mirror del bot llega al webhook de Chatwoot (evento
      `message_created` con `content_attributes.source = "bot"`), se ignora
      con log `webhook_ignored_bot_mirror`
- [ ] NO se envía otra vez a Meta (no aparece fila en `whatsapp_send_logs`
      para ese mensaje)

## 7. Status events de Meta no llegan a n8n

- [ ] Recibir un evento de status (`sent`, `delivered`, `read`)
- [ ] En `meta_webhook_events` queda registrado con `event_kind = "status"`
- [ ] En `n8n_forward_logs` queda `status = "status_event_ignored"` y NO se
      llama a n8n

## 8. Deduplicación de `message_id` entrante

- [ ] Repetir el mismo webhook de Meta con el mismo `wa_message_id`
- [ ] Segunda vez: `n8n_forward_logs.status = "duplicate_ignored"` y no se
      publica de nuevo en Chatwoot
- [ ] La primera fila en `chatwoot_message_mappings` se conserva; no se
      duplica

## 9. Fallo de Chatwoot NO rompe Meta

- [ ] Poner `base_url` inválida o revocar `api_access_token`
- [ ] Enviar mensaje entrante desde WhatsApp
- [ ] `n8n_forward_logs` sigue registrando el envío (el fallo de Chatwoot
      solo produce `inbound_sync_error`)
- [ ] Meta responde 200 rápido; no hay reintentos en cadena
- [ ] Card de monitoreo muestra el error con payload saneado (sin token)

## 10. Fallo de Meta queda logueado

- [ ] Forzar error de Meta (número fuera de ventana 24h o plantilla no
      aprobada)
- [ ] `whatsapp_send_logs.success = false` con `error_code`, `error_message`
      y `fbtrace_id`
- [ ] Si el envío venía del agente humano, log
      `agent_message_sent` con `status = "error"` y detalle en Response

## 11. Rate limit por cliente

- [ ] Simular ráfaga de eventos de Chatwoot para un cliente (>120/min)
- [ ] Respuesta HTTP 429 con header `Retry-After`
- [ ] Log `rate_limited` con motivo (`rate_limited` o `chatwoot_unhealthy`)
- [ ] `client_integrations.chatwoot_unhealthy = true` durante el cooldown
- [ ] OTRO cliente sigue funcionando normalmente
- [ ] Webhook de Meta NO se ve afectado

## 12. Reapertura por mensaje entrante

- [ ] Cerrar conversación en Chatwoot (`resolved`)
- [ ] Enviar nuevo mensaje entrante desde WhatsApp
- [ ] Chatwoot reabre la conversación
- [ ] Log `conversation_reopened_by_inbound` con `previous_status =
      "resolved"` y `current_status = "open"`

## 13. Firma HMAC inválida

- [ ] Enviar POST al webhook con `X-Chatwoot-Signature` mal formada
- [ ] Respuesta HTTP 401
- [ ] Log `webhook_invalid_signature` (sin volcar el header)

## Diferido a fase posterior

- Soporte de adjuntos (imagen/audio/documento) en mirror bot y en webhook de
  agente
- Reapertura avanzada (forzar reabrir vía API cuando `resolved` y el usuario
  vuelve semanas después)
- Rate limit distribuido entre workers (hoy es por-worker + conteo en BD)
