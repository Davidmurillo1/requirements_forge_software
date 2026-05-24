# Requirements Forge Software

## Propósito

Aplicación web para el **levantamiento estructurado de requerimientos de software**. Opera en dos modos —Consultor guiado y Autoservicio del stakeholder— y conduce la elicitación con la API de Claude. Su salida es un **PDF híbrido**: resumen ejecutivo + historias de usuario con criterios Gherkin + especificaciones técnicas y no funcionales (FURPS+).

El PDF generado **no es el software final**. Es el insumo único de un proyecto separado de Spec Driven Development (Claude Code + OpenSpec) que construye el sistema especializado para cada empresa cliente.

## Contexto del autor

Ingeniero industrial con bases sólidas en ingeniería de software. Usa SDD con Claude Code + OpenSpec como flujo principal. Domina BPMN y mejora de procesos. El producto **asume que el proceso de negocio ya está mejorado**: su trabajo es traducir necesidades de negocio en requerimientos técnicos accionables y sin ambigüedad.

## Stack técnico

- **Framework**: Next.js 16 (App Router, RSC, Server Actions), TypeScript en modo `strict`.
- **Estilos**: Tailwind CSS 4 (config CSS-first vía `@theme`).
- **UI**: shadcn/ui, theme `neutral`, componentes instalados bajo demanda.
- **Backend gestionado**: Supabase (Postgres + Auth + Storage + Edge Functions; pgvector diferido).
- **Cliente Supabase**: `@supabase/supabase-js` + `@supabase/ssr` (RSC, Route Handlers, Server Actions).
- **Migraciones**: SQL versionado en `supabase/migrations/`, aplicado vía MCP `apply_migration`. Tipos generados con `generate_typescript_types` → `src/lib/db/types.ts`. **Sin Drizzle ni Prisma.**
- **IA**: `@anthropic-ai/sdk`, modelo configurable por `ANTHROPIC_MODEL`.
- **Validación de esquemas**: Zod.
- **Generación de PDF**: `@react-pdf/renderer`.
- **Estado**: RSC + Server Actions. Sin Zustand/Redux salvo justificación real.
- **Markdown**: `react-markdown` + `rehype-sanitize`.

## Convenciones

- **Código**: en inglés. **Specs y README**: en español.
- **Commits**: Conventional Commits.
- **Todo cambio de behavior** pasa primero por `openspec/changes/`.
- **RLS habilitada en TODA tabla** del esquema `public`. Sin excepción.
- **Generar tipos TS y correr `get_advisors`** después de cada migración.
- Tras Iteración 0, **no se introducen dependencias fuera del stack listado** sin justificación en el PR.

## Capabilities (7)

1. `project-management` — CRUD de proyectos, estado, modo activo, versión.
2. `requirements-model` — modelo de dominio compartido (stakeholders, personas, historias, NFR, entidades, etc.) con RLS.
3. `elicitation-engine` — motor conversacional impulsado por Claude para recorrer secciones, detectar vaguedad/contradicciones, sugerir cross-cutting concerns.
4. `consultant-mode` — UI de entrevista en vivo, multi-participante, command palette, anotaciones privadas.
5. `self-service-mode` — wizard con token JWT firmado (sin cuenta Supabase para el stakeholder), lenguaje no técnico.
6. `validation-engine` — validaciones bajo demanda + pre-export con score 0–100 (FURPS+ completo, Gherkin por historia, glosario referenciado, etc.).
7. `pdf-export` — generación del PDF híbrido final con `@react-pdf/renderer`.

## Out of scope

- Diagramas embebidos en el PDF (BPMN, ER) — se referencian, no se renderizan.
- Versionado distribuido del PDF (Git LFS, etc.) — el PDF es un entregable, no un artefacto rastreado.
- Integración directa con Jira/Linear — exportación a esos sistemas vendría en cambio futuro.
- Multi-tenancy de organizaciones — Iteración 0 es single-owner por proyecto.

## Restricciones clave

- **Consultor autenticado** vía Supabase Auth (magic link en Iteración 0).
- **Stakeholder en autoservicio** NO crea cuenta Supabase: usa JWT firmado HS256 con `APP_SECRET`.
- **PDF sin Chromium**: `@react-pdf/renderer` controla tipografía sin headless browser.
- **El PDF debe ser suficiente** para alimentar `openspec/specs` del proyecto SDD descendiente —claridad y trazabilidad son criterio de aceptación implícito.

## Variables de entorno

| Variable | Origen | Notas |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | MCP `get_project_url` | |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | MCP `get_publishable_keys` | |
| `SUPABASE_SERVICE_ROLE_KEY` | Manual del dashboard Supabase | Settings → API → service_role |
| `ANTHROPIC_API_KEY` | Manual del usuario | console.anthropic.com |
| `ANTHROPIC_MODEL` | Configurable | Default: último Sonnet/Opus al deploy |
| `APP_SECRET` | Manual: `openssl rand -hex 32` | Firma JWT de autoservicio |

## Estructura del repo

```
./
├── CLAUDE.md
├── README.md
├── openspec/
│   ├── project.md
│   ├── changes/
│   └── specs/{capability}/spec.md
├── supabase/
│   └── migrations/
└── src/
    ├── app/
    ├── components/ui/
    ├── lib/{ai,db,pdf,validation,utils}
    ├── middleware.ts
    └── server/
```
