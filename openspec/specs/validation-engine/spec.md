# validation-engine

## Propósito

Motor de validación que corre bajo demanda y obligatoriamente pre-export. Calcula un score de salud 0-100, lista issues accionables por severidad y bloquea la exportación a PDF si hay issues `critical` sin resolver.

## Requirements

### Requirement: Cada historia tiene al menos un criterio Gherkin

El sistema DEBE reportar un issue `critical` si alguna `user_story` no tiene al menos un `acceptance_criteria` asociado.

#### Scenario: Historia sin criterios

- **DADO** una historia "Como admin, quiero exportar reportes, para auditoría" sin criterios
- **CUANDO** se ejecuta la validación
- **ENTONCES** se reporta issue `acceptance_criteria_missing` con severidad `critical` y referencia a la historia.

### Requirement: Al menos un NFR por categoría FURPS+ aplicable

El sistema DEBE pedir al menos un NFR por cada categoría FURPS+ (Functionality, Usability, Reliability, Performance, Supportability) marcada como `applicable` en el proyecto, con métrica medible.

#### Scenario: Performance sin métrica

- **DADO** un NFR de Performance con texto "el sistema debe ser rápido" sin métrica
- **CUANDO** se valida
- **ENTONCES** issue `nfr_lacks_metric` severity `critical`.

### Requirement: Glosario referenciado y completo

El sistema DEBE verificar que cada término técnico mencionado en historias, NFRs o scope esté definido en `glossary_terms`.

#### Scenario: Término "SLA" no definido

- **DADO** una historia que menciona "SLA"
- **CUANDO** "SLA" NO está en `glossary_terms`
- **ENTONCES** issue `glossary_missing` severity `warning`.

### Requirement: Ausencia de contradicciones semánticas

El sistema DEBE detectar requerimientos semánticamente contradictorios usando el motor de elicitación (LLM) y reportarlos como issues.

#### Scenario: Dos NFRs en conflicto

- **DADO** NFR1 "latencia < 100ms p99" y NFR2 "todas las requests pasan por validación síncrona de 500ms en backend externo"
- **CUANDO** se valida
- **ENTONCES** issue `semantic_contradiction` severity `critical` referenciando ambos NFRs.

### Requirement: Entidades referenciadas en historias están modeladas

El sistema DEBE verificar que cada `entity` mencionada en una historia esté presente en `entities` con al menos un atributo definido en `entity_attributes`.

#### Scenario: Entidad mencionada pero no modelada

- **DADO** historia que menciona "Pedido" pero `entities` no contiene "Pedido"
- **CUANDO** se valida
- **ENTONCES** issue `entity_undefined` severity `critical`.

### Requirement: Integraciones completas

El sistema DEBE verificar que cada `integration` tenga `endpoint`, `direction` (`in`|`out`|`bidirectional`), `format` y `frequency` definidos.

#### Scenario: Integración incompleta

- **DADO** una integración con `endpoint = null`
- **CUANDO** se valida
- **ENTONCES** issue `integration_incomplete` severity `critical`.

### Requirement: Score y panel accionable

El sistema DEBE exponer un score 0-100 calculado como `100 - sum(weight(issue))` con pesos: `critical=20`, `warning=5`, `info=1`, y la lista de issues ordenada por severidad y luego por categoría.

#### Scenario: Bloqueo de export

- **DADO** un proyecto con score 45 y 3 issues `critical`
- **CUANDO** el dueño intenta exportar el PDF
- **ENTONCES** el sistema bloquea la exportación y presenta los 3 issues como bloqueantes.
