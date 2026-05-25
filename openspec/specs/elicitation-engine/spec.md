# elicitation-engine

## Purpose

Motor conversacional impulsado por la API de Claude que conduce el levantamiento sección por sección. Hace preguntas abiertas, seguimientos contextuales, detecta vaguedad y contradicciones, y sugiere cross-cutting concerns. Persiste cada turno con trazabilidad completa (`session_id`, `actor`, `timestamp`).

## Requirements

### Requirement: Recorrido por secciones con saltos no-lineales

El sistema **MUST** recorrer estas secciones en orden lógico pero **MUST** permitir saltos del usuario a cualquier sección:

1. Contexto del proyecto y caso de negocio
2. Stakeholders y personas
3. Alcance (in/out)
4. Proceso de negocio soportado
5. Historias de usuario
6. Requerimientos no funcionales (FURPS+ con métricas)
7. Datos y entidades del dominio
8. Integraciones con sistemas externos
9. Consideraciones de UI/UX
10. Restricciones, supuestos, riesgos
11. Glosario / lenguaje ubicuo

#### Scenario: Salto del usuario a sección posterior

- **DADO** un usuario en la sección "Stakeholders"
- **CUANDO** elige saltar a "Integraciones"
- **ENTONCES** el motor inicia preguntas de integraciones sin exigir completitud de stakeholders, marcando la sección saltada como `incomplete`.

### Requirement: Detección de vaguedad

El motor **MUST** detectar respuestas con lenguaje vago (p. ej., "rápido", "fácil de usar", "muchos usuarios") y solicitar métrica concreta.

#### Scenario: "Rápido" sin métrica

- **DADO** el usuario responde "queremos que sea rápido" a una pregunta sobre performance
- **CUANDO** el motor procesa la respuesta
- **ENTONCES** repregunta solicitando métrica medible (ej. "¿latencia objetivo en ms para qué percentil bajo qué carga?") y NO persiste la respuesta vaga como NFR final.

### Requirement: Detección de contradicciones

El motor **MUST** detectar contradicciones semánticas entre afirmaciones del usuario dentro de una sesión y entre sesiones, y presentarlas al consultor.

#### Scenario: Contradicción entre historias

- **DADO** una historia previa establece "el sistema permite a cualquier usuario eliminar registros"
- **CUANDO** el usuario afirma "solo administradores pueden eliminar registros"
- **ENTONCES** el motor presenta ambas afirmaciones, marca conflicto y solicita resolución del consultor antes de persistir.

### Requirement: Sugerencias de cross-cutting concerns

El motor **MUST** proponer revisar cross-cutting concerns típicos cuando detecte avance significativo del levantamiento: auditoría, backups, accesibilidad (WCAG), i18n, roles, logging, observabilidad, exportación, cumplimiento (LGPD/GDPR).

#### Scenario: Recordatorio de accesibilidad

- **DADO** el usuario completó las secciones de UI/UX e historias
- **CUANDO** no hay ningún NFR referente a accesibilidad
- **ENTONCES** el motor sugiere abrir la discusión de WCAG y propone NFRs candidatos.

### Requirement: Trazabilidad por turno

Cada turno de la conversación (pregunta del motor, respuesta del usuario) **MUST** persistirse con `session_id`, `actor` (`engine` | `participant_uuid`), `timestamp`, `section`, y `payload`. La trazabilidad **MUST** permitir reconstruir qué dijo quién y cuándo.

#### Scenario: Reconstrucción de sesión

- **DADO** una sesión cerrada hace 30 días con 50 turnos
- **CUANDO** el consultor pide ver el histórico
- **ENTONCES** el sistema reconstruye la sesión turno por turno respetando orden temporal y autor.

### Requirement: Persistencia turno-a-turno append-only

El sistema **MUST** persistir cada turno (pregunta del motor, respuesta del usuario, meta-eventos como saltos o fallos) en una tabla `public.turns` append-only. Las inserciones son las únicas operaciones de escritura habituales; las actualizaciones se reservan para corregir errores de datos y **MUST NOT** reescribir el contenido original del turno.

#### Scenario: Reconstrucción exacta por replay

- **DADO** una sesión con 50 turnos persistidos
- **CUANDO** el consultor pide ver el histórico de la sesión
- **ENTONCES** el sistema retorna los 50 turnos ordenados por `created_at` ascendente sin huecos ni mutaciones del payload original.

#### Scenario: El input del usuario no se pierde aunque el modelo falle

- **DADO** el usuario envía una respuesta
- **CUANDO** el servidor persiste el turno del usuario, llama al modelo y el modelo falla tras los reintentos
- **ENTONCES** el turno del usuario queda persistido con `status='ok'` y se añade un turno adicional `role='meta'`, `status='failed'` documentando el fallo, sin borrar ni mutar el turno del usuario.

### Requirement: Proyección de avance por sección

El sistema **MUST** mantener una proyección desnormalizada `public.project_section_progress` con clave `(project_id, section)` y columnas `status` (`not_started` | `in_progress` | `incomplete` | `complete`), `completion_score` (0-100) y `last_updated_at`. La proyección se actualiza desde el servidor tras turnos relevantes (avance de sección, salto, cierre de sesión).

#### Scenario: Lectura O(1) del avance del proyecto

- **DADO** un proyecto con 5 sesiones y 120 turnos totales
- **CUANDO** la UI carga el panel de avance del levantamiento
- **ENTONCES** el sistema lee el estado de las 11 secciones desde `project_section_progress` sin escanear `turns`.

#### Scenario: Sección marcada incompleta al saltar antes de cerrarla

- **DADO** una sección con `status='in_progress'`
- **CUANDO** el consultor salta a otra sección sin marcar la actual como `complete`
- **ENTONCES** `project_section_progress` para la sección original pasa a `status='incomplete'`.

### Requirement: Hallazgos accionables persistidos

El sistema **MUST** persistir los hallazgos del motor (vaguedad, contradicciones, métricas ausentes, términos sin glosario, cross-cutting concerns faltantes) en `public.detected_issues` con FK a `project_id`, `session_id` y `turn_id`. Cada hallazgo tiene `type`, `severity`, `title`, `body`, `status` (`open` | `resolved` | `dismissed`) y opcionalmente `resolution_note`. Los hallazgos **MUST** sobrevivir al cierre de sesión.

#### Scenario: Hallazgos visibles después de cerrar sesión

- **DADO** una sesión cerrada con 4 hallazgos `open`
- **CUANDO** el consultor abre el proyecto al día siguiente
- **ENTONCES** los 4 hallazgos siguen visibles en el panel del proyecto hasta que el consultor los resuelva o descarte.

#### Scenario: Resolver hallazgo no borra el turno de origen

- **DADO** un hallazgo `open` vinculado a `turn_id=T`
- **CUANDO** el consultor lo marca `resolved` con nota de cierre
- **ENTONCES** el hallazgo pasa a `status='resolved'` con `resolved_at` y `resolved_by`, y el turno `T` permanece intacto en `turns`.

### Requirement: Salida estructurada del modelo en una sola llamada

El motor **MUST** obtener en una única llamada al modelo todos los elementos necesarios del turno: pregunta principal, sugerencias de seguimiento, hallazgos detectados, marca de avance de sección y "facts" extraídos. La salida se obtiene mediante `tool_use` de Anthropic invocando un tool `submit_turn` con `input_schema` JSON-schema; el backend **MUST** validar la respuesta con Zod estricto antes de persistir.

#### Scenario: Output validado y persistido

- **DADO** el modelo responde llamando al tool `submit_turn` con `{ question, suggested_followups, detected_issues, section_advance, fact_extraction }` conforme al schema
- **CUANDO** el servidor recibe la respuesta
- **ENTONCES** Zod valida el payload, el turno del motor se persiste con `payload` igual al input del tool, y los `detected_issues[]` se insertan en `public.detected_issues`.

#### Scenario: Salida malformada degrada controladamente

- **DADO** el modelo devuelve texto libre en vez de invocar el tool
- **CUANDO** el servidor procesa la respuesta
- **ENTONCES** el parser tolerante intenta extraer JSON; si falla, persiste un turno `role='meta'`, `status='failed'`, `error_code='malformed_output'` y la UI ofrece reintentar.

### Requirement: Política de reintentos y fallos del SDK

El cliente del SDK Anthropic **MUST** aplicar retry exponencial (3 intentos, 1s / 2s / 4s con jitter) únicamente para 429, 5xx, errores de red y timeouts. **MUST NOT** reintentar 400 ni 401. Cada intento tiene timeout duro de 30s. Si los 3 intentos fallan, el servidor **MUST** persistir un turno `role='meta'`, `status='failed'`, `error_code` con el código del último error y `payload.errorMessage` con el detalle.

#### Scenario: 429 transitorio se recupera

- **DADO** el modelo devuelve 429 en el primer intento y 200 en el segundo
- **CUANDO** el servidor procesa el turno
- **ENTONCES** el segundo intento tiene éxito y solo un turno del motor se persiste con `status='ok'`.

#### Scenario: 401 no reintenta

- **DADO** el modelo devuelve 401 (API key inválida)
- **CUANDO** el servidor procesa el turno
- **ENTONCES** NO se hacen reintentos y un turno `role='meta'`, `status='failed'`, `error_code='unauthorized'` queda persistido.

### Requirement: Idempotencia de envío de turnos

Cada envío de turno del usuario **MUST** incluir un `client_request_id` (uuid v4 generado por el cliente). La tabla `public.turns` **MUST** tener un índice único parcial sobre `(session_id, client_request_id)` para que reintentos del cliente no persistan duplicados.

#### Scenario: Doble-click no duplica el turno

- **DADO** el cliente envía dos veces el mismo turno con idéntico `client_request_id`
- **CUANDO** el servidor procesa ambos envíos
- **ENTONCES** un solo turno del usuario queda persistido y un único turno del motor se produce como respuesta.

#### Scenario: Reintento manual usa nuevo id

- **DADO** un turno previamente fallido por el botón "Reintentar"
- **CUANDO** la UI envía el mismo input del usuario con un `client_request_id` nuevo
- **ENTONCES** el servidor lo trata como envío independiente y persiste un turno nuevo.

### Requirement: Ventana de contexto enviada al modelo

El servidor **MUST** construir el contexto enviado al modelo combinando: (a) system prompt fijo, (b) "project facts" compactos derivados del dominio capturado (≤1k tokens), (c) últimos N=20 turnos de la sección actual ordenados por `created_at`, y (d) en secciones que dependen de otras, un bloque de "facts cross-section" relevante.

#### Scenario: Sesión larga no envía todo el historial

- **DADO** una sesión con 80 turnos en la sección actual
- **CUANDO** el servidor construye el contexto para el siguiente turno
- **ENTONCES** envía solamente los últimos 20 turnos de esa sección al modelo, no los 80.

#### Scenario: Contradicciones cross-section ven los facts relevantes

- **DADO** el usuario está en la sección `user_stories` y previamente en `stakeholders_personas` definió que el rol "Operador" solo lee datos
- **CUANDO** escribe una historia donde "Operador" elimina registros
- **ENTONCES** el contexto enviado al modelo incluye el fact previo del rol "Operador" y el modelo puede emitir un `detected_issues` de tipo `contradiction`.
