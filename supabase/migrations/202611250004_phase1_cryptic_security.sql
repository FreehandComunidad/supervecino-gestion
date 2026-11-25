begin;

-- La tabla ya existe en producción y contiene participantes históricos.
-- CREATE IF NOT EXISTS permite recrear el esquema de forma aislada sin tocar esos registros.
create table if not exists public.cryptic_guests (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  points integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.cryptic_guests enable row level security;

revoke all on table public.cryptic_guests from public, anon, authenticated;
grant select, insert on table public.cryptic_guests to anon, authenticated;
revoke update, delete, truncate on table public.cryptic_guests from public, anon, authenticated;

drop policy if exists "Guests can register with zero points" on public.cryptic_guests;
create policy "Guests can register with zero points"
on public.cryptic_guests for insert to anon, authenticated
with check (points = 0);

drop policy if exists "Guests can view leaderboard" on public.cryptic_guests;
create policy "Guests can view leaderboard"
on public.cryptic_guests for select to anon, authenticated
using (true);

-- Registro interno de etapas completadas. No es accesible desde el navegador.
create table if not exists public.cryptic_completions (
  guest_id uuid not null references public.cryptic_guests(id) on delete cascade,
  stage_number integer not null check (stage_number between 1 and 20),
  points_awarded integer not null check (points_awarded between 60 and 100),
  completed_at timestamptz not null default now(),
  primary key (guest_id, stage_number)
);

alter table public.cryptic_completions enable row level security;
revoke all on table public.cryptic_completions from public, anon, authenticated;
grant all on table public.cryptic_completions to service_role;

-- La suma de puntos solo puede ejecutarse desde la Edge Function con service_role.
drop function if exists public.add_cryptic_points(uuid, integer);
create or replace function public.add_cryptic_points(
  p_guest_id uuid,
  p_stage_number integer,
  p_points integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
  v_inserted integer;
begin
  if p_guest_id is null
     or p_stage_number is null
     or p_stage_number < 1
     or p_stage_number > 20
     or p_points is null
     or p_points < 60
     or p_points > 100 then
    raise exception 'Puntaje o etapa inválidos.';
  end if;

  insert into public.cryptic_completions(guest_id, stage_number, points_awarded)
  values (p_guest_id, p_stage_number, p_points)
  on conflict (guest_id, stage_number) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted = 1 then
    update public.cryptic_guests
    set points = points + p_points
    where id = p_guest_id
    returning points into v_total;
  else
    select points into v_total
    from public.cryptic_guests
    where id = p_guest_id;
  end if;

  if v_total is null then
    raise exception 'Participante no encontrado.';
  end if;

  return jsonb_build_object(
    'awarded', v_inserted = 1,
    'points_awarded', case when v_inserted = 1 then p_points else 0 end,
    'total_points', v_total
  );
end;
$$;

revoke all on function public.add_cryptic_points(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.add_cryptic_points(uuid, integer, integer) to service_role;

-- El reinicio ya no elimina participantes: solo reinicia puntos y progreso.
drop function if exists public.reset_cryptic_ranking(text);
create or replace function public.reset_cryptic_ranking()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_reset integer;
begin
  if v_user is null or not exists (
    select 1
    from public.profiles p
    where p.id = v_user
      and p.active = true
      and p.role = 'owner'
  ) then
    raise exception 'Solo el propietario activo puede reiniciar el ranking.';
  end if;

  delete from public.cryptic_completions;
  update public.cryptic_guests set points = 0;
  get diagnostics v_reset = row_count;

  return v_reset;
end;
$$;

revoke all on function public.reset_cryptic_ranking() from public, anon;
grant execute on function public.reset_cryptic_ranking() to authenticated;

notify pgrst, 'reload schema';
commit;
