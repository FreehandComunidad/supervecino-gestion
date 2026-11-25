begin;

-- Caja compartida por turno: registrar ingresos/egresos mediante RPC,
-- nunca mediante INSERT directo desde el cliente.
create or replace function public.register_cash_movement(
  p_movement_type text,
  p_amount numeric,
  p_description text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_session_id uuid;
  v_movement_id uuid;
  v_description text := nullif(trim(p_description), '');
begin
  if v_user is null
     or private.get_current_app_role() not in ('owner', 'manager', 'cashier') then
    raise exception 'Usuario sin perfil activo o sin permisos para operar caja.';
  end if;

  if p_movement_type not in ('in', 'out') then
    raise exception 'El tipo de movimiento debe ser ingreso o egreso.';
  end if;

  if p_amount is null
     or p_amount <= 0
     or p_amount::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'El importe debe ser un número positivo y válido.';
  end if;

  if v_description is null or char_length(v_description) > 160 then
    raise exception 'La descripción es obligatoria y no puede superar 160 caracteres.';
  end if;

  -- Serializa ingresos/egresos con el cierre de la caja del turno.
  select s.id into v_session_id
  from public.cash_sessions s
  where s.closed_at is null
  for update;

  if v_session_id is null then
    raise exception 'No hay una caja abierta.';
  end if;

  insert into public.cash_movements(session_id, movement_type, amount, description, created_by)
  values (v_session_id, p_movement_type, p_amount, v_description, v_user)
  returning id into v_movement_id;

  return v_movement_id;
end;
$$;

revoke all on function public.register_cash_movement(text, numeric, text) from public, anon;
grant execute on function public.register_cash_movement(text, numeric, text) to authenticated;

-- Impide que un cliente saltee la validación del RPC insertando movimientos.
revoke insert, update, delete on table public.cash_movements from public, anon, authenticated;

-- El importe contado debe ser obligatorio y finito; NULL no puede saltar el control.
create or replace function private.close_cash_session(
  p_closing_amount numeric,
  p_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_session public.cash_sessions%rowtype;
  v_expected numeric(14,2);
begin
  if v_user is null or private.get_current_app_role() is null then
    raise exception 'Usuario sin perfil activo';
  end if;

  if p_closing_amount is null
     or p_closing_amount < 0
     or p_closing_amount::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'El importe contado debe ser cero o mayor y válido.';
  end if;

  select s.* into v_session
  from public.cash_sessions s
  where s.closed_at is null
  for update;

  if not found then raise exception 'No hay una caja abierta'; end if;

  if private.get_current_app_role() not in ('owner', 'manager')
     and v_session.opened_by <> v_user then
    raise exception 'Solo quien abrió la caja o un encargado puede cerrarla';
  end if;

  select v_session.opening_amount
       + coalesce(sum(case when m.movement_type in ('in', 'sale') then m.amount else -m.amount end), 0)
  into v_expected
  from public.cash_movements m
  where m.session_id = v_session.id;

  update public.cash_sessions
  set closed_by = v_user,
      closed_at = now(),
      closing_amount = p_closing_amount,
      expected_amount = v_expected,
      notes = p_notes
  where id = v_session.id;

  return jsonb_build_object(
    'session_id', v_session.id,
    'expected_amount', v_expected,
    'closing_amount', p_closing_amount,
    'difference', p_closing_amount - v_expected
  );
end;
$$;

commit;
