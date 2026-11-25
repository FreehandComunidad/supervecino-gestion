create table if not exists public.organizations (
 id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
 owner_id uuid not null references auth.users(id) on delete restrict, active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.organization_memberships (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null default 'employee' check (role in ('owner','admin','manager','employee')),
 active boolean not null default true, created_at timestamptz not null default now(), unique (organization_id,user_id)
);
create table if not exists public.businesses (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 name text not null, business_type text, description text, active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.business_locations (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
 name text not null, address text, city text, province text, country text not null default 'Argentina',
 active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.oasis_agents (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 business_id uuid references public.businesses(id) on delete set null, slug text not null, name text not null,
 job_title text not null, department text not null, specialty text, instructions text,
 status text not null default 'available' check (status in ('available','working','paused')),
 active boolean not null default true, config jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id,slug)
);
create table if not exists public.oasis_tasks (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 business_id uuid references public.businesses(id) on delete set null, assigned_agent_id uuid references public.oasis_agents(id) on delete set null,
 created_by uuid references auth.users(id) on delete set null, title text not null, description text,
 status text not null default 'pending' check (status in ('pending','in_progress','waiting_approval','completed','cancelled')),
 priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
 due_at timestamptz, result jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.oasis_conversations (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 business_id uuid references public.businesses(id) on delete set null, title text not null default 'Nueva conversación',
 created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.oasis_messages (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 conversation_id uuid not null references public.oasis_conversations(id) on delete cascade,
 sender_type text not null check (sender_type in ('user','agent','system')), sender_user_id uuid references auth.users(id) on delete set null,
 sender_agent_id uuid references public.oasis_agents(id) on delete set null, content text not null,
 metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists organization_memberships_user_idx on public.organization_memberships(user_id,active);
create index if not exists businesses_org_idx on public.businesses(organization_id,active);
create index if not exists business_locations_business_idx on public.business_locations(business_id,active);
create index if not exists oasis_agents_org_idx on public.oasis_agents(organization_id,active);
create index if not exists oasis_tasks_org_status_idx on public.oasis_tasks(organization_id,status,created_at desc);
create index if not exists oasis_conversations_org_idx on public.oasis_conversations(organization_id,updated_at desc);
create index if not exists oasis_messages_conversation_idx on public.oasis_messages(conversation_id,created_at);
create or replace function public.oasis_is_org_member(target_org uuid) returns boolean language sql stable security definer set search_path=public,pg_temp
as $$ select exists(select 1 from public.organization_memberships m where m.organization_id=target_org and m.user_id=(select auth.uid()) and m.active) $$;
create or replace function public.oasis_is_org_admin(target_org uuid) returns boolean language sql stable security definer set search_path=public,pg_temp
as $$ select exists(select 1 from public.organization_memberships m where m.organization_id=target_org and m.user_id=(select auth.uid()) and m.active and m.role in ('owner','admin')) $$;
revoke all on function public.oasis_is_org_member(uuid) from public;
revoke all on function public.oasis_is_org_admin(uuid) from public;
grant execute on function public.oasis_is_org_member(uuid) to authenticated;
grant execute on function public.oasis_is_org_admin(uuid) to authenticated;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.businesses enable row level security;
alter table public.business_locations enable row level security;
alter table public.oasis_agents enable row level security;
alter table public.oasis_tasks enable row level security;
alter table public.oasis_conversations enable row level security;
alter table public.oasis_messages enable row level security;
drop policy if exists oasis_org_read on public.organizations;
create policy oasis_org_read on public.organizations for select to authenticated using (public.oasis_is_org_member(id));
drop policy if exists oasis_org_update on public.organizations;
create policy oasis_org_update on public.organizations for update to authenticated using (public.oasis_is_org_admin(id)) with check (public.oasis_is_org_admin(id));
drop policy if exists oasis_members_read on public.organization_memberships;
create policy oasis_members_read on public.organization_memberships for select to authenticated using (public.oasis_is_org_member(organization_id));
drop policy if exists oasis_members_insert on public.organization_memberships;
create policy oasis_members_insert on public.organization_memberships for insert to authenticated with check (public.oasis_is_org_admin(organization_id));
drop policy if exists oasis_members_update on public.organization_memberships;
create policy oasis_members_update on public.organization_memberships for update to authenticated using (public.oasis_is_org_admin(organization_id)) with check (public.oasis_is_org_admin(organization_id));
drop policy if exists oasis_members_delete on public.organization_memberships;
create policy oasis_members_delete on public.organization_memberships for delete to authenticated using (public.oasis_is_org_admin(organization_id));
drop policy if exists oasis_businesses_read on public.businesses;
create policy oasis_businesses_read on public.businesses for select to authenticated using (public.oasis_is_org_member(organization_id));
drop policy if exists oasis_businesses_manage on public.businesses;
create policy oasis_businesses_manage on public.businesses for all to authenticated using (public.oasis_is_org_admin(organization_id)) with check (public.oasis_is_org_admin(organization_id));
drop policy if exists oasis_locations_read on public.business_locations;
create policy oasis_locations_read on public.business_locations for select to authenticated using (exists(select 1 from public.businesses b where b.id=business_id and public.oasis_is_org_member(b.organization_id)));
drop policy if exists oasis_locations_manage on public.business_locations;
create policy oasis_locations_manage on public.business_locations for all to authenticated using (exists(select 1 from public.businesses b where b.id=business_id and public.oasis_is_org_admin(b.organization_id))) with check (exists(select 1 from public.businesses b where b.id=business_id and public.oasis_is_org_admin(b.organization_id)));
drop policy if exists oasis_agents_read on public.oasis_agents;
create policy oasis_agents_read on public.oasis_agents for select to authenticated using (public.oasis_is_org_member(organization_id));
drop policy if exists oasis_agents_manage on public.oasis_agents;
create policy oasis_agents_manage on public.oasis_agents for all to authenticated using (public.oasis_is_org_admin(organization_id)) with check (public.oasis_is_org_admin(organization_id));
drop policy if exists oasis_tasks_read on public.oasis_tasks;
create policy oasis_tasks_read on public.oasis_tasks for select to authenticated using (public.oasis_is_org_member(organization_id));
drop policy if exists oasis_tasks_insert on public.oasis_tasks;
create policy oasis_tasks_insert on public.oasis_tasks for insert to authenticated with check (public.oasis_is_org_member(organization_id) and (created_by is null or created_by=(select auth.uid())));
drop policy if exists oasis_tasks_update on public.oasis_tasks;
create policy oasis_tasks_update on public.oasis_tasks for update to authenticated using (public.oasis_is_org_member(organization_id)) with check (public.oasis_is_org_member(organization_id));
drop policy if exists oasis_conversations_read on public.oasis_conversations;
create policy oasis_conversations_read on public.oasis_conversations for select to authenticated using (public.oasis_is_org_member(organization_id));
drop policy if exists oasis_conversations_insert on public.oasis_conversations;
create policy oasis_conversations_insert on public.oasis_conversations for insert to authenticated with check (public.oasis_is_org_member(organization_id) and (created_by is null or created_by=(select auth.uid())));
drop policy if exists oasis_conversations_update on public.oasis_conversations;
create policy oasis_conversations_update on public.oasis_conversations for update to authenticated using (public.oasis_is_org_member(organization_id)) with check (public.oasis_is_org_member(organization_id));
drop policy if exists oasis_messages_read on public.oasis_messages;
create policy oasis_messages_read on public.oasis_messages for select to authenticated using (public.oasis_is_org_member(organization_id));
drop policy if exists oasis_messages_insert on public.oasis_messages;
create policy oasis_messages_insert on public.oasis_messages for insert to authenticated with check (public.oasis_is_org_member(organization_id) and exists(select 1 from public.oasis_conversations c where c.id=conversation_id and c.organization_id=oasis_messages.organization_id) and ((sender_type='user' and sender_user_id=(select auth.uid())) or (sender_type in ('agent','system') and sender_user_id is null)));
do $$
declare v_owner uuid; v_org uuid; v_business uuid;
begin
 select id into v_owner from public.profiles where role='owner' and active=true order by created_at limit 1;
 if v_owner is null then raise exception 'No existe un perfil owner activo para inicializar OASIS HQ'; end if;
 insert into public.organizations(name,slug,owner_id) values ('OASIS HQ','oasis-hq',v_owner)
 on conflict (slug) do update set name=excluded.name, owner_id=excluded.owner_id returning id into v_org;
 insert into public.organization_memberships(organization_id,user_id,role,active) values (v_org,v_owner,'owner',true)
 on conflict (organization_id,user_id) do update set role='owner',active=true;
 select b.id into v_business from public.businesses b where b.organization_id=v_org and b.name='SÚPERVECINO' limit 1;
 if v_business is null then
  insert into public.businesses(organization_id,name,business_type,description)
  values(v_org,'SÚPERVECINO','Supermercado y minimercado','Negocio inicial conectado a OASIS HQ') returning id into v_business;
 end if;
 if not exists(select 1 from public.business_locations bl where bl.business_id=v_business) then
  insert into public.business_locations(business_id,name,address,city,province,country)
  values(v_business,'Casa central','Barrio Tehul, Las Casuarinas','Las Casuarinas','San Juan','Argentina');
 end if;
 insert into public.oasis_agents(organization_id,business_id,slug,name,job_title,department,specialty,instructions)
 values
 (v_org,v_business,'atlas','Atlas','Director general','Dirección','Coordinación estratégica','Coordinar prioridades y solicitar aprobación del propietario para decisiones sensibles.'),
 (v_org,v_business,'vera','Vera','Directora financiera','Finanzas','Rentabilidad, caja y presupuestos','Analizar ingresos, costos, márgenes, caja y presupuestos.'),
 (v_org,v_business,'bruno','Bruno','Jefe de stock y logística','Inventario','Stock, rotación y reposición','Controlar inventario, rotación, faltantes y necesidades de reposición.'),
 (v_org,v_business,'mia','Mía','Gerenta de compras','Compras','Proveedores y listas de precios','Comparar proveedores, costos, listas de precios y propuestas de compra.'),
 (v_org,v_business,'gael','Gael','Gerente de sucursales','Operaciones','Procesos y sucursales','Supervisar operaciones, sucursales, procedimientos y resultados.'),
 (v_org,v_business,'alma','Alma','Responsable de recursos humanos','Personas','Equipos y turnos','Organizar equipos, horarios, novedades y necesidades de personal.'),
 (v_org,v_business,'luca','Luca','Director de marketing','Marketing','Promociones y comunicación','Proponer campañas, promociones y comunicación comercial.'),
 (v_org,v_business,'noa','Noa','Analista de datos','Inteligencia','Indicadores y tendencias','Analizar ventas, tendencias, alertas y oportunidades.'),
 (v_org,v_business,'elias','Elías','Auditor interno','Control','Auditoría y alertas','Revisar inconsistencias, movimientos y alertas de control.')
 on conflict (organization_id,slug) do update set business_id=excluded.business_id,name=excluded.name,job_title=excluded.job_title,department=excluded.department,specialty=excluded.specialty,instructions=excluded.instructions;
end $$;
