## Context

Iteración 0 dejó el modelo de dominio base (proyectos, stakeholders, historias, NFR, entidades, integraciones, glosario) con RLS forzada en todas las tablas y un CRUD de proyectos funcionando contra Supabase. La tabla `public.sessions` ya existe pero está en forma de stub (id, project_id, mode, started_at, ended_at, notes) y no se usa todavía.

Esta propuesta es la primera implementación funcional del motor conversacional. Tiene que decidir cómo se persisten los turnos, cómo se llama al modelo, cómo se estructura la salida del modelo, qué se envía como contexto, y cómo se manejan los fallos de red/SDK. Algunas de esas decisiones no son obvias y por eso quedan registradas aquí.

## Goals / Non-Goals

**Goals:**

- Diálogo turno-a-turno persistente con trazabilidad completa (quién dijo qué, cuándo, en qué sección).
- Detecciones (vaguedad, contradicciones, cross-cutting, métricas ausentes, glosario referenciado) producidas en el mismo turno del modelo, sin segundo round-trip.
- Recorrido por las 11 secciones con saltos no-lineales sin perder el estado agregado por sección.
- Manejo robusto de fallos del SDK Anthropic: retries acotados, persistencia del fallo, reintento manual desde la UI.
- Salida estructurada del modelo verificable con Zod, no parsing best-effort de texto libre.
- Idempotencia de envío de turnos para sobrevivir doble-clicks y retries del cliente.

**Non-Goals:**

- **Streaming SSE**: respuesta completa por turno en esta propuesta. Streaming queda como cambio futuro (`add-elicitation-streaming`) sin romper contratos de DB.
- **UI rica de consultor**: solo el shell mínimo (lista de turnos, input, selector de sección, panel de issues). Command palette, multi-participante y atajos vienen en `add-consultant-mode-ui`.
- **Tokens de autoservicio**: stakeholder sin cuenta Supabase queda para `add-self-service-mode`.
- **pgvector / embeddings**: detección de contradicciones por prompt en esta propuesta. Si la calidad no alcanza tras uso real, se evalúa pgvector en cambio futuro.
- **Anotaciones privadas del consultor inyectadas al prompt**: explícitamente fuera. Las anotaciones existen como tabla pero no se envían al modelo; decisión documentada para que el consultor confíe en el aislamiento.
- **Telemetría persistente de llamadas al modelo**: en iteración 1 logging va a `console`. Sink persistente vendrá en cambio futuro.

## Decisions

### 1. Estructura: `sessions` + `turns` + `project_section_progress` + `detected_issues`

Separamos tres responsabilidades distintas que típicamente se mezclan mal:

- `sessions`: identidad y estado de la conversación (modo, sección actual, status, timestamps). Se extiende la tabla existente, no se reemplaza.
- `turns`: log append-only inmutable. Cualquier reconstrucción histórica es replay por `created_at`.
- `project_section_progress`: proyección desnormalizada por (project_id, section). Se actualiza desde server actions tras turnos relevantes. Permite mostrar "salud del levantamiento" sin scan de turnos.
- `detected_issues`: hallazgos accionables del motor con FK a `turn_id` y `project_id`. Sobreviven al cierre de sesión y siguen visibles hasta que el consultor los resuelve o descarta.

**Alternativa rechazada**: una sola tabla `turns` y reconstruir todo desde el log. Razón: cada lectura de "salud" de un proyecto sería un scan completo de turnos; la proyección cuesta poco mantener y la lectura es O(1) por sección.

### 2. Streaming: difiero, respuesta completa por turno

Next.js 16 + Server Actions soportan streaming (incluyendo `streamUI` del Vercel AI SDK), pero introduce complejidad real: manejo de estado parcial en cliente, cancelación, reconciliación si el stream se corta. En iteración 1 el valor está en validar calidad de prompts y comportamiento conversacional, no en optimizar UX percibida.

La latencia esperada por turno es 3–8s con Sonnet/Opus. Un loading state simple es aceptable. El contrato DB (turnos append-only, `payload` jsonb) no cambia cuando se introduzca streaming, así que el cambio futuro será aditivo.

### 3. Salida del modelo: `tool_use` con schema forzado

El motor necesita en un solo turno: pregunta principal, sugerencias de seguimiento, detecciones (vaguedad/contradicción/cross-cutting/métrica/glosario), marca de avance de sección, y "facts" extraídos del turno previo del usuario. Hacer esto con texto libre + regex/parser es frágil.

Decisión: definir un único tool `submit_turn` con `input_schema` JSON-schema. El modelo está forzado por el system prompt a responder llamando ese tool. El backend valida con Zod estricto el `tool_input` antes de persistir.

**Plan B** (si `tool_use` falla por algún motivo): pedir JSON en el texto con un schema documentado en el system prompt y parsear con Zod tolerante. Pero `tool_use` es la primera opción.

### 4. Ventana de contexto enviada al modelo

Enviar todo el historial es caro y se desborda en sesiones largas. El contexto por turno se arma así:

- System prompt fijo (cacheable cuando el SDK soporte prompt caching).
- "Project facts" compactos: bullet list de stakeholders, scope, NFR ya capturados, generada bajo demanda desde las tablas del dominio. Tope blando ≤1k tokens. Sirve también de base para detectar contradicciones cross-section.
- Últimos N=20 turnos de la sección actual, en orden temporal.
- En secciones que dependen de otras (p. ej. `user_stories` referencia stakeholders y entidades), incluir un sub-bloque "facts relevantes" agregado a project facts.

N=20 es default ajustable; queda como constante en `src/lib/ai/context.ts`.

### 5. Política de reintentos y fallos del SDK

- Wrapper `callModel` con retry exponencial: 3 intentos, delays 1s/2s/4s con jitter (`±25%`).
- Reintentar **solo** 429, 5xx, network errors y timeouts. NO reintentar 400 (input inválido) ni 401 (auth) — esos son errores de programación.
- Timeout duro 30s por intento.
- Si tras 3 intentos falla: persistir un turno `role='meta'`, `status='failed'`, con `error_code` y `payload.errorMessage`. El input del usuario nunca se pierde porque su turno se persistió ANTES de llamar al modelo.
- La UI muestra el turno fallido con un botón "Reintentar" que reenvía con un nuevo `client_request_id`.

### 6. Idempotencia de envío de turnos

Doble-clicks y retries del cliente HTTP pueden disparar el mismo `sendTurn` dos veces. Cada envío recibe un `clientRequestId` (uuid v4 generado en cliente) que viaja al server. La columna `turns.client_request_id` tiene índice único parcial: si el cliente reintenta, el `INSERT … ON CONFLICT DO NOTHING` deja un único turno persistido.

Esto también protege al modelo: si el segundo envío llega antes de que la llamada al modelo del primero termine, el server detecta el conflicto y devuelve el turno ya existente.

### 7. Detección semántica de contradicciones: prompt-only en iteración 1

`pgvector` está diferido en el `project.md` de iteración 0. Para iteración 1 las contradicciones se detectan en el mismo turno: el modelo recibe los "facts" extraídos en turnos previos y se le instruye explícitamente a marcar `detected_issues` de tipo `contradiction` cuando la respuesta actual entre en conflicto.

Si la calidad de esta detección resulta insuficiente en uso real, se considera `pgvector` + recuperación semántica en un cambio futuro (`add-semantic-contradiction-detection`).

### 8. Anotaciones privadas del consultor: NO entran al prompt

La tabla `annotations` ya existe y está pensada como notas que no aparecen en el PDF. Para confianza del consultor, en iteración 1 tampoco entran al contexto enviado al modelo. Si en el futuro queremos aprovecharlas para guiar las preguntas, viene en cambio explícito con marcado claro de qué entra y qué no.

### 9. RLS: ownership transitivo por `project_id`

Todas las nuevas tablas (`turns`, `project_section_progress`, `detected_issues`) llevan `project_id` directo (no solo `session_id`) para que las policies usen el helper `public.user_owns_project(project_id)` ya existente sin joins. Esto duplica un poco el dato (cada turno carga `project_id` además de `session_id`) pero abarata enormemente las policies y los queries de lectura por proyecto.

### 10. Server Actions devuelven errores tipados, no excepciones

Convención: cada server action retorna `{ ok: true, data }` o `{ ok: false, error: { code, message } }`. Excepciones se capturan internamente y se mapean a `error.code` conocido. Razón: las Server Actions de Next 16 serializan errores de forma opaca para el cliente; tipar el error explícitamente da mejor UX y telemetría.

## Risks / Trade-offs

- **Calidad de prompts**: el comportamiento del motor depende mucho del system prompt y los per-section prompts. Mitigación: los prompts son archivos versionados; iterar con sesiones reales tras el merge inicial es esperado y barato.
- **Costo de tokens**: cada turno gasta tokens. Mitigación: ventana deslizante N=20 + project facts compactos. El usuario ve `token_usage` por turno en la DB si quiere auditar.
- **Falsos positivos en contradicciones por prompt**: aceptable porque los `detected_issues` no bloquean el flujo y el consultor puede `dismiss`.
- **Salida malformada del modelo**: aunque `tool_use` reduce esto a casi cero, persiste el caso patológico. Mitigación: Zod estricto + fallback de parser tolerante + persistir `status='failed'` y mostrar reintento en UI.
- **Cambio de modelo (`ANTHROPIC_MODEL` env var)**: si el operador cambia el modelo en runtime los prompts pueden comportarse distinto. Mitigación: documentar en README que tras cambiar modelo conviene revisar prompts y correr el smoke test de sesión.
- **Trade-off explícito**: NO streaming sacrifica UX percibida pero ahorra complejidad real. Aceptado para iteración 1.
- **Trade-off explícito**: NO usar anotaciones del consultor en el prompt sacrifica contexto extra pero protege la confianza del consultor en el aislamiento. Aceptado.
- **Trade-off explícito**: `client_request_id` puede llenarse o quedar nulo según el cliente; el índice único es parcial para no rechazar inserts sin id. Vale la pena el costo del índice parcial frente a duplicados.
