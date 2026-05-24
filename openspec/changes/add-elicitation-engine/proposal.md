## Why

El producto no existe sin el motor conversacional. Iteración 0 dejó el shell de proyectos (CRUD) y el modelo de dominio base con RLS, pero ninguna pieza captura información: el motor es lo que convierte una sesión con un stakeholder en historias, NFR, entidades y hallazgos. Sin él, `validation-engine` no tiene qué validar y `pdf-export` no tiene qué exportar.

El spec base de `elicitation-engine` ya describe el comportamiento esperado (recorrido por secciones, detección de vaguedad/contradicciones, cross-cutting, trazabilidad). Esta propuesta cubre el "cómo": estructura de tablas adicional, integración con el SDK de Anthropic, prompts versionados, manejo de errores y la UI mínima necesaria para ejercer el motor extremo a extremo en modo consultor.

## What Changes

- **DB**: migración `0003_elicitation_engine.sql` que (a) extiende `public.sessions` con `current_section`, `status`, `closed_at`; (b) crea `public.turns` como log append-only de la conversación; (c) crea `public.project_section_progress` como proyección desnormalizada del avance por sección; (d) crea `public.detected_issues` para hallazgos accionables del motor; (e) añade enums `elicitation_section`, `turn_role`, `turn_status`, `section_status`, `issue_type`, `issue_severity`, `issue_status`; (f) RLS forzada en todas las nuevas tablas con ownership transitivo por `projects.owner_id`.
- **Cliente IA**: `src/lib/ai/anthropic.ts` (factory con modelo configurable, retry exponencial, timeout) + Zod schemas para input/output del motor.
- **Prompts**: `src/lib/ai/prompts/` con system prompt, prompts por sección (11) y schema de `tool_use` para forzar salida estructurada (pregunta principal, detecciones, sugerencias de seguimiento, marca de avance).
- **Server Actions**: `src/server/elicitation/` con `startSession`, `sendTurn`, `jumpToSection`, `listTurns`, `resolveIssue`, `closeSession`, todas con validación Zod e idempotencia por `client_request_id`.
- **UI mínima**: ruta `src/app/projects/[id]/elicit/` con shell de chat (lista de turnos, input, selector de sección, panel de issues abiertos). NO es la UI rica de modo consultor — solo el mínimo para validar el motor en sesión real.
- **Spec delta**: `elicitation-engine` gana 7 requirements nuevos sobre persistencia, salida estructurada del modelo, reintentos, idempotencia y ventana de contexto.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `elicitation-engine`: se añaden requirements de persistencia (turnos append-only, proyección por sección, hallazgos), salida estructurada del modelo, política de reintentos y fallos, idempotencia de envío y ventana de contexto. Los 5 requirements existentes permanecen intactos.

## Impact

- **Código nuevo**: `src/lib/ai/`, `src/server/elicitation/`, `src/components/elicitation/`, `src/app/projects/[id]/elicit/page.tsx`.
- **Dependencias**: `@anthropic-ai/sdk` (nueva). Zod ya está en el stack.
- **Migración SQL**: una sola (`0003_elicitation_engine.sql`), aplicada vía MCP `apply_migration` y reflejada como archivo versionado en `supabase/migrations/`.
- **Tipos TS**: regenerar `src/lib/db/types.ts` tras la migración.
- **Variables de entorno**: `ANTHROPIC_API_KEY` y `ANTHROPIC_MODEL` ya declaradas en `.env.example`; se validan al boot con Zod y el servidor falla rápido si faltan.
- **Costo runtime**: cada turno consume tokens del API de Anthropic; cada turno persiste `token_usage` para auditoría posterior.
- **Out of scope explícito (ver `design.md` no-goals)**: streaming SSE, UI rica de consultor (palette, multi-participante), tokens de autoservicio, embeddings/pgvector, integración con anotaciones privadas.

## Dependencias

- Requiere migración `0001_init_domain` (ya aplicada): usa `public.sessions`, `public.session_actor`, `public.project_mode`, helper `public.user_owns_project`.
- Requiere autenticación con Supabase Auth (ya en su lugar desde el commit de proyectos): `auth.uid()` se usa para RLS y `created_by` de turnos.
- Bloquea: `consultant-mode` (necesita el motor para tener algo que renderizar), `self-service-mode` (mismo), `validation-engine` (consume `detected_issues` y secciones marcadas como `complete`).

## Riesgos

- **Calidad de prompts**: preguntas repetitivas o irrelevantes si los prompts no están bien calibrados. Mitigación: prompts en archivos versionados, iteración cualitativa con sesiones reales tras el merge.
- **Costo de tokens en sesiones largas**: el contexto crece con cada turno. Mitigación: ventana deslizante de últimos N=20 turnos de la sección actual + "project facts" compactos regenerados; prompt caching de Anthropic cuando aplique.
- **Falsos positivos en detección de contradicciones por prompt**: el modelo puede marcar conflictos inexistentes. Mitigación: los `detected_issues` son no-bloqueantes; el consultor puede `dismiss`.
- **Salida malformada del modelo**: si el JSON no respeta el schema, el turno queda incompleto. Mitigación: `tool_use` con schema forzado + Zod estricto + parser tolerante de último recurso + log del fallo.
- **Race conditions en envío de turnos**: doble-click o retry del cliente persiste duplicados. Mitigación: `client_request_id` único por turno con índice único parcial en DB.
