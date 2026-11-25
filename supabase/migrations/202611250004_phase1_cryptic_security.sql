begin;

-- La tabla existe en producción y contiene participantes históricos.
-- CREATE IF NOT EXISTS recrea solo el esquema en el laboratorio; no borra registros existentes.
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

-- Tablas privadas para intentos y etapas completadas.
create table if not exists public.cryptic_attempts (
  guest_id uuid not null references public.cryptic_guests(id) on delete cascade,
  stage_number integer not null check (stage_number between 1 and 20),
  attempts_used integer not null default 0 check (attempts_used between 0 and 5),
  hints_used integer not null default 0 check (hints_used between 0 and 3),
  completed_at timestamptz,
  points_awarded integer not null default 0 check (points_awarded between 0 and 100),
  primary key (guest_id, stage_number)
);

create table if not exists public.cryptic_completions (
  guest_id uuid not null references public.cryptic_guests(id) on delete cascade,
  stage_number integer not null check (stage_number between 1 and 20),
  points_awarded integer not null check (points_awarded between 0 and 100),
  completed_at timestamptz not null default now(),
  primary key (guest_id, stage_number)
);

alter table public.cryptic_attempts enable row level security;
alter table public.cryptic_completions enable row level security;
revoke all on table public.cryptic_attempts, public.cryptic_completions from public, anon, authenticated;
grant all on table public.cryptic_attempts, public.cryptic_completions to service_role;

-- El endpoint Edge valida la respuesta secreta y solo entonces llama a esta RPC.
-- La base limita los intentos y hace idempotente la puntuación por participante/etapa.
drop function if exists public.add_cryptic_points(uuid, integer);
create or replace function public.record_cryptic_attempt(
  p_guest_id uuid,
  p_stage_number integer,
  p_is_correct boolean,
  p_hints_used integer default 0
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempts integer;
  v_hints integer;
  v_completed_at timestamptz;
  v_points integer := 0;
  v_total integer;
  v_inserted integer;
begin
  if p_guest_id is null
     or p_stage_number is null
     or p_stage_number < 1
     or p_stage_number > 20
     or p_is_correct is null
     or p_hints_used is null
     or p_hints_used < 0
     or p_hints_used > 3 then
    raise exception 'Datos del intento inválidos.';
  end if;

  insert into public.cryptic_attempts(guest_id, stage_number, attempts_used, hints_used)
  values (p_guest_id, p_stage_number, 1, p_hints_used)
  on conflict (guest_id, stage_number) do nothing;

  if found then
    v_attempts := 1;
    v_hints := p_hints_used;
    v_completed_at := null;
  else
    select attempts_used, hints_used, completed_at
    into v_attempts, v_hints, v_completed_at
    from public.cryptic_attempts
    where guest_id = p_guest_id and stage_number = p_stage_number
    for update;

    if v_completed_at is not null then
      select points into v_total from public.cryptic_guests where id = p_guest_id;
      return jsonb_build_object(
        'correct', true, 'already_completed', true, 'locked', false,
        'attempts_used', v_attempts, 'remaining_attempts', 0,
        'points_awarded', 0, 'points_preview', 0, 'total_points', coalesce(v_total, 0)
      );
    end if;

    if v_attempts >= 5 then
      select points into v_total from public.cryptic_guests where id = p_guest_id;
      return jsonb_build_object(
        'correct', false, 'already_completed', false, 'locked', true,
        'attempts_used', v_attempts, 'remaining_attempts', 0,
        'points_awarded', 0, 'points_preview', 0, 'total_points', coalesce(v_total, 0)
      );
    end if;

    update public.cryptic_attempts
    set attempts_used = attempts_used + 1,
        hints_used = greatest(hints_used, p_hints_used)
    where guest_id = p_guest_id and stage_number = p_stage_number
    returning attempts_used, hints_used into v_attempts, v_hints;
  end if;

  v_points := greatest(0, greatest(60, 100 - ((v_attempts - 1) * 10)) - (v_hints * 10));

  if p_is_correct then
    insert into public.cryptic_completions(guest_id, stage_number, points_awarded)
    values (p_guest_id, p_stage_number, v_points)
    on conflict (guest_id, stage_number) do nothing;

    get diagnostics v_inserted = row_count;
    if v_inserted = 1 then
      update public.cryptic_guests
      set points = points + v_points
      where id = p_guest_id;

      update public.cryptic_attempts
      set completed_at = now(), points_awarded = v_points
      where guest_id = p_guest_id and stage_number = p_stage_number;
    end if;
  end if;

  select points into v_total from public.cryptic_guests where id = p_guest_id;
  if v_total is null then raise exception 'Participante no encontrado.'; end if;

  return jsonb_build_object(
    'correct', p_is_correct,
    'already_completed', false,
    'locked', false,
    'attempts_used', v_attempts,
    'remaining_attempts', greatest(0, 5 - v_attempts),
    'points_awarded', case when p_is_correct and v_inserted = 1 then v_points else 0 end,
    'points_preview', v_points,
    'total_points', v_total
  );
end;
$$;

revoke all on function public.record_cryptic_attempt(uuid, integer, boolean, integer) from public, anon, authenticated;
grant execute on function public.record_cryptic_attempt(uuid, integer, boolean, integer) to service_role;

-- El reinicio exige la sesión real del propietario y conserva todos los participantes.
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
  delete from public.cryptic_attempts;
  update public.cryptic_guests set points = 0;
  get diagnostics v_reset = row_count;

  return v_reset;
end;
$$;

revoke all on function public.reset_cryptic_ranking() from public, anon;
grant execute on function public.reset_cryptic_ranking() to authenticated;

notify pgrst, 'reload schema';
commit;
