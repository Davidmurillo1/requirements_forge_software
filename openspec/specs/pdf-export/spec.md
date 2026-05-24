# pdf-export

## Propósito

Generar el PDF híbrido final del levantamiento usando `@react-pdf/renderer`. El PDF es el insumo único del proyecto SDD descendiente: claro, sin ambigüedad, accionable, suficiente para que Claude Code lo transforme en `openspec/specs/` directamente.

## Requirements

### Requirement: Estructura del PDF

El sistema DEBE producir un PDF con esta estructura, en este orden:

1. Portada
2. Resumen ejecutivo (1-2 páginas)
3. Contexto del negocio
4. Stakeholders y personas
5. Alcance (in/out con justificación)
6. Requerimientos funcionales (agrupados por capability)
7. Requerimientos no funcionales (FURPS+ con métrica por cada uno)
8. Modelo de dominio (entidades y atributos, sin diagramas)
9. Integraciones
10. UI/UX
11. Restricciones y supuestos
12. Riesgos (matriz prob/impacto)
13. Glosario
14. Anexos (changelog, participantes, fechas, versión)

#### Scenario: Sección vacía se omite

- **DADO** un proyecto sin riesgos definidos
- **CUANDO** se exporta el PDF
- **ENTONCES** la sección "Riesgos" se omite del PDF y del índice, sin dejar página en blanco.

### Requirement: Export bloqueado por validación

El sistema NO DEBE generar el PDF si la validación reporta issues `critical` sin resolver.

#### Scenario: Intento de export con críticos abiertos

- **DADO** un proyecto con 2 issues `critical`
- **CUANDO** el dueño clickea "Exportar PDF"
- **ENTONCES** el sistema responde sin generar PDF y muestra los issues bloqueantes con enlaces a su resolución.

### Requirement: Anotaciones privadas excluidas

El generador de PDF NUNCA DEBE incluir contenido de `annotations` en el output.

#### Scenario: Anotaciones presentes pero no fugadas

- **DADO** un proyecto con 20 anotaciones privadas distribuidas en historias, NFRs y entidades
- **CUANDO** se exporta el PDF
- **ENTONCES** ninguna porción del texto de las anotaciones aparece en el PDF (test con búsqueda full-text sobre el output).

### Requirement: Trazabilidad en anexos

El PDF DEBE incluir en anexos: changelog del proyecto (eventos de creación, ediciones mayores, exportes), lista de participantes y sus roles, fechas de sesiones, y la `version` del proyecto.

#### Scenario: Incremento de version al exportar

- **DADO** un proyecto en `version = 1`
- **CUANDO** se exporta exitosamente el PDF
- **ENTONCES** el sistema incrementa a `version = 2`, registra el evento `pdf_exported` en `session_events` y embebe `version: 2` en el anexo del PDF.

### Requirement: Tipografía controlada sin Chromium

El sistema DEBE generar el PDF con `@react-pdf/renderer` (no Chromium ni Puppeteer) para garantizar control tipográfico estable y output deterministico entre entornos.

#### Scenario: Render consistente entre dev y prod

- **DADO** el mismo proyecto exportado en dev y producción
- **CUANDO** se comparan los PDFs
- **ENTONCES** ambos comparten layout, fuentes, tamaños y paginación (modulo metadatos de timestamp).

### Requirement: Modelo de dominio textual, no gráfico

El PDF DEBE expresar el modelo de dominio como texto estructurado (listas de entidades con atributos, relaciones nombradas), sin diagramas ER ni BPMN incrustados.

#### Scenario: Referencias a archivos externos

- **DADO** un proyecto con un BPMN attachment en Supabase Storage
- **CUANDO** se exporta el PDF
- **ENTONCES** el PDF lista el nombre y descripción del archivo BPMN pero NO lo incrusta como imagen.
