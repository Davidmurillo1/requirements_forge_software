# elicitation-engine

## Propósito

Motor conversacional impulsado por la API de Claude que conduce el levantamiento sección por sección. Hace preguntas abiertas, seguimientos contextuales, detecta vaguedad y contradicciones, y sugiere cross-cutting concerns. Persiste cada turno con trazabilidad completa (`session_id`, `actor`, `timestamp`).

## Requirements

### Requirement: Recorrido por secciones con saltos no-lineales

El sistema DEBE recorrer estas secciones en orden lógico pero PERMITIR saltos del usuario a cualquier sección:

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

El motor DEBE detectar respuestas con lenguaje vago (p. ej., "rápido", "fácil de usar", "muchos usuarios") y solicitar métrica concreta.

#### Scenario: "Rápido" sin métrica

- **DADO** el usuario responde "queremos que sea rápido" a una pregunta sobre performance
- **CUANDO** el motor procesa la respuesta
- **ENTONCES** repregunta solicitando métrica medible (ej. "¿latencia objetivo en ms para qué percentil bajo qué carga?") y NO persiste la respuesta vaga como NFR final.

### Requirement: Detección de contradicciones

El motor DEBE detectar contradicciones semánticas entre afirmaciones del usuario dentro de una sesión y entre sesiones, y presentarlas al consultor.

#### Scenario: Contradicción entre historias

- **DADO** una historia previa establece "el sistema permite a cualquier usuario eliminar registros"
- **CUANDO** el usuario afirma "solo administradores pueden eliminar registros"
- **ENTONCES** el motor presenta ambas afirmaciones, marca conflicto y solicita resolución del consultor antes de persistir.

### Requirement: Sugerencias de cross-cutting concerns

El motor DEBE proponer revisar cross-cutting concerns típicos cuando detecte avance significativo del levantamiento: auditoría, backups, accesibilidad (WCAG), i18n, roles, logging, observabilidad, exportación, cumplimiento (LGPD/GDPR).

#### Scenario: Recordatorio de accesibilidad

- **DADO** el usuario completó las secciones de UI/UX e historias
- **CUANDO** no hay ningún NFR referente a accesibilidad
- **ENTONCES** el motor sugiere abrir la discusión de WCAG y propone NFRs candidatos.

### Requirement: Trazabilidad por turno

Cada turno de la conversación (pregunta del motor, respuesta del usuario) DEBE persistirse con `session_id`, `actor` (`engine` | `participant_uuid`), `timestamp`, `section`, y `payload`. La trazabilidad debe permitir reconstruir qué dijo quién y cuándo.

#### Scenario: Reconstrucción de sesión

- **DADO** una sesión cerrada hace 30 días con 50 turnos
- **CUANDO** el consultor pide ver el histórico
- **ENTONCES** el sistema reconstruye la sesión turno por turno respetando orden temporal y autor.
