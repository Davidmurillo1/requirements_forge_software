# consultant-mode

## Propósito

Interfaz optimizada para entrevista en vivo conducida por un consultor. Soporta múltiples participantes en la sala, sugiere la siguiente pregunta, expone un panel de anotaciones privadas (no exportadas al PDF) y mantiene visible un indicador de salud del levantamiento.

## Requirements

### Requirement: Sesión multi-participante

El sistema DEBE permitir al consultor registrar múltiples participantes presentes en una sesión (vinculados a `stakeholders`) y atribuir cada turno de respuesta a uno de ellos.

#### Scenario: Atribución de respuesta

- **DADO** una sesión con tres participantes activos
- **CUANDO** el consultor registra la respuesta del CEO a una pregunta
- **ENTONCES** el turno se persiste con `actor = stakeholder_uuid` del CEO y queda trazable en el histórico.

### Requirement: Sugerencia de siguiente pregunta

El sistema DEBE exponer un botón "Siguiente pregunta sugerida" que invoca al motor de elicitación y pre-completa la pregunta editable por el consultor.

#### Scenario: Edición antes de preguntar

- **DADO** una sugerencia generada por el motor
- **CUANDO** el consultor edita la redacción antes de plantearla
- **ENTONCES** el sistema persiste la pregunta tal como se preguntó realmente, no la versión original sugerida.

### Requirement: Command palette

El sistema DEBE proveer un command palette (atajo `Cmd/Ctrl+K`) para saltar entre secciones, crear entidades del dominio rápidamente, ejecutar validaciones bajo demanda y abrir el panel de anotaciones.

#### Scenario: Salto rápido a "NFRs"

- **DADO** un consultor en cualquier vista del proyecto
- **CUANDO** presiona `Cmd+K`, escribe "nfr" y selecciona "Ir a NFRs"
- **ENTONCES** el sistema navega a la vista de NFRs en menos de 300ms.

### Requirement: Panel de anotaciones privadas

El sistema DEBE exponer un panel lateral donde el consultor escribe notas privadas vinculadas a una entidad o a la sesión completa. Estas notas NUNCA aparecen en el PDF exportado.

#### Scenario: Anotación no fugada al PDF

- **DADO** una anotación privada en una historia de usuario
- **CUANDO** se exporta el PDF del proyecto
- **ENTONCES** el contenido de la anotación NO aparece en ninguna sección del PDF.

### Requirement: Indicador de salud del levantamiento

El sistema DEBE mostrar de forma persistente un score 0-100 calculado por el motor de validación y la cantidad de issues abiertos por severidad.

#### Scenario: Actualización en vivo del score

- **DADO** un score actual de 62 con 5 issues abiertos
- **CUANDO** el consultor resuelve uno de los issues
- **ENTONCES** el indicador refleja el nuevo score y la cuenta decrementada sin recargar la página.
