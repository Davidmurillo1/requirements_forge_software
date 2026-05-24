# requirements-model

## Propósito

Modelo de dominio compartido por todas las capabilities: entidades, relaciones y trazabilidad de los artefactos de un levantamiento de requerimientos. Define las tablas, claves y políticas RLS que las capabilities consumen.

## Requirements

### Requirement: Entidades del dominio

El sistema DEBE persistir las siguientes entidades, cada una con `project_id` referenciando a `projects(id) ON DELETE CASCADE`:

- `stakeholders` (rol, contacto, influencia)
- `personas` (arquetipos de usuario final)
- `business_goals` (objetivos de negocio)
- `scope_items` (in/out de alcance con justificación)
- `business_process_refs` (proceso ya mejorado, opcional attachment)
- `user_stories` (`Como [rol], quiero [acción], para [beneficio]`)
- `acceptance_criteria` (Gherkin Given/When/Then; FK a `user_stories`)
- `nfrs` (clasificados por FURPS+ con métrica)
- `entities` + `entity_attributes` (entidades de dominio del software objetivo)
- `integrations` (sistema externo, dirección, formato, frecuencia, criticidad)
- `constraints`, `assumptions`, `risks`, `glossary_terms`
- `sessions` (sesiones de elicitación con timestamps y participantes)
- `annotations` (notas privadas del consultor; NO aparecen en el PDF)

### Requirement: Row Level Security sin excepción

CADA tabla del esquema `public` DEBE tener `enable row level security` y `force row level security`. Las políticas DEBEN verificar ownership transitivo a través de `projects.owner_id = auth.uid()`.

#### Scenario: Tabla sin política bloquea por default

- **DADO** una tabla con RLS habilitada y sin políticas para `select`
- **CUANDO** un usuario autenticado consulta esa tabla
- **ENTONCES** la consulta retorna 0 filas (default deny), sin error.

#### Scenario: Política transitiva por project_id

- **DADO** usuario A con proyecto `P_A` y `user_stories` asociadas
- **CUANDO** usuario B intenta leer `user_stories` filtrando por `project_id = P_A.id`
- **ENTONCES** B recibe 0 filas porque la policy verifica que `P_A.owner_id = B.uid()` y falla.

### Requirement: Trazabilidad

El sistema DEBE registrar para cada entidad creada/modificada: `created_at`, `updated_at`, `created_by` (uuid del consultor) y opcionalmente `session_id` (cuando se origina dentro de una sesión de elicitación).

#### Scenario: Anotación queda fuera del PDF

- **DADO** una `annotation` asociada a una `user_story`
- **CUANDO** se exporta el PDF del proyecto
- **ENTONCES** el contenido de la anotación NO aparece en el PDF —solo se usa internamente como contexto.

### Requirement: Glosario referenciado

El sistema DEBE permitir vincular términos del `glossary_terms` desde otras entidades (historias, NFRs, scope items) y verificar la integridad referencial.

#### Scenario: Validación detecta término no definido

- **DADO** un proyecto con una historia que menciona el término "SLA"
- **CUANDO** se valida el proyecto pre-export
- **Y** "SLA" NO está en `glossary_terms`
- **ENTONCES** la validación reporta un issue de tipo `glossary_missing` con severidad `warning`.
