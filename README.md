# Requirements Forge

Aplicación web para el levantamiento estructurado de requerimientos de software. Opera en dos modos (Consultor guiado y Autoservicio del stakeholder), conduce la elicitación con la API de Claude y produce un PDF híbrido (resumen ejecutivo + historias con criterios Gherkin + NFRs FURPS+ + modelo de dominio) listo para alimentar un proyecto separado de Spec Driven Development (Claude Code + OpenSpec).

El PDF generado **no es el software final**: es el insumo único del proyecto SDD descendiente.

---

## Stack

| Capa | Versión | Notas |
|---|---|---|
| Next.js | **16.2.6** | App Router, RSC, Server Actions, Turbopack |
| TypeScript | ^5 | `strict: true` |
| Tailwind CSS | **4.3.0** | Config CSS-first vía `@theme` en `src/app/globals.css` |
| shadcn/ui | preset nova, baseColor `neutral` | |
| Supabase | Cloud (free/Pro) | Postgres + Auth + Storage; pgvector diferido |
| `@supabase/supabase-js` | 2.106.1 | |
| `@supabase/ssr` | 0.10.3 | Para RSC, route handlers y Server Actions |
| `@anthropic-ai/sdk` | 0.98.0 | (sin usar todavía — iteraciones siguientes) |
| Zod | 4.4.3 | Validación de inputs |
| `@react-pdf/renderer` | (diferido) | Generación de PDF sin Chromium |

Node 24+, npm 11+ (pnpm opcional vía `corepack enable pnpm`).

---

## Setup en menos de 10 minutos

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar `.env.local`

Copia `.env.example` a `.env.local`. Las dos primeras variables las pobla Claude automáticamente cuando crea el proyecto Supabase vía MCP. Las demás las llenas tú:

```env
# Estos dos los rellena Claude vía MCP de Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<id>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...

# Estos los pones tú manualmente:
SUPABASE_SERVICE_ROLE_KEY=         # Dashboard Supabase → Project Settings → API → service_role (secret)
ANTHROPIC_API_KEY=                 # https://console.anthropic.com/ → API Keys
ANTHROPIC_MODEL=claude-sonnet-4-6  # configurable
APP_SECRET=                        # openssl rand -hex 32   (para JWT de autoservicio, aún no usado)
```

> El `SUPABASE_SERVICE_ROLE_KEY` solo se usa en Server Actions de autoservicio (modo público con JWT custom), planeado para iteraciones siguientes. En Iteración 0 no es estrictamente necesario, pero es buena idea dejarlo configurado.

### 3. Confirmar migraciones aplicadas

La migración inicial (`supabase/migrations/0001_init_domain.sql`) ya fue aplicada vía MCP cuando Claude bootstrappeó el proyecto. Si clonaste el repo y necesitas re-aplicarla en otro proyecto Supabase, usa el dashboard o el MCP.

### 4. Levantar dev server

```bash
npm run dev
```

Abre `http://localhost:3000` → te redirige a `/login`. Ingresa tu email para recibir el enlace mágico (Supabase Auth). El primer login crea automáticamente la cuenta. Tras autenticarte aterrizas en `/projects`.

---

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Dev server (Turbopack). |
| `npm run build` | Build de producción. |
| `npm run start` | Sirve el build. |
| `npm run lint` | ESLint, `--max-warnings 0`. |
| `npm run type-check` | `tsc --noEmit`. |
| `npm run format` | Prettier (escribe). |
| `npm run format:check` | Prettier (verifica). |

---

## Estructura del repo

```
./
├── CLAUDE.md                 # Brief del proyecto para Claude
├── README.md                 # Este archivo
├── AGENTS.md                 # Notas de Next 16 para agentes IA
├── openspec/                 # Specs (lenguaje de productos)
│   ├── project.md            # Manifesto del producto
│   ├── changes/              # Propuestas de cambio (futuras iteraciones)
│   └── specs/{capability}/spec.md  # 7 capabilities con Given/When/Then
├── supabase/
│   └── migrations/           # SQL versionado aplicado vía MCP
├── src/
│   ├── app/                  # App Router (login, /projects CRUD, /auth)
│   ├── components/ui/        # shadcn (button, card, input, label, dialog, sonner)
│   ├── lib/
│   │   ├── ai/               # (placeholder, futuras iteraciones)
│   │   ├── db/               # clientes Supabase + tipos generados
│   │   ├── pdf/              # (placeholder, futuras iteraciones)
│   │   ├── utils.ts          # cn (shadcn)
│   │   └── validation/       # esquemas Zod
│   ├── proxy.ts              # Next 16 proxy: refresca sesión y guarda rutas
│   └── server/               # Server Actions
├── .env.example
├── components.json           # config de shadcn/ui
├── next.config.ts            # config de Next
├── postcss.config.mjs        # config de Tailwind 4
├── tsconfig.json             # strict
└── package.json
```

---

## Capabilities (OpenSpec)

7 capabilities están definidas como specs esqueleto en `openspec/specs/`:

1. `project-management` — CRUD de proyectos. **Implementado en Iteración 0.**
2. `requirements-model` — Modelo de dominio compartido con RLS. **Migración aplicada en Iteración 0.**
3. `elicitation-engine` — Motor conversacional con Claude.
4. `consultant-mode` — UI entrevista en vivo, command palette.
5. `self-service-mode` — JWT firmado HS256 sin cuenta para el stakeholder.
6. `validation-engine` — Score 0–100, FURPS+, bloqueo de export por críticos.
7. `pdf-export` — PDF híbrido sin Chromium.

**Todo cambio de behavior debe pasar primero por `openspec/changes/`.** Convención: una propuesta crea/edita el spec correspondiente y describe el plan de implementación.

---

## Filosofía y decisiones clave

- **Specs en español, código en inglés.** El brief técnico es bilingüe por diseño.
- **Conventional Commits.** Cada paso tiene su commit semántico.
- **RLS en TODA tabla.** Sin excepción, con `force row level security`. Las políticas usan el helper `public.user_owns_project(project_id)` (SECURITY DEFINER, `search_path` vacío) para evitar duplicar lógica.
- **Sin ORM.** Migraciones SQL versionadas en `supabase/migrations/` aplicadas vía MCP. Tipos TS generados con `generate_typescript_types` → `src/lib/db/types.ts`.
- **Sin pgvector en Iteración 0.** La detección semántica de contradicciones llega con `add-semantic-validation`.
- **Stakeholder externo NO crea cuenta Supabase.** El modo autoservicio usa JWT custom HS256 firmado con `APP_SECRET`, validado server-side, sin tocar `auth.users`. Iteración 0 solo deja la decisión documentada.
- **BPMN privado.** Storage previsto en bucket privado `bpmn-attachments` con signed URLs (TTL 60 min); diferido a su propia propuesta OpenSpec.
- **PDF sin Chromium.** `@react-pdf/renderer` para control tipográfico determinístico.
- **Default deny en RLS.** `force row level security` + políticas explícitas por verbo. Sin políticas = bloqueo total.

---

## Próximas iteraciones (propuestas OpenSpec sugeridas)

| Propuesta | Capability impactada | Descripción |
|---|---|---|
| `add-elicitation-engine` | `elicitation-engine` | Integrar Claude SDK con prompt orquestado, detección de vaguedad y trazabilidad por turno. |
| `add-consultant-ui` | `consultant-mode` | Command palette, panel de anotaciones, indicador de salud. |
| `add-validation-engine` | `validation-engine` | Score 0-100, motor de issues, bloqueo de export. |
| `add-pdf-export` | `pdf-export` | Componentes React-PDF, layout, generación de blob. |
| `add-self-service-mode` | `self-service-mode` | Generación y verificación de JWT, wizard, route handlers públicos. |
| `add-semantic-validation` | `validation-engine` | Habilitar pgvector, embeddings y detección de contradicciones. |
| `add-business-process-attachments` | `requirements-model` | Bucket privado `bpmn-attachments`, signed URLs, RLS sobre storage. |

---

## Troubleshooting

- **"Auth callback failed" después del magic link.** Verifica que la URL de tu app esté en Supabase Dashboard → Authentication → URL Configuration → Site URL (y Redirect URLs incluya `http://localhost:3000/auth/callback` en dev).
- **Build se queja de `NEXT_PUBLIC_SUPABASE_URL` undefined.** Asegúrate de que `.env.local` esté presente y rebuild. Las variables `NEXT_PUBLIC_*` se inlinean en el bundle al build time.
- **RLS bloquea inserts.** Confirma que estás autenticado: `/projects` te redirige a `/login` si no hay sesión. La policy de `projects` exige `owner_id = auth.uid()`.
- **OneDrive + Windows.** Si dev server se cuelga vigilando archivos, considera mover el repo fuera de la carpeta sincronizada por OneDrive.

---

## Licencia

Privado, propiedad del autor. No distribuir.
