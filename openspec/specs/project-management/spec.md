# project-management

## Propósito

Administrar el ciclo de vida de un Proyecto de levantamiento de requerimientos: creación, listado, edición de metadatos, archivado y borrado. Es la raíz del modelo de dominio: toda entidad de requerimientos cuelga de un `Project`.

## Requirements

### Requirement: Crear proyecto

El sistema DEBE permitir al usuario autenticado crear un nuevo proyecto con nombre, cliente, fecha de inicio, modo inicial (`consultant` | `self_service`) y estado inicial `draft`.

#### Scenario: Creación válida

- **DADO** un consultor autenticado en la app
- **CUANDO** envía el formulario con `name`, `client_name`, `start_date` y `mode` válidos
- **ENTONCES** el sistema crea un registro en `projects` con `owner_id = auth.uid()`, `status = 'draft'`, `version = 1` y redirige a la vista de detalle del proyecto.

#### Scenario: Validación rechaza nombre vacío

- **DADO** un consultor autenticado
- **CUANDO** intenta crear un proyecto sin `name`
- **ENTONCES** el sistema rechaza la creación con error de validación y NO crea ningún registro.

### Requirement: Listar proyectos propios

El sistema DEBE mostrar al usuario autenticado únicamente los proyectos cuyo `owner_id` coincide con `auth.uid()`, ordenados por fecha de actualización descendente.

#### Scenario: RLS aísla por dueño

- **DADO** dos usuarios A y B autenticados, cada uno con proyectos propios
- **CUANDO** A consulta su listado
- **ENTONCES** A solo ve los proyectos donde `owner_id = A.uid()` y NUNCA los de B, incluso ante intento de query directa.

### Requirement: Editar metadatos del proyecto

El sistema DEBE permitir al dueño editar `name`, `client_name`, `start_date`, `status` y `mode`. El campo `version` se incrementa automáticamente al exportar un PDF (no en cada edición).

#### Scenario: Cambio de modo durante elicitación

- **DADO** un proyecto en modo `consultant`
- **CUANDO** el dueño cambia el modo a `self_service`
- **ENTONCES** el sistema persiste el cambio, registra un evento de auditoría y mantiene todos los datos de elicitación recogidos hasta el momento.

### Requirement: Borrado en cascada

El sistema DEBE eliminar todas las entidades dependientes (stakeholders, historias, NFRs, etc.) al borrar un proyecto, mediante `ON DELETE CASCADE` en las foreign keys.

#### Scenario: Borrar propaga a todas las tablas hijas

- **DADO** un proyecto con stakeholders, historias y NFRs asociados
- **CUANDO** el dueño lo borra
- **ENTONCES** todas las filas con `project_id` apuntando al proyecto borrado desaparecen sin necesidad de query manual.
