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
  v_role text := private.get_current_app_role();
begin
  if v_user is null or v_role is null or v_role not in ('owner', 'manager', 'cashier') then
    raise exception 'Usuario sin perfil activo o sin permisos para operar caja.';
  end if;

  if p_movement_type is null or p_movement_type not in ('in', 'out') then
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


-- Pago a proveedor: el rol nulo/inactivo también debe ser denegado.
create or replace function public.register_supplier_payment(
  p_purchase_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_payment_method text,
  p_reference text default null,
  p_notes text default null
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $register_supplier_payment$
declare
  v_purchase public.purchases%rowtype;
  v_paid numeric;
  v_id uuid;
  v_user uuid := (select auth.uid());
  v_role text := private.get_current_app_role();
  v_method text := coalesce(nullif(trim(p_payment_method), ''), 'transfer');
begin
  if v_user is null or v_role is null or v_role not in ('owner', 'manager') then
    raise exception 'No tenés permisos para registrar pagos a proveedores.';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'El importe debe ser mayor que cero y válido.';
  end if;

  select p.* into v_purchase
  from public.purchases p
  where p.id = p_purchase_id
  for update;

  if not found then raise exception 'No se encontró la factura.'; end if;
  if v_purchase.status <> 'received' then raise exception 'Primero tenés que recibir la factura.'; end if;

  select coalesce(sum(sp.amount), 0) into v_paid
  from public.supplier_payments sp
  where sp.purchase_id = p_purchase_id;

  if p_amount > v_purchase.total - v_paid + 0.005 then
    raise exception 'El pago supera el saldo pendiente.';
  end if;

  insert into public.supplier_payments(
    purchase_id, payment_date, amount, payment_method, reference, notes, created_by
  ) values (
    p_purchase_id, coalesce(p_payment_date, current_date), p_amount, v_method,
    nullif(trim(p_reference), ''), nullif(trim(p_notes), ''), v_user
  ) returning id into v_id;

  return v_id;
end;
$register_supplier_payment$;

revoke all on function public.register_supplier_payment(uuid, numeric, date, text, text, text) from public, anon;
grant execute on function public.register_supplier_payment(uuid, numeric, date, text, text, text) to authenticated;

commit;
