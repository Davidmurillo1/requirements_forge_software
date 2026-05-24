-- 0002_security_invoker_helper.sql
-- Convierte public.user_owns_project a SECURITY INVOKER para silenciar los
-- advisors 0028/0029 que detectan SECURITY DEFINER expuesto en /rest/v1/rpc.
-- Razonamiento: con INVOKER la función ejecuta como el usuario que llama;
-- el SELECT sobre public.projects sigue funcionando porque la policy
-- projects_select_own admite (owner_id = auth.uid()). No hay recursión:
-- la policy de projects NO referencia user_owns_project.
-- Resultado equivalente, sin warning y sin filtrar privilegios.

create or replace function public.user_owns_project(p_project_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and p.owner_id = (select auth.uid())
  )
$$;

comment on function public.user_owns_project(uuid) is
  'Ownership helper para RLS de tablas hijas. SECURITY INVOKER + search_path vacío.';
