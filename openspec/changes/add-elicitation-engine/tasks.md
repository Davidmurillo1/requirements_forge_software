## 1. Diseño de esquema y enums

- [ ] 1.1 Definir enum `public.elicitation_section` con las 11 secciones (`project_context`, `stakeholders_personas`, `scope`, `business_process`, `user_stories`, `nfrs`, `domain_data`, `integrations`, `ui_ux`, `constraints_assumptions_risks`, `glossary`).
- [ ] 1.2 Definir enum `public.turn_role` (`question`, `answer`, `followup`, `system`, `meta`).
- [ ] 1.3 Definir enum `public.turn_status` (`ok`, `failed`).
- [ ] 1.4 Definir enum `public.section_status` (`not_started`, `in_progress`, `incomplete`, `complete`).
- [ ] 1.5 Definir enums `public.issue_type` (`vagueness`, `contradiction`, `missing_cross_cutting`, `missing_metric`, `undefined_glossary`), `public.issue_severity` (`info`, `warning`, `error`), `public.issue_status` (`open`, `resolved`, `dismissed`).
- [ ] 1.6 Definir enum `public.session_status` (`active`, `closed`, `abandoned`) y agregar columnas a `public.sessions`: `current_section public.elicitation_section`, `status public.session_status default 'active'`, `closed_at timestamptz`.

## 2. Migración SQL (depende de 1.x)

- [ ] 2.1 Redactar `supabase/migrations/0003_elicitation_engine.sql` con los enums (1.1–1.6) y `ALTER TABLE public.sessions`.
- [ ] 2.2 Crear tabla `public.turns` (append-only) con columnas `id`, `session_id`, `project_id`, `actor public.session_actor`, `role public.turn_role`, `section public.elicitation_section`, `payload jsonb not null`, `token_usage jsonb`, `status public.turn_status default 'ok'`, `error_code text`, `client_request_id uuid`, `created_at`. Índices: `(session_id, created_at)`, único parcial `(session_id, client_request_id) where client_request_id is not null`.
- [ ] 2.3 Crear tabla `public.project_section_progress` con PK compuesta `(project_id, section)`, columnas `status public.section_status default 'not_started'`, `completion_score smallint check (completion_score between 0 and 100)`, `last_updated_at`.
- [ ] 2.4 Crear tabla `public.detected_issues` con `id`, `project_id`, `session_id`, `turn_id`, `type public.issue_type`, `severity public.issue_severity`, `title text`, `body text`, `status public.issue_status default 'open'`, `resolution_note text`, `resolved_at timestamptz`, `resolved_by uuid`, `created_at`, `updated_at`.
- [ ] 2.5 Habilitar `enable row level security` y `force row level security` en `turns`, `project_section_progress`, `detected_issues`. Políticas `select`/`insert`/`update`/`delete` con `public.user_owns_project(project_id)`.
- [ ] 2.6 Triggers `set_updated_at` en `detected_issues` y `project_section_progress` (reusar función existente).
- [ ] 2.7 Aplicar migración con MCP `apply_migration`, ejecutar `get_advisors` (security + performance), corregir issues críticos antes de continuar.
- [ ] 2.8 Regenerar tipos TS con MCP `generate_typescript_types` y sobrescribir `src/lib/db/types.ts`.

## 3. Cliente del SDK Anthropic (depende de 2.8)

- [ ] 3.1 Instalar `@anthropic-ai/sdk` con la versión major actual; pinear en `package.json`.
- [ ] 3.2 Crear `src/lib/ai/env.ts`: validación Zod de `ANTHROPIC_API_KEY` y `ANTHROPIC_MODEL` (default al último Sonnet); fail-fast si faltan en runtime de servidor.
- [ ] 3.3 Crear `src/lib/ai/anthropic.ts`: factory `getAnthropicClient()` con timeout 30s y wrapper `callModel(input)` que aplica retry exponencial (3 intentos, 1s/2s/4s con jitter) solo para 429, 5xx, network/timeout. NO reintentar 400/401.
- [ ] 3.4 Crear `src/lib/ai/schemas.ts` con Zod schemas: `TurnRequest`, `SubmitTurnPayload` (output del tool_use: `question`, `suggested_followups[]`, `detected_issues[]`, `section_advance`, `fact_extraction[]`).
- [ ] 3.5 Definir el tool `submit_turn` con `input_schema` JSON-schema equivalente al Zod de 3.4 para forzar salida estructurada vía `tool_use` de Anthropic.

## 4. Prompts (depende de 3.4)

- [ ] 4.1 Crear `src/lib/ai/prompts/system.ts` con el system prompt maestro (rol, idioma, principios SDD, instrucción de devolver siempre `submit_turn`).
- [ ] 4.2 Crear `src/lib/ai/prompts/sections/` con un archivo por sección (11) que guía qué preguntar en esa sección.
- [ ] 4.3 Crear `src/lib/ai/prompts/detectors.ts` con instrucciones embebidas en el system prompt para detectar vaguedad, contradicciones con `fact_extraction` previo, métricas ausentes, términos sin glosario y cross-cutting concerns faltantes.
- [ ] 4.4 Crear `src/lib/ai/context.ts` con `buildTurnContext(sessionId)`: arma el array `messages` con (a) últimos N=20 turnos de la sección actual y (b) project-facts compactos (lista de facts extraídos por turnos previos, ≤1k tokens). Marcar bloques cacheables si el SDK lo soporta.

## 5. Server Actions (depende de 4.x y 2.8)

- [ ] 5.1 `src/server/elicitation/startSession.ts`: validar ownership del proyecto (RLS lo hace, pero también check explícito), insertar `sessions(mode, current_section='project_context', status='active')`, llamar al modelo para producir el primer turno y devolver `{ sessionId, firstTurn }`.
- [ ] 5.2 `src/server/elicitation/sendTurn.ts`: recibe `{ sessionId, clientRequestId, userMessage }`, persiste el turno `answer` del usuario (upsert idempotente por `client_request_id`), llama al modelo con `buildTurnContext`, persiste el turno `question` del motor con su `payload` y `token_usage`. Extrae `detected_issues[]` y los inserta en `detected_issues` con FK a `turn_id`. Si el modelo devuelve `section_advance.complete=true`, actualizar `project_section_progress` y `sessions.current_section`.
- [ ] 5.3 `src/server/elicitation/jumpToSection.ts`: actualiza `sessions.current_section`, marca la sección anterior como `incomplete` (si no estaba `complete`) en `project_section_progress`, inserta un turno `meta` documentando el salto.
- [ ] 5.4 `src/server/elicitation/listTurns.ts`: lectura paginada ordenada por `created_at`, filtrable por `sessionId` o `projectId+section`.
- [ ] 5.5 `src/server/elicitation/resolveIssue.ts`: cambia `detected_issues.status` a `resolved` o `dismissed` con `resolution_note`, `resolved_at`, `resolved_by`.
- [ ] 5.6 `src/server/elicitation/closeSession.ts`: `sessions.status='closed'`, `closed_at=now()`. No borra nada.
- [ ] 5.7 Cada action valida input con Zod y retorna `{ ok: true, ... }` o `{ ok: false, error: { code, message } }` sin tirar excepciones al cliente.

## 6. Manejo de errores end-to-end (depende de 5.x)

- [ ] 6.1 En `sendTurn`: si tras los 3 retries el cliente Anthropic falla, persistir un turno `role='meta'`, `status='failed'`, `error_code` y `payload.errorMessage`. NO bloquear la sesión.
- [ ] 6.2 Server Actions devuelven errores tipados; el cliente decide si mostrar "Reintentar" o un toast informativo.
- [ ] 6.3 Logging server-side de cada llamada al modelo (modelo, tokens, latencia, status). En iteración 1 a `console`; siguiente cambio podrá enviarlos a un sink persistente.

## 7. UI mínima de elicitación (depende de 5.x)

- [ ] 7.1 Ruta `src/app/projects/[id]/elicit/page.tsx`: RSC que carga la sesión activa (o muestra botón "Iniciar sesión").
- [ ] 7.2 `src/components/elicitation/TurnList.tsx`: renderiza turnos en orden temporal, distingue actor (`engine` | `consultant` | `stakeholder`) y rol; turnos `failed` muestran botón "Reintentar".
- [ ] 7.3 `src/components/elicitation/TurnInput.tsx`: textarea + botón "Enviar" deshabilitado mientras carga; genera `clientRequestId` (uuid v4) por envío.
- [ ] 7.4 `src/components/elicitation/SectionSelector.tsx`: dropdown de 11 secciones con indicador de estado de cada una; llama a `jumpToSection` al cambiar.
- [ ] 7.5 `src/components/elicitation/IssuePanel.tsx`: lista de `detected_issues` abiertos del proyecto agrupados por tipo, con botones "Resolver" / "Descartar".
- [ ] 7.6 Sin estado global: usar RSC + Server Actions; las mutaciones revalidan la ruta con `revalidatePath`.

## 8. Verificación (depende de todo lo anterior)

- [ ] 8.1 `npm run lint` y `npm run build` pasan sin warnings.
- [ ] 8.2 `openspec validate add-elicitation-engine --strict` pasa.
- [ ] 8.3 Smoke test manual: crear proyecto → iniciar sesión → enviar 3 turnos → forzar respuesta vaga ("queremos algo rápido") y verificar que aparece un `detected_issue` de tipo `vagueness` → saltar de sección → cerrar sesión.
- [ ] 8.4 `get_advisors` (security + performance) sin issues críticos pendientes.
- [ ] 8.5 Verificar en SQL que no hay turnos sin `session_id` válido ni `detected_issues` sin `project_id`.

## 9. Commit y archivado

- [ ] 9.1 Commit por agrupación: `feat(db)`, `feat(ai)`, `feat(server)`, `feat(ui)`, todos en Conventional Commits.
- [ ] 9.2 Tras aprobación y merge, ejecutar `openspec archive add-elicitation-engine` para fusionar el delta al spec principal.
