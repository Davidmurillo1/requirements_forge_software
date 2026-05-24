# self-service-mode

## Propósito

Permite a un stakeholder externo completar el levantamiento sin crear cuenta Supabase. Se accede por enlace con token JWT firmado por el servidor. La UI es un wizard guiado paso a paso con lenguaje no técnico, tooltips y ejemplos. Comparte modelo de datos con `consultant-mode`.

## Requirements

### Requirement: Acceso por token firmado

El sistema DEBE generar un token JWT firmado HS256 con `APP_SECRET`, con payload `{scope: 'self_service', session_id, project_id, exp}` y TTL configurable (default 7 días). El stakeholder accede al wizard exclusivamente con el token, sin login Supabase.

#### Scenario: Token expirado

- **DADO** un token con `exp` en el pasado
- **CUANDO** el stakeholder lo usa para acceder al wizard
- **ENTONCES** el sistema responde 401 y muestra un mensaje pidiendo al consultor regenerar el enlace.

#### Scenario: Token con scope incorrecto

- **DADO** un token con `scope = 'consultant'`
- **CUANDO** se intenta usar contra los endpoints de autoservicio
- **ENTONCES** el sistema rechaza el acceso con 403, NO consulta la base de datos y registra el intento en `session_events`.

### Requirement: Wizard paso a paso

El sistema DEBE presentar las secciones de elicitación una a una, con indicador de progreso, lenguaje no técnico, tooltips por término y ejemplos editables.

#### Scenario: Reformulación automática

- **DADO** una pregunta original del motor formulada en lenguaje técnico
- **CUANDO** se renderiza en modo autoservicio
- **ENTONCES** el sistema invoca a Claude para reformularla en lenguaje cotidiano antes de mostrarla.

### Requirement: Guardar y continuar después

El sistema DEBE permitir al stakeholder cerrar el wizard y retomar más tarde con el mismo token, recuperando el último paso completado.

#### Scenario: Retorno con progreso parcial

- **DADO** un stakeholder que completó 4 de 11 secciones y cerró el navegador
- **CUANDO** abre el enlace nuevamente
- **ENTONCES** el wizard reanuda en la sección 5 y muestra las 4 anteriores como `completed` editables.

### Requirement: Secciones técnicas ocultas por default

El sistema DEBE ocultar secciones técnicas avanzadas (entidades, integraciones técnicas, NFRs de bajo nivel) salvo que el consultor las habilite explícitamente en la configuración de la sesión.

#### Scenario: Stakeholder no técnico

- **DADO** una sesión con `expose_technical_sections = false`
- **CUANDO** el stakeholder recorre el wizard
- **ENTONCES** solo ve secciones de negocio (contexto, stakeholders, alcance, historias, UI/UX, riesgos, glosario).

### Requirement: Auditoría de eventos

El sistema DEBE registrar en `session_events` cada acceso, paso completado, respuesta enviada y cierre de sesión del autoservicio, con `session_id`, `timestamp`, `event_type` e `ip_hash`.

#### Scenario: Rate limit por session_id

- **DADO** una sesión con más de N eventos por minuto
- **CUANDO** llega un nuevo evento
- **ENTONCES** el sistema responde 429 y registra el intento sin alterar el estado del wizard.
