## 1. Diseño de esquema y enums

- [x] 1.1 Definir enum `public.elicitation_section` con las 11 secciones (`project_context`, `stakeholders_personas`, `scope`, `business_process`, `user_stories`, `nfrs`, `domain_data`, `integrations`, `ui_ux`, `constraints_assumptions_risks`, `glossary`).
- [x] 1.2 Definir enum `public.turn_role` (`question`, `answer`, `followup`, `system`, `meta`).
- [x] 1.3 Definir enum `public.turn_status` (`ok`, `failed`).
- [x] 1.4 Definir enum `public.section_status` (`not_started`, `in_progress`, `incomplete`, `complete`).
- [x] 1.5 Definir enums `public.issue_type` (`vagueness`, `contradiction`, `missing_cross_cutting`, `missing_metric`, `undefined_glossary`), `public.issue_severity` (`info`, `warning`, `error`), `public.issue_status` (`open`, `resolved`, `dismissed`).
- [x] 1.6 Definir enum `public.session_status` (`active`, `closed`, `abandoned`) y agregar columnas a `public.sessions`: `current_section public.elicitation_section`, `status public.session_status default 'active'`, `closed_at timestamptz`.

## 2. Migración SQL (depende de 1.x)

- [x] 2.1 Redactar `supabase/migrations/0003_elicitation_engine.sql` con los enums (1.1–1.6) y `ALTER TABLE public.sessions`.
- [x] 2.2 Crear tabla `public.turns` (append-only) con columnas `id`, `session_id`, `project_id`, `actor public.session_actor`, `role public.turn_role`, `section public.elicitation_section`, `payload jsonb not null`, `token_usage jsonb`, `status public.turn_status default 'ok'`, `error_code text`, `client_request_id uuid`, `created_at`. Índices: `(session_id, created_at)`, único parcial `(session_id, client_request_id) where client_request_id is not null`. Se añadió además `(project_id, section, created_at)` para lecturas cross-session.
- [x] 2.3 Crear tabla `public.project_section_progress` con PK compuesta `(project_id, section)`, columnas `status public.section_status default 'not_started'`, `completion_score smallint check (completion_score between 0 and 100)`, `last_updated_at`.
- [x] 2.4 Crear tabla `public.detected_issues` con `id`, `project_id`, `session_id`, `turn_id`, `type public.issue_type`, `severity public.issue_severity`, `title text`, `body text`, `status public.issue_status default 'open'`, `resolution_note text`, `resolved_at timestamptz`, `resolved_by uuid`, `created_at`, `updated_at`.
- [x] 2.5 Habilitar `enable row level security` y `force row level security` en `turns`, `project_section_progress`, `detected_issues`. Políticas con `public.user_owns_project(project_id)`. **Desvío deliberado**: `turns` recibe solo policies `select` e `insert` para reforzar el append-only por RLS; `update`/`delete` quedan denegados por default. `project_section_progress` y `detected_issues` reciben las 4 policies.
- [x] 2.6 Triggers `set_updated_at` en `detected_issues` (reusa función existente). `project_section_progress` no usa el trigger porque su columna temporal es `last_updated_at` (no `updated_at`) y se setea explícitamente desde server actions.
- [x] 2.7 Aplicar migración con MCP `apply_migration`, ejecutar `get_advisors` (security + performance). Resultado: 0 issues críticos de seguridad (el WARN `auth_leaked_password_protection` es preexistente). Performance solo INFO ("unused index" en índices recién creados, esperado; 2 FK sin índice en `detected_issues.session_id` y `resolved_by` — se dejan por bajo uso esperado).
- [x] 2.8 Regenerar tipos TS con MCP `generate_typescript_types` y sobrescribir `src/lib/db/types.ts`.

## 3. Cliente del SDK Anthropic (depende de 2.8)

- [x] 3.1 Instalar `@anthropic-ai/sdk@0.98.0` pinned en `package.json`.
- [x] 3.2 Crear `src/lib/ai/env.ts`: validación Zod de `ANTHROPIC_API_KEY` y `ANTHROPIC_MODEL` (default `claude-sonnet-4-6`); fail-fast en runtime de servidor con memoización del resultado.
- [x] 3.3 Crear `src/lib/ai/anthropic.ts`: factory de cliente con `timeout: 30s` y `maxRetries: 0` (los retries los gestionamos nosotros). `callModel` aplica retry exponencial (3 intentos, 1s/2s/4s con jitter ±25%) solo para 429, 5xx, network/timeout. NO reintenta 400/401. Errores se clasifican como `AiCallError` tipado.
- [x] 3.4 Crear `src/lib/ai/schemas.ts` con Zod schemas: `TurnRequest`, `SubmitTurnPayload` (`question`, `suggested_followups[]`, `detected_issues[]`, `section_advance`, `fact_extraction[]`), `TokenUsage`.
- [x] 3.5 Definir el tool `submit_turn` con `input_schema` JSON-schema en el mismo archivo `schemas.ts` y `tool_choice: { type: "tool", name: "submit_turn" }` en `callModel` para forzar la invocación.

## 4. Prompts (depende de 3.4)

- [x] 4.1 Crear `src/lib/ai/prompts/system.ts` con el system prompt maestro (rol, idioma español, principios SDD, instrucción de devolver siempre `submit_turn`). `buildSystemPrompt(section)` combina el base con la guía de la sección activa y el listado de secciones disponibles para saltar.
- [x] 4.2 Guía por sección para las 11 secciones. **Desvío deliberado**: en lugar de un archivo por sección bajo `prompts/sections/`, consolidé todo en `src/lib/ai/prompts/sections.ts` con `SECTION_TITLES`, `SECTION_ORDER` y `SECTION_PROMPTS`. La estructura simplifica los imports y evita 11 archivos casi vacíos; si crecen las guías, se podrán separar sin cambiar el contrato.
- [x] 4.3 Detectores (vaguedad, contradicciones, métricas, glosario, cross-cutting). **Desvío deliberado**: las instrucciones de detección viven dentro del system prompt en `system.ts` (sección "Detección activa…"). No hay `detectors.ts` separado porque las detecciones se ejecutan inline en el mismo `tool_use`; un archivo aparte habría sido fragmentación sin valor.
- [x] 4.4 Crear `src/lib/ai/context.ts` con `buildTurnContext(supabase, session)`: arma `messages` con (a) bloque "Project facts" derivado del dominio (proyecto, stakeholders, personas, scope, NFRs, integraciones, entidades, glosario + facts extraídos por turnos previos del motor, ≤8000 chars), y (b) últimos N=20 turnos `status='ok'` de la sección actual ordenados temporalmente. `loadActiveSession` se exporta para reuso.

## 5. Server Actions (depende de 4.x y 2.8)

- [x] 5.1 `startSession({ projectId })` en `src/server/elicitation.ts`: reutiliza sesión activa si existe; si no, inserta `sessions(mode, current_section='project_context', status='active')` y genera el primer turno del motor.
- [x] 5.2 `sendTurn({ sessionId, clientRequestId, userMessage })`: persiste el turno del usuario (rol `answer`, actor según `project.mode`) con upsert idempotente — si choca con el unique parcial por `client_request_id` (código `23505`), devuelve `ok` sin generar nuevo turno del motor. Si pasa, llama al modelo con `buildTurnContext`, persiste el turno `question` con `payload` y `token_usage`, inserta `detected_issues` con FK a `turn_id` y aplica `section_advance` sobre `project_section_progress`.
- [x] 5.3 `jumpToSection({ sessionId, section })`: marca la sección anterior como `incomplete` si no estaba `complete`, actualiza `sessions.current_section`, asegura `in_progress` en la nueva sección, persiste un turno `meta` documentando el salto y genera la primera pregunta de la nueva sección.
- [x] 5.4 `listTurns({ sessionId?, projectId?, section?, limit, offset })` en `src/server/elicitation.ts`: lectura ordenada por `created_at` con `range(offset, offset+limit-1)`. Acepta filtrar por `sessionId`, por `projectId` y/o `section`. Devuelve `TurnSummary[]` con las columnas relevantes. Convive con la lectura directa de la RSC en `/elicit/page.tsx` y queda disponible para futuros consumidores cliente (paginación, panel histórico).
- [x] 5.5 `resolveIssue({ issueId, action: "resolve" | "dismiss", note? })`: cambia `detected_issues.status` con `resolution_note`, `resolved_at` y `resolved_by` (uid del usuario auth).
- [x] 5.6 `closeSession({ sessionId })`: `sessions.status='closed'`, `closed_at` y `ended_at` en `now()`. No borra nada.
- [x] 5.7 Cada action valida input con Zod y retorna `{ ok: true, data }` o `{ ok: false, error: { code, message } }` sin tirar excepciones al cliente. Se añadió `retryFailedTurn({ sessionId })` para reintento manual desde la UI tras un turno `meta`/`failed`.

## 6. Manejo de errores end-to-end (depende de 5.x)

- [x] 6.1 En `generateAndPersistEngineTurn` (llamada por `sendTurn`, `startSession`, `jumpToSection` y `retryFailedTurn`): si tras los 3 retries el cliente Anthropic falla, persiste un turno `role='meta'`, `status='failed'`, `error_code` con el código de `AiCallError` y `payload.errorMessage`. NO bloquea la sesión.
- [x] 6.2 Server Actions devuelven errores tipados (`ElicitationActionResult<T>`); el cliente decide si mostrar "Reintentar" (turnos meta failed) o el mensaje en `<p role="alert">` (otros errores).
- [x] 6.3 Logging server-side estructurado con `src/lib/ai/log.ts` (`log.info`/`warn`/`error`, JSON one-line con `ts`, `level`, `event` y campos). `callModel` emite `ai.call.success` (modelo, attempt, latencyMs, tokens) y `ai.call.failure` (code, attempt, retrying). Las server actions emiten `elicitation.startSession`, `elicitation.sendTurn.ok`, `elicitation.sendTurn.idempotent_skip`, `elicitation.sendTurn.engine_failed`, `elicitation.jumpToSection`, `elicitation.resolveIssue`, `elicitation.closeSession`, `elicitation.engineTurn.persisted` y `elicitation.engineTurn.failed`.

## 7. UI mínima de elicitación (depende de 5.x)

- [x] 7.1 Ruta `src/app/projects/[id]/elicit/page.tsx` como RSC: carga proyecto, sesión activa, turnos, hallazgos abiertos y `project_section_progress`; muestra `StartSessionButton` si no hay sesión.
- [x] 7.2 `src/app/projects/[id]/elicit/_turn-list.tsx`: renderiza turnos en orden temporal, distingue actor (`engine` | `consultant` | `stakeholder`) y rol; turnos `meta`/`failed` muestran `RetryTurnButton`. **Nota de ubicación**: los componentes de elicitación viven bajo `src/app/projects/[id]/elicit/_*` (Next.js App Router conventions) en lugar de `src/components/elicitation/`, ya que son específicos de esa ruta.
- [x] 7.3 `_turn-input.tsx`: textarea + botón "Enviar" deshabilitado durante envío; genera `clientRequestId` (`crypto.randomUUID()`) por cada submit.
- [x] 7.4 `_section-selector.tsx`: dropdown de las 11 secciones con badge de estado (`·` / `…` / `!` / `✓`) por sección; llama a `jumpToSection` al cambiar.
- [x] 7.5 `_issue-panel.tsx`: lista de hallazgos abiertos del proyecto, con tipo, severidad, título, body y botones "Resolver" / "Descartar" por hallazgo.
- [x] 7.6 Sin estado global: RSC + Server Actions; cada action llama a `revalidatePath` en su ruta y la UI se rehidrata.

## 8. Verificación (depende de todo lo anterior)

- [x] 8.1 `npm run lint` (0 warnings), `npm run type-check` y `npm run build` pasan limpios. La nueva ruta `/projects/[id]/elicit` se registra como dinámica (ƒ).
- [x] 8.2 `openspec validate add-elicitation-engine --strict` pasa.
- [x] 8.3 Smoke test automatizado en `scripts/smoke-elicitation.ts` (`npm run smoke:elicitation`). Ejecuta contra el proyecto Supabase real y el modelo Anthropic real: (1) crea proyecto+sesión efímera con service role, (2) llama al modelo dos veces (turno inicial + respuesta vaga "rápido / fácil / muchos usuarios"), (3) verifica que `submit_turn.detected_issues` incluye `vagueness`, (4) confirma idempotencia de DB (segundo insert con mismo `client_request_id` retorna Postgres `23505`), (5) persiste hallazgos y los relee como `open`, (6) ejecuta salto de sección y verifica que la anterior queda `incomplete` y la nueva `in_progress`, (7) borra el proyecto en cascada. Última corrida: **10/10 OK** con 3 hallazgos `vagueness` emitidos por el modelo en el turno vago.
- [x] 8.4 `get_advisors` (security + performance) sin issues críticos pendientes. Solo INFO no bloqueantes; ningún WARN/ERROR atribuible a esta migración.
- [x] 8.5 Integridad referencial garantizada por constraints en lugar de check manual: `turns.session_id` y `turns.project_id` son `not null` con FK; `detected_issues.project_id` es `not null` con FK. Inserts ilegales son rechazados por la DB.

## 9. Commit y archivado

- [x] 9.1 Commits agrupados en Conventional Commits sobre la rama `ia_engine`:
  - `ca90235` docs(openspec): add change proposal add-elicitation-engine
  - `84fd685` feat(db): add elicitation engine schema (turns, section progress, issues)
  - `c31afc2` feat(ai): add Anthropic client, prompts and turn context builder
  - `48229dd` feat(server): add elicitation server actions
  - `7954d15` feat(ui): add minimal elicitation chat UI
- [x] 9.2 Tras aprobación del usuario, ejecutar el workflow `/opsx:archive`: sync del delta al spec canónico (`openspec/specs/elicitation-engine/spec.md` ahora contiene los 5 requirements originales + los 7 ADDED del delta) y mover la carpeta a `openspec/changes/archive/2026-05-24-add-elicitation-engine/`.
