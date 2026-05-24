Proyecto Requirements Forge Software

Qué es

Una aplicación web de levantamiento de requerimientos de software que opera en dos modos (consultor guiado  autoservicio del stakeholder), conduce el levantamiento con la API de Claude, y produce como entregable final un PDF híbrido (resumen ejecutivo + historias de usuario con criterios de aceptación Gherkin + especificaciones técnicas y no funcionales) listo para alimentar un proyecto separado de Spec Driven Development.

El PDF generado NO es el software final — es el insumo único de un segundo proyecto de Claude Code + OpenSpec que construirá el software especializado para una empresa.

Contexto del autor

El autor es ingeniero industrial con bases sólidas en ingeniería de software, usa Spec Driven Development con Claude Code y OpenSpec como flujo de trabajo principal, y domina metodologías de mejora de procesos de negocio (BPMN, mapeo de valor). Este software asume explícitamente que el proceso de negocio del cliente ya está mejorado y optimizado — su propósito es traducir esas necesidades de negocio en requerimientos de software técnicos, accionables y libres de ambigüedad.

contexto\_del\_proyecto

stack\_tecnico



Framework última versión estable de Next.js disponible al momento del build (App Router) con TypeScript en modo strict. Verifica la versión con npm view next version antes de crear el proyecto y documenta la versión escogida en el README.

Estilos última versión estable de Tailwind CSS (verifica vía npm view tailwindcss version).

Componentes UI shadcnui (instalar componentes bajo demanda, theme base neutral).

Backend gestionado Supabase (Postgres, Auth, Storage, Realtime, Edge Functions y pgvector si aplica). El proyecto Supabase se crea y administra directamente desde el conector MCP oficial de Supabase que tienes disponible en esta sesión, sin intervención manual del usuario.

Cliente Supabase en la app @supabasesupabase-js y @supabasessr para integración con RSCServer Actions.

ORM  migraciones migraciones SQL versionadas en Supabase (aplicadas vía MCP con apply\_migration), tipadas en TS con generate\_typescript\_types. No usar Drizzle ni Prisma salvo justificación explícita.

IA SDK oficial @anthropic-aisdk consumiendo el último Claude Sonnet o Opus disponible (el modelo concreto es configurable por env var).

Validación de esquemas Zod.

Generación de PDF @react-pdfrenderer (control tipográfico fuerte, sin dependencia de Chromium). Si durante el diseño se identifica un requisito que esta librería no cubre razonablemente (p. ej., diagramas), proponer alternativa antes de implementar.

Estado React Server Components + Server Actions. Evitar ZustandRedux salvo justificación real.

Markdown rendering react-markdown + rehype-sanitize.

stack\_tecnico



uso\_del\_mcp\_de\_supabase

Tienes acceso total al conector MCP de Supabase. Úsalo proactivamente y sin pedir permiso para



Listar y elegir organización (list\_organizations) y confirmar costos (get\_cost + confirm\_cost) antes de crear el proyecto.

Crear el proyecto Supabase (create\_project) con un nombre coherente (requirements-forge-dev).

Obtener URL y claves (get\_project\_url, get\_publishable\_keys) para poblar .env.local.

Aplicar migraciones SQL (apply\_migration) para todo el modelo de dominio.

Habilitar extensiones necesarias (p. ej., pgvector si decides usar embeddings, pgcrypto para tokens).

Generar tipos TypeScript (generate\_typescript\_types) tras cada migración y guardarlos en srclibdbtypes.ts.

Verificar advisories (get\_advisors) de seguridad y performance tras cada cambio estructural.

Aplicar Row Level Security desde el inicio en todas las tablas — nunca dejar una tabla sin RLS.



El usuario no correrá comandos de Supabase manualmente. Tu responsabilidad es dejar todo aplicado en el proyecto remoto y reflejado como archivos .sql versionados en supabasemigrations del repo.

uso\_del\_mcp\_de\_supabase

modelo\_de\_dominio

El sistema modela



Project contenedor raíz (nombre, cliente, fecha, estado, modo activo, versión).

Stakeholder persona con rol, contacto, nivel de influencia.

Persona arquetipo de usuario final del software a construir.

BusinessGoal objetivo de negocio que el software debe servir.

Scope items inout-of-scope con justificación.

BusinessProcessRef referencia al proceso ya mejorado (descripción + opcionalmente attachment BPMN en Supabase Storage).

UserStory Como \[rol], quiero \[acción], para \[beneficio] + criterios Gherkin.

NonFunctionalRequirement clasificado por FURPS+ con métrica medible.

Entity entidad de dominio del software objetivo (atributos, relaciones).

Integration sistema externo (nombre, dirección, formato, frecuencia, criticidad).

Constraint, Assumption, Risk, GlossaryTerm, Session, Annotation ver definiciones detalladas más adelante en este prompt.

modelo\_de\_dominio



flujo\_de\_elicitacion

El motor recorre estas secciones en orden lógico, pero permite saltos no-lineales



Contexto del proyecto y caso de negocio

Stakeholders y personas

Alcance (in  out)

Proceso de negocio soportado

Historias de usuario

Requerimientos no funcionales (FURPS+ con métricas)

Datos y entidades del dominio

Integraciones con sistemas externos

Consideraciones de UIUX

Restricciones, supuestos, riesgos

Glosario  lenguaje ubicuo



En cada sección la IA debe pregunta abierta inicial → seguimientos contextuales → detectar vaguedad (rápido, fácil de usar) → detectar contradicciones → sugerir cross-cutting concerns (auditoría, backups, accesibilidad WCAG, i18n, roles, logging, observabilidad, exportación, LGPDGDPR) → permitir edición manual. Registra trazabilidad completa quién dijo qué, en qué sesión, cuándo.

flujo\_de\_elicitacion

modos\_de\_operacion

Modo Consultor

UI optimizada para entrevista en vivo, soporte multi-participante, botón Siguiente pregunta sugerida, atajos de teclado (Cmd+K palette estilo Linear), panel lateral de anotaciones privadas (no aparecen en PDF), vista de salud del levantamiento siempre visible.

Modo Autoservicio

Acceso por enlace con token de sesión (firmado y almacenado en Supabase), wizard guiado paso a paso, lenguaje no técnico con tooltips y ejemplos, reformulación automática de preguntas, indicador de progreso, guardar y continuar después. No expone secciones técnicas avanzadas por defecto.

Ambos modos comparten el mismo modelo de datos y motor de validación.

modos\_de\_operacion

motor\_de\_validacion

Validaciones bajo demanda y pre-export



Cada UserStory tiene ≥1 criterio Gherkin.

≥1 NFR por categoría FURPS+ aplicable.

GlossaryTerms referenciados están definidos.

No hay requerimientos semánticamente contradictorios (validación vía IA).

Cada Entity referenciada en historias está modelada.

Cada Integration tiene endpoint, dirección, formato, frecuencia.

Toda Assumption marcada como verificada o pendiente con responsable.

No hay vaguedad sin métrica en NFRs.



Resultado panel Salud del levantamiento con score 0-100 y lista accionable de issues.

motor\_de\_validacion

pdf\_de\_salida

Estructura Portada → Resumen ejecutivo (1-2 pp) → Contexto del negocio → Stakeholders y personas → Alcance → Requerimientos funcionales (agrupados por capability) → Requerimientos no funcionales (FURPS+ con métrica) → Modelo de dominio (texto estructurado, sin diagramas) → Integraciones → UIUX → Restricciones y supuestos → Riesgos (matriz probimpacto) → Glosario → Anexos (changelog, participantes, fechas).

Debe ser el insumo único de un proyecto SDD separado claro, sin ambigüedad, accionable, suficiente para que Claude Code lo transforme en openspecspecs directamente.

pdf\_de\_salida

openspec

Antes del código de aplicación, inicializa OpenSpec en `openspec` con `project.md` y las 7 specs iniciales

1\. `project-management` 2. `elicitation-engine` 3. `requirements-model` 4. `consultant-mode` 5. `self-service-mode` 6. `validation-engine` 7. `pdf-export`

Cada capability con su spec.md en formato GivenWhenThen. Todo cambio posterior pasa por openspecchanges sin excepción.

openspec

estructura\_repo

requirements-forge

├── openspec

│   ├── project.md

│   ├── specs{7 capabilities}spec.md

│   └── changes

├── supabase

│   └── migrations         # SQL versionado aplicado vía MCP

├── src

│   ├── app

│   ├── components

│   ├── lib

│   │   ├── ai

│   │   ├── db             # cliente Supabase + types generados

│   │   ├── pdf

│   │   └── validation

│   └── server             # Server Actions

├── .env.example

├── .env.local              # generado por ti tras crear el proyecto Supabase

├── README.md

└── package.json

estructura\_repo

variables\_de\_entorno



NEXT\_PUBLIC\_SUPABASE\_URL — obtenida vía get\_project\_url

NEXT\_PUBLIC\_SUPABASE\_PUBLISHABLE\_KEY — obtenida vía get\_publishable\_keys

SUPABASE\_SERVICE\_ROLE\_KEY — {{el usuario debe proveerla manualmente desde el dashboard, instruir cómo en el README}}

ANTHROPIC\_API\_KEY — {{a rellenar por el usuario}}

ANTHROPIC\_MODEL — default al último SonnetOpus disponible

APP\_SECRET — secret para firmar tokens de sesión de autoservicio (generar y dejar instrucción en README)

variables\_de\_entorno



instrucciones\_de\_ejecucion

Antes de escribir cualquier código, dentro de un bloque plan razona sobre



Versiones exactas de Next.js y Tailwind que vas a usar (con su salida de npm view).

Decisiones de RLS por tabla (quién lee, quién escribe).

Si vas a usar pgvector para detección semántica de contradicciones o si lo dejas para una propuesta de cambio posterior.

Estrategia de tokens de autoservicio (Supabase Auth con magic links vs. JWT firmado custom).

Estrategia de storage para BPMN attachments (Supabase Storage bucket público o privado con signed URLs).



Tras el plan, ejecuta en orden con commits semánticos (Conventional Commits) por paso



Inicializa Next.js (última estable) + TypeScript strict + Tailwind (última estable) + ESLint + Prettier.

Instala y configura shadcnui con theme neutral.

Crea proyecto Supabase vía MCP, guarda URLkeys en .env.local, documenta el proceso.

Configura cliente Supabase (@supabasesupabase-js + @supabasessr) para RSC, Route Handlers y Server Actions.

Inicializa openspec con project.md describiendo este producto en detalle.

Crea las 7 specs iniciales como esqueletos con behaviors clave (solo specs, no implementaciones).

Aplica migraciones SQL vía MCP cubriendo todo el modelo de dominio + RLS desde el día uno + tipos generados.

Implementa pantalla raíz Lista de proyectos con CRUD básico (sin IA, sin PDF — solo el shell).

Documenta README con setup, scripts, filosofía, versión de NextTailwind escogida, y los pasos manuales que el usuario sí debe hacer (proveer service role key, ANTHROPIC\_API\_KEY).



NO implementes en esta iteración motor de IA, motor de validación, generación de PDF, modo autoservicio con tokens. Cada uno vendrá en una propuesta de cambio OpenSpec.

instrucciones\_de\_ejecucion

reglas\_de\_trabajo



Si algo no está claro, pregunta antes de empezar. No asumas.

Propón mejoras arquitectónicas si detectas subóptimos — siempre con justificación técnica.

No introduzcas dependencias fuera del stack listado sin justificarlo en el PR.

Commits en Conventional Commits.

Todo behavior nuevo o modificado pasa primero por openspecchanges.

Código en inglés; specs y README en español.

Tras cada migración Supabase regenera tipos y corre get\_advisors.

Nunca dejes una tabla sin RLS habilitada.

reglas\_de\_trabajo



formato\_de\_respuesta

Estructura tu respuesta en este orden



plan — razonamiento previo con decisiones técnicas justificadas.

preguntas — cualquier ambigüedad que necesites resolver antes de ejecutar (si las hay).

ejecucion — bitácora paso a paso con cada commit, comandos ejecutados, llamadas MCP usadas, y resultado.

entregable — resumen final con versiones escogidas, URL del proyecto Supabase, lista de tablas creadas, advisories pendientes, y siguientes pasos sugeridos como propuestas OpenSpec.

formato\_de\_respuesta



criterios\_de\_exito

La iteración está completa cuando



pnpm build (o npm run build) pasa sin warnings.

pnpm lint pasa.

El proyecto Supabase existe y todas las tablas tienen RLS.

get\_advisors no devuelve issues de seguridad críticos.

Las 7 specs OpenSpec están creadas y validan con openspec validate (si la CLI está disponible).

La pantalla Lista de proyectos hace CRUD real contra Supabase.

El README permite a un desarrollador nuevo levantar el proyecto en 10 minutos.

criterios\_de\_exito

