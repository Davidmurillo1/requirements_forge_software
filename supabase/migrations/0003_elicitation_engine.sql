-- 0003_elicitation_engine.sql
-- Motor de elicitación: extiende public.sessions y añade turns (append-only),
-- project_section_progress (proyección desnormalizada) y detected_issues (hallazgos
-- accionables). RLS forzada y ownership transitivo via public.user_owns_project.
--
-- Spec: openspec/specs/elicitation-engine/spec.md + delta en
--       openspec/changes/add-elicitation-engine/specs/elicitation-engine/spec.md
-- Design: openspec/changes/add-elicitation-engine/design.md

------------------------------------------------------------
-- ENUMS
------------------------------------------------------------
create type public.elicitation_section as enum (
  'project_context',
  'stakeholders_personas',
  'scope',
  'business_process',
  'user_stories',
  'nfrs',
  'domain_data',
  'integrations',
  'ui_ux',
  'constraints_assumptions_risks',
  'glossary'
);

create type public.turn_role as enum (
  'question',   -- pregunta del motor
  'answer',     -- respuesta del usuario (consultor o stakeholder)
  'followup',   -- repregunta del motor en el mismo turno
  'system',     -- evento del sistema (inicio de sesión, cambio de modelo)
  'meta'        -- salto de sección, fallo de SDK, reintento manual
);

create type public.turn_status as enum ('ok', 'failed');

create type public.section_status as enum (
  'not_started',
  'in_progress',
  'incomplete',
  'complete'
);

create type public.issue_type as enum (
  'vagueness',
  'contradiction',
  'missing_cross_cutting',
  'missing_metric',
  'undefined_glossary'
);

create type public.issue_severity as enum ('info', 'warning', 'error');

create type public.issue_status as enum ('open', 'resolved', 'dismissed');

create type public.session_status as enum ('active', 'closed', 'abandoned');

------------------------------------------------------------
-- ALTER public.sessions
-- Añade estado conversacional al stub ya existente.
------------------------------------------------------------
alter table public.sessions
  add column current_section public.elicitation_section not null default 'project_context',
  add column status public.session_status not null default 'active',
  add column closed_at timestamptz;

create index sessions_status_idx on public.sessions(project_id, status);

------------------------------------------------------------
-- TURNS (append-only log conversacional)
-- project_id duplicado para que las policies usen user_owns_project sin joins.
------------------------------------------------------------
create table public.turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  actor public.session_actor not null,
  role public.turn_role not null,
  section public.elicitation_section not null,
  payload jsonb not null,
  token_usage jsonb,
  status public.turn_status not null default 'ok',
  error_code text,
  client_request_id uuid,
  created_at timestamptz not null default now()
);

create index turns_session_created_idx on public.turns(session_id, created_at);
create index turns_project_section_idx on public.turns(project_id, section, created_at);
-- Índice único parcial: idempotencia de envío de turnos del usuario.
create unique index turns_session_client_request_uniq
  on public.turns(session_id, client_request_id)
  where client_request_id is not null;

alter table public.turns enable row level security;
alter table public.turns force row level security;

-- Solo SELECT e INSERT: turns es append-only.
-- UPDATE / DELETE quedan denegados por default (sin policy → 0 filas afectadas).
create policy turns_select on public.turns
  for select to authenticated
  using (public.user_owns_project(project_id));
create policy turns_insert on public.turns
  for insert to authenticated
  with check (public.user_owns_project(project_id));

------------------------------------------------------------
-- PROJECT_SECTION_PROGRESS (proyección desnormalizada por sección)
-- PK compuesta para upsert idempotente desde el servidor.
------------------------------------------------------------
create table public.project_section_progress (
  project_id uuid not null references public.projects(id) on delete cascade,
  section public.elicitation_section not null,
  status public.section_status not null default 'not_started',
  completion_score smallint not null default 0 check (completion_score between 0 and 100),
  last_updated_at timestamptz not null default now(),
  primary key (project_id, section)
);

create index project_section_progress_status_idx
  on public.project_section_progress(project_id, status);

alter table public.project_section_progress enable row level security;
alter table public.project_section_progress force row level security;

create policy project_section_progress_select on public.project_section_progress
  for select to authenticated
  using (public.user_owns_project(project_id));
create policy project_section_progress_insert on public.project_section_progress
  for insert to authenticated
  with check (public.user_owns_project(project_id));
create policy project_section_progress_update on public.project_section_progress
  for update to authenticated
  using (public.user_owns_project(project_id))
  with check (public.user_owns_project(project_id));
create policy project_section_progress_delete on public.project_section_progress
  for delete to authenticated
  using (public.user_owns_project(project_id));

------------------------------------------------------------
-- DETECTED_ISSUES (hallazgos accionables del motor)
-- Sobreviven al cierre de sesión; FK opcional a turn/session de origen.
------------------------------------------------------------
create table public.detected_issues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  turn_id uuid references public.turns(id) on delete set null,
  type public.issue_type not null,
  severity public.issue_severity not null default 'warning',
  title text not null check (length(title) between 1 and 300),
  body text not null check (length(body) between 1 and 5000),
  status public.issue_status not null default 'open',
  resolution_note text check (resolution_note is null or length(resolution_note) <= 2000),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index detected_issues_project_status_idx
  on public.detected_issues(project_id, status);
create index detected_issues_turn_idx on public.detected_issues(turn_id);

create trigger detected_issues_set_updated_at before update on public.detected_issues
  for each row execute function public.set_updated_at();

alter table public.detected_issues enable row level security;
alter table public.detected_issues force row level security;

create policy detected_issues_select on public.detected_issues
  for select to authenticated
  using (public.user_owns_project(project_id));
create policy detected_issues_insert on public.detected_issues
  for insert to authenticated
  with check (public.user_owns_project(project_id));
create policy detected_issues_update on public.detected_issues
  for update to authenticated
  using (public.user_owns_project(project_id))
  with check (public.user_owns_project(project_id));
create policy detected_issues_delete on public.detected_issues
  for delete to authenticated
  using (public.user_owns_project(project_id));

------------------------------------------------------------
-- COMENTARIOS DE ESQUEMA
------------------------------------------------------------
comment on table public.turns is
  'Log append-only de la conversación de elicitación. UPDATE/DELETE denegados por RLS.';
comment on column public.turns.client_request_id is
  'UUID generado en cliente para garantizar idempotencia de envío de turnos.';
comment on column public.turns.payload is
  'Texto del turno + datos estructurados del modelo (submit_turn tool_use).';
comment on column public.turns.token_usage is
  'JSON con input/output/model para auditoría de costo.';

comment on table public.project_section_progress is
  'Proyección desnormalizada del avance por sección. Recalculada por el servidor.';

comment on table public.detected_issues is
  'Hallazgos accionables del motor (vaguedad, contradicciones, cross-cutting). Sobreviven al cierre de sesión.';
