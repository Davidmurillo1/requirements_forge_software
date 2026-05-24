-- 0001_init_domain.sql
-- Modelo de dominio inicial de Requirements Forge.
-- RLS habilitada y FORZADA en todas las tablas. Política de ownership transitiva
-- vía public.user_owns_project. Sin pgvector (diferido a add-semantic-validation).

------------------------------------------------------------
-- ENUMS
------------------------------------------------------------
create type public.project_status as enum ('draft', 'active', 'exported', 'archived');
create type public.project_mode as enum ('consultant', 'self_service');
create type public.stakeholder_influence as enum ('low', 'medium', 'high');
create type public.persona_kind as enum ('primary', 'secondary', 'antagonist');
create type public.scope_kind as enum ('in', 'out');
create type public.nfr_category as enum (
  'functionality', 'usability', 'reliability', 'performance', 'supportability', 'security', 'compliance'
);
create type public.integration_direction as enum ('inbound', 'outbound', 'bidirectional');
create type public.integration_criticality as enum ('low', 'medium', 'high');
create type public.risk_level as enum ('low', 'medium', 'high');
create type public.story_priority as enum ('must', 'should', 'could', 'wont');
create type public.session_actor as enum ('engine', 'consultant', 'stakeholder');
create type public.annotation_target_kind as enum (
  'project', 'user_story', 'nfr', 'entity', 'integration', 'session', 'other'
);

------------------------------------------------------------
-- FUNCIONES AUXILIARES
------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Helper de ownership: SECURITY DEFINER para no entrar en recursión de RLS,
-- search_path vacío para evitar mutable_search_path warning, STABLE porque solo
-- depende del request actual. auth.uid() y la tabla projects se cualifican.
create or replace function public.user_owns_project(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and p.owner_id = (select auth.uid())
  )
$$;
revoke all on function public.user_owns_project(uuid) from public;
grant execute on function public.user_owns_project(uuid) to authenticated;

------------------------------------------------------------
-- PROJECTS (raíz)
------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 200),
  client_name text check (client_name is null or length(client_name) <= 200),
  start_date date,
  status public.project_status not null default 'draft',
  mode public.project_mode not null default 'consultant',
  version int not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_owner_idx on public.projects(owner_id);
create index projects_updated_idx on public.projects(updated_at desc);
create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

alter table public.projects enable row level security;
alter table public.projects force row level security;

create policy projects_select_own on public.projects
  for select to authenticated
  using (owner_id = (select auth.uid()));
create policy projects_insert_own on public.projects
  for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy projects_update_own on public.projects
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy projects_delete_own on public.projects
  for delete to authenticated
  using (owner_id = (select auth.uid()));

------------------------------------------------------------
-- STAKEHOLDERS
------------------------------------------------------------
create table public.stakeholders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (length(name) between 1 and 200),
  role text,
  contact text,
  influence public.stakeholder_influence not null default 'medium',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stakeholders_project_idx on public.stakeholders(project_id);
create trigger stakeholders_set_updated_at before update on public.stakeholders
  for each row execute function public.set_updated_at();
alter table public.stakeholders enable row level security;
alter table public.stakeholders force row level security;
create policy stakeholders_select on public.stakeholders for select to authenticated using (public.user_owns_project(project_id));
create policy stakeholders_insert on public.stakeholders for insert to authenticated with check (public.user_owns_project(project_id));
create policy stakeholders_update on public.stakeholders for update to authenticated using (public.user_owns_project(project_id)) with check (public.user_owns_project(project_id));
create policy stakeholders_delete on public.stakeholders for delete to authenticated using (public.user_owns_project(project_id));

------------------------------------------------------------
-- PERSONAS
------------------------------------------------------------
create table public.personas (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (length(name) between 1 and 200),
  kind public.persona_kind not null default 'primary',
  description text,
  goals text,
  frustrations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index personas_project_idx on public.personas(project_id);
create trigger personas_set_updated_at before update on public.personas
  for each row execute function public.set_updated_at();
alter table public.personas enable row level security;
alter table public.personas force row level security;
create policy personas_select on public.personas for select to authenticated using (public.user_owns_project(project_id));
create policy personas_insert on public.personas for insert to authenticated with check (public.user_owns_project(project_id));
create policy personas_update on public.personas for update to authenticated using (public.user_owns_project(project_id)) with check (public.user_owns_project(project_id));
create policy personas_delete on public.personas for delete to authenticated using (public.user_owns_project(project_id));

------------------------------------------------------------
-- BUSINESS_GOALS
------------------------------------------------------------
create table public.business_goals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (length(title) between 1 and 300),
  description text,
  kpi text,
  priority int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index business_goals_project_idx on public.business_goals(project_id);
create trigger business_goals_set_updated_at before update on public.business_goals
  for each row execute function public.set_updated_at();
alter table public.business_goals enable row level security;
alter table public.business_goals force row level security;
create policy business_goals_select on public.business_goals for select to authenticated using (public.user_owns_project(project_id));
create policy business_goals_insert on public.business_goals for insert to authenticated with check (public.user_owns_project(project_id));
create policy business_goals_update on public.business_goals for update to authenticated using (public.user_owns_project(project_id)) with check (public.user_owns_project(project_id));
create policy business_goals_delete on public.business_goals for delete to authenticated using (public.user_owns_project(project_id));

------------------------------------------------------------
-- SCOPE_ITEMS
------------------------------------------------------------
create table public.scope_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (length(title) between 1 and 300),
  kind public.scope_kind not null,
  justification text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index scope_items_project_idx on public.scope_items(project_id);
create trigger scope_items_set_updated_at before update on public.scope_items
  for each row execute function public.set_updated_at();
alter table public.scope_items enable row level security;
alter table public.scope_items force row level security;
create policy scope_items_select on public.scope_items for select to authenticated using (public.user_owns_project(project_id));
create policy scope_items_insert on public.scope_items for insert to authenticated with check (public.user_owns_project(project_id));
create policy scope_items_update on public.scope_items for update to authenticated using (public.user_owns_project(project_id)) with check (public.user_owns_project(project_id));
create policy scope_items_delete on public.scope_items for delete to authenticated using (public.user_owns_project(project_id));

------------------------------------------------------------
-- BUSINESS_PROCESS_REFS
------------------------------------------------------------
create table public.business_process_refs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (length(title) between 1 and 300),
  description text,
  attachment_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index business_process_refs_project_idx on public.business_process_refs(project_id);
create trigger business_process_refs_set_updated_at before update on public.business_process_refs
  for each row execute function public.set_updated_at();
alter table public.business_process_refs enable row level security;
alter table public.business_process_refs force row level security;
create policy business_process_refs_select on public.business_process_refs for select to authenticated using (public.user_owns_project(project_id));
create policy business_process_refs_insert on public.business_process_refs for insert to authenticated with check (public.user_owns_project(project_id));
create policy business_process_refs_update on public.business_process_refs for update to authenticated using (public.user_owns_project(project_id)) with check (public.user_owns_project(project_id));
create policy business_process_refs_delete on public.business_process_refs for delete to authenticated using (public.user_owns_project(project_id));

------------------------------------------------------------
-- USER_STORIES
------------------------------------------------------------
create table public.user_stories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  as_role text not null check (length(as_role) between 1 and 200),
  action text not null check (length(action) between 1 and 500),
  benefit text not null check (length(benefit) between 1 and 500),
  priority public.story_priority not null default 'should',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index user_stories_project_idx on public.user_stories(project_id);
create trigger user_stories_set_updated_at before update on public.user_stories
  for each row execute function public.set_updated_at();
alter table public.user_stories enable row level security;
alter table public.user_stories force row level security;
create policy user_stories_select on public.user_stories for select to authenticated using (public.user_owns_project(project_id));
create policy user_stories_insert on public.user_stories for insert to authenticated with check (public.user_owns_project(project_id));
create policy user_stories_update on public.user_stories for update to authenticated using (public.user_owns_project(project_id)) with check (public.user_owns_project(project_id));
create policy user_stories_delete on public.user_stories for delete to authenticated using (public.user_owns_project(project_id));

------------------------------------------------------------
-- ACCEPTANCE_CRITERIA (project_id denormalizado para RLS simple)
------------------------------------------------------------
create table public.acceptance_criteria (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_story_id uuid not null references public.user_stories(id) on delete cascade,
  given_clause text not null,
  when_clause text not null,
  then_clause text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index acceptance_criteria_project_idx on public.acceptance_criteria(project_id);
create index acceptance_criteria_story_idx on public.acceptance_criteria(user_story_id);
create trigger acceptance_criteria_set_updated_at before update on public.acceptance_criteria
  for each row execute function public.set_updated_at();
alter table public.acceptance_criteria enable row level security;
alter table public.acceptance_criteria force row level security;
create policy acceptance_criteria_select on public.acceptance_criteria for select to authenticated using (public.user_owns_project(project_id));
create policy acceptance_criteria_insert on public.acceptance_criteria for insert to authenticated with check (public.user_owns_project(project_id));
create policy acceptance_criteria_update on public.acceptance_criteria for update to authenticated using (public.user_owns_project(project_id)) with check (public.user_owns_project(project_id));
create policy acceptance_criteria_delete on public.acceptance_criteria for delete to authenticated using (public.user_owns_project(project_id));

------------------------------------------------------------
-- NFRS
------------------------------------------------------------
create table public.nfrs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  category public.nfr_category not null,
  description text not null check (length(description) between 1 and 1000),
  metric text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index nfrs_project_idx on public.nfrs(project_id);
create index nfrs_category_idx on public.nfrs(project_id, category);
create trigger nfrs_set_updated_at before update on public.nfrs
  for each row execute function public.set_updated_at();
alter table public.nfrs enable row level security;
alter table public.nfrs force row level security;
create policy nfrs_select on public.nfrs for select to authenticated using (public.user_owns_project(project_id));
create policy nfrs_insert on public.nfrs for insert to authenticated with check (public.user_owns_project(project_id));
create policy nfrs_update on public.nfrs for update to authenticated using (public.user_owns_project(project_id)) with check (public.user_owns_project(project_id));
create policy nfrs_delete on public.nfrs for delete to authenticated using (public.user_owns_project(project_id));

------------------------------------------------------------
-- ENTITIES
------------------------------------------------------------
create table public.entities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (length(name) between 1 and 200),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, name)
);
create index entities_project_idx on public.entities(project_id);
create trigger entities_set_updated_at before update on public.entities
  for each row execute function public.set_updated_at();
alter table public.entities enable row level security;
alter table public.entities force row level security;
create policy entities_select on public.entities for select to authenticated using (public.user_owns_project(project_id));
create policy entities_insert on public.entities for insert to authenticated with check (public.user_owns_project(project_id));
create policy entities_update on public.entities for update to authenticated using (public.user_owns_project(project_id)) with check (public.user_owns_project(project_id));
create policy entities_delete on public.entities for delete to authenticated using (public.user_owns_project(project_id));

------------------------------------------------------------
-- ENTITY_ATTRIBUTES (project_id denormalizado)
------------------------------------------------------------
create table public.entity_attributes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  name text not null check (length(name) between 1 and 200),
  data_type text not null,
  is_nullable boolean not null default false,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_id, name)
);
create index entity_attributes_project_idx on public.entity_attributes(project_id);
create index entity_attributes_entity_idx on public.entity_attributes(entity_id);
create trigger entity_attributes_set_updated_at before update on public.entity_attributes
  for each row execute function public.set_updated_at();
alter table public.entity_attributes enable row level security;
alter table public.entity_attributes force row level security;
create policy entity_attributes_select on public.entity_attributes for select to authenticated using (public.user_owns_project(project_id));
create policy entity_attributes_insert on public.entity_attributes for insert to authenticated with check (public.user_owns_project(project_id));
create policy entity_attributes_update on public.entity_attributes for update to authenticated using (public.user_owns_project(project_id)) with check (public.user_owns_project(project_id));
create policy entity_attributes_delete on public.entity_attributes for delete to authenticated using (public.user_owns_project(project_id));

------------------------------------------------------------
-- INTEGRATIONS
------------------------------------------------------------
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (length(name) between 1 and 200),
  direction public.integration_direction not null,
  format text,
  frequency text,
  criticality public.integration_criticality not null default 'medium',
  endpoint text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index integrations_project_idx on public.integrations(project_id);
create trigger integrations_set_updated_at before update on public.integrations
  for each row execute function public.set_updated_at();
alter table public.integrations enable row level security;
alter table public.integrations force row level security;
create policy integrations_select on public.integrations for select to authenticated using (public.user_owns_project(project_id));
create policy integrations_insert on public.integrations for insert to authenticated with check (public.user_owns_project(project_id));
create policy integrations_update on public.integrations for update to authenticated using (public.user_owns_project(project_id)) with check (public.user_owns_project(project_id));
create policy integrations_delete on public.integrations for delete to authenticated using (public.user_owns_project(project_id));

------------------------------------------------------------
-- PROJECT_CONSTRAINTS (renombrado para evitar "constraints")
------------------------------------------------------------
create table public.project_constraints (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  description text not null check (length(description) between 1 and 1000),
  rationale text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index project_constraints_project_idx on public.project_constraints(project_id);
create trigger project_constraints_set_updated_at before update on public.project_constraints
  for each row execute function public.set_updated_at();
alter table public.project_constraints enable row level security;
alter table public.project_constraints force row level security;
create policy project_constraints_select on public.project_constraints for select to authenticated using (public.user_owns_project(project_id));
create policy project_constraints_insert on public.project_constraints for insert to authenticated with check (public.user_owns_project(project_id));
create policy project_constraints_update on public.project_constraints for update to authenticated using (public.user_owns_project(project_id)) with check (public.user_owns_project(project_id));
create policy project_constraints_delete on public.project_constraints for delete to authenticated using (public.user_owns_project(project_id));

------------------------------------------------------------
-- ASSUMPTIONS
------------------------------------------------------------
create table public.assumptions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  description text not null check (length(description) between 1 and 1000),
  verified boolean not null default false,
  responsible text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assumptions_project_idx on public.assumptions(project_id);
create trigger assumptions_set_updated_at before update on public.assumptions
  for each row execute function public.set_updated_at();
alter table public.assumptions enable row level security;
alter table public.assumptions force row level security;
create policy assumptions_select on public.assumptions for select to authenticated using (public.user_owns_project(project_id));
create policy assumptions_insert on public.assumptions for insert to authenticated with check (public.user_owns_project(project_id));
create policy assumptions_update on public.assumptions for update to authenticated using (public.user_owns_project(project_id)) with check (public.user_owns_project(project_id));
create policy assumptions_delete on public.assumptions for delete to authenticated using (public.user_owns_project(project_id));

------------------------------------------------------------
-- RISKS
------------------------------------------------------------
create table public.risks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  description text not null check (length(description) between 1 and 1000),
  probability public.risk_level not null default 'medium',
  impact public.risk_level not null default 'medium',
  mitigation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index risks_project_idx on public.risks(project_id);
create trigger risks_set_updated_at before update on public.risks
  for each row execute function public.set_updated_at();
alter table public.risks enable row level security;
alter table public.risks force row level security;
create policy risks_select on public.risks for select to authenticated using (public.user_owns_project(project_id));
create policy risks_insert on public.risks for insert to authenticated with check (public.user_owns_project(project_id));
create policy risks_update on public.risks for update to authenticated using (public.user_owns_project(project_id)) with check (public.user_owns_project(project_id));
create policy risks_delete on public.risks for delete to authenticated using (public.user_owns_project(project_id));

------------------------------------------------------------
-- GLOSSARY_TERMS
------------------------------------------------------------
create table public.glossary_terms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  term text not null check (length(term) between 1 and 200),
  definition text not null check (length(definition) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, term)
);
create index glossary_terms_project_idx on public.glossary_terms(project_id);
create trigger glossary_terms_set_updated_at before update on public.glossary_terms
  for each row execute function public.set_updated_at();
alter table public.glossary_terms enable row level security;
alter table public.glossary_terms force row level security;
create policy glossary_terms_select on public.glossary_terms for select to authenticated using (public.user_owns_project(project_id));
create policy glossary_terms_insert on public.glossary_terms for insert to authenticated with check (public.user_owns_project(project_id));
create policy glossary_terms_update on public.glossary_terms for update to authenticated using (public.user_owns_project(project_id)) with check (public.user_owns_project(project_id));
create policy glossary_terms_delete on public.glossary_terms for delete to authenticated using (public.user_owns_project(project_id));

------------------------------------------------------------
-- SESSIONS (sesiones de elicitación)
------------------------------------------------------------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  mode public.project_mode not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sessions_project_idx on public.sessions(project_id);
create trigger sessions_set_updated_at before update on public.sessions
  for each row execute function public.set_updated_at();
alter table public.sessions enable row level security;
alter table public.sessions force row level security;
create policy sessions_select on public.sessions for select to authenticated using (public.user_owns_project(project_id));
create policy sessions_insert on public.sessions for insert to authenticated with check (public.user_owns_project(project_id));
create policy sessions_update on public.sessions for update to authenticated using (public.user_owns_project(project_id)) with check (public.user_owns_project(project_id));
create policy sessions_delete on public.sessions for delete to authenticated using (public.user_owns_project(project_id));

------------------------------------------------------------
-- ANNOTATIONS (notas privadas del consultor; nunca al PDF)
------------------------------------------------------------
create table public.annotations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  target_kind public.annotation_target_kind not null,
  target_id uuid,
  body text not null check (length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index annotations_project_idx on public.annotations(project_id);
create index annotations_target_idx on public.annotations(target_kind, target_id);
create trigger annotations_set_updated_at before update on public.annotations
  for each row execute function public.set_updated_at();
alter table public.annotations enable row level security;
alter table public.annotations force row level security;
create policy annotations_select on public.annotations for select to authenticated using (public.user_owns_project(project_id));
create policy annotations_insert on public.annotations for insert to authenticated with check (public.user_owns_project(project_id));
create policy annotations_update on public.annotations for update to authenticated using (public.user_owns_project(project_id)) with check (public.user_owns_project(project_id));
create policy annotations_delete on public.annotations for delete to authenticated using (public.user_owns_project(project_id));

------------------------------------------------------------
-- COMENTARIOS DE ESQUEMA (documentación in-DB)
------------------------------------------------------------
comment on table public.projects is 'Raíz: proyecto de levantamiento de requerimientos.';
comment on table public.user_stories is 'Historias de usuario en formato Como/quiero/para.';
comment on table public.acceptance_criteria is 'Criterios Gherkin Given/When/Then por historia.';
comment on table public.nfrs is 'Requerimientos no funcionales clasificados por FURPS+ con métrica.';
comment on table public.annotations is 'Notas privadas del consultor; nunca aparecen en el PDF.';
comment on function public.user_owns_project(uuid) is 'Ownership helper: usado por RLS de tablas hijas. SECURITY DEFINER + search_path vacío.';
