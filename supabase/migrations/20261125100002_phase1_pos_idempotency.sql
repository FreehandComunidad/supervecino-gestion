begin;

alter table public.sales
  add column if not exists idempotency_key uuid,
  add column if not exists request_hash text;

create unique index if not exists sales_idempotency_key_uidx
  on public.sales(idempotency_key)
  where idempotency_key is not null;

-- Reemplazar la implementación privada manteniendo un wrapper legacy de cinco argumentos.
drop function if exists public.create_pos_sale(jsonb, jsonb, numeric, uuid, text);
drop function if exists private.create_pos_sale(jsonb, jsonb, numeric, uuid, text);

create or replace function private.create_pos_sale(
  p_items jsonb,
  p_payments jsonb,
  p_discount numeric,
  p_customer_id uuid,
  p_notes text,
  p_idempotency_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_profile public.profiles%rowtype;
  v_session uuid;
  v_sale_id uuid;
  v_sale_number bigint;
  v_subtotal numeric(14,2) := 0;
  v_total numeric(14,2);
  v_paid numeric(14,2) := 0;
  v_item jsonb;
  v_payment jsonb;
  v_product public.products%rowtype;
  v_qty numeric(14,3);
  v_line numeric(14,2);
  v_method text;
  v_request_hash text;
  v_existing public.sales%rowtype;
begin
  if v_user is null then raise exception 'Debe iniciar sesión'; end if;

  select * into v_profile
  from public.profiles
  where id = v_user and active = true;

  if not found then raise exception 'Usuario sin perfil activo'; end if;
  if p_idempotency_key is null then raise exception 'Falta la clave de idempotencia de la venta'; end if;

  v_request_hash := md5(jsonb_build_object(
    'items', p_items,
    'payments', p_payments,
    'discount', coalesce(p_discount, 0),
    'customer_id', p_customer_id,
    'notes', p_notes
  )::text);

  -- Serializa solicitudes concurrentes con la misma clave antes de comprobar si ya existe.
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));

  select * into v_existing
  from public.sales
  where idempotency_key = p_idempotency_key;

  if found then
    if v_existing.cashier_id is distinct from v_user
       or v_existing.request_hash is distinct from v_request_hash then
      raise exception 'La clave de idempotencia ya fue utilizada para otra operación.';
    end if;

    return jsonb_build_object(
      'sale_id', v_existing.id,
      'sale_number', v_existing.sale_number,
      'subtotal', v_existing.subtotal,
      'discount', v_existing.discount,
      'total', v_existing.total,
      'paid', v_existing.total,
      'duplicate', true
    );
  end if;

  p_discount := coalesce(p_discount, 0);
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta debe contener productos';
  end if;
  if jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then
    raise exception 'Debe indicar medios de pago';
  end if;
  if p_discount < 0 then raise exception 'Descuento inválido'; end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if v_item ? 'unit_price' then
      raise exception 'No se permite enviar precios desde el punto de venta';
    end if;
  end loop;

  -- Bloqueo determinista por producto y validación de stock.
  for v_item in
    select jsonb_build_object('product_id', product_id, 'quantity', sum(quantity))
    from (
      select (value->>'product_id')::uuid as product_id,
             (value->>'quantity')::numeric as quantity
      from jsonb_array_elements(p_items)
    ) items
    group by product_id
    order by product_id
  loop
    v_qty := (v_item->>'quantity')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'Cantidad inválida'; end if;

    select * into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid and active = true
    for update;

    if not found then raise exception 'Producto inexistente o inactivo'; end if;
    if v_product.manages_stock and v_product.stock < v_qty then
      raise exception 'Stock insuficiente para % (disponible: %)', v_product.name, v_product.stock;
    end if;

    v_subtotal := v_subtotal + round(v_qty * v_product.sale_price, 2);
  end loop;

  if p_discount > v_subtotal then raise exception 'El descuento supera el subtotal'; end if;
  v_total := round(v_subtotal - p_discount, 2);
  if v_total <= 0 then raise exception 'El total debe ser mayor que cero'; end if;

  select id into v_session
  from public.cash_sessions
  where closed_at is null
  for update;

  if v_session is null then raise exception 'Debe abrir una caja antes de vender'; end if;

  for v_payment in select value from jsonb_array_elements(p_payments)
  loop
    v_method := v_payment->>'method';
    if v_method not in ('cash', 'debit', 'credit', 'transfer', 'wallet', 'other') then
      raise exception 'Medio de pago inválido';
    end if;
    if coalesce((v_payment->>'amount')::numeric, 0) <= 0 then
      raise exception 'Importe de pago inválido';
    end if;
    v_paid := v_paid + (v_payment->>'amount')::numeric;
  end loop;

  if round(v_paid, 2) <> v_total then
    raise exception 'Los pagos deben cubrir exactamente el total';
  end if;

  insert into public.sales(
    customer_id, cashier_id, subtotal, discount, total, notes, idempotency_key, request_hash
  )
  values (
    p_customer_id, v_user, v_subtotal, p_discount, v_total, p_notes, p_idempotency_key, v_request_hash
  )
  on conflict (idempotency_key) where idempotency_key is not null do nothing
  returning id, sale_number into v_sale_id, v_sale_number;

  if v_sale_id is null then
    select * into v_existing
    from public.sales
    where idempotency_key = p_idempotency_key;

    if not found
       or v_existing.cashier_id is distinct from v_user
       or v_existing.request_hash is distinct from v_request_hash then
      raise exception 'No se pudo confirmar la clave de idempotencia.';
    end if;

    return jsonb_build_object(
      'sale_id', v_existing.id,
      'sale_number', v_existing.sale_number,
      'subtotal', v_existing.subtotal,
      'discount', v_existing.discount,
      'total', v_existing.total,
      'paid', v_existing.total,
      'duplicate', true
    );
  end if;

  for v_item in
    select jsonb_build_object('product_id', product_id, 'quantity', sum(quantity))
    from (
      select (value->>'product_id')::uuid as product_id,
             (value->>'quantity')::numeric as quantity
      from jsonb_array_elements(p_items)
    ) items
    group by product_id
    order by product_id
  loop
    select * into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid;

    v_qty := (v_item->>'quantity')::numeric;
    v_line := round(v_qty * v_product.sale_price, 2);

    insert into public.sale_items(
      sale_id, product_id, product_name, barcode, quantity, unit, unit_price, line_total
    )
    values (
      v_sale_id, v_product.id, v_product.name, v_product.barcode,
      v_qty, v_product.unit, v_product.sale_price, v_line
    );

    if v_product.manages_stock then
      update public.products
      set stock = stock - v_qty, updated_at = now()
      where id = v_product.id;

      insert into public.stock_movements(
        product_id, movement_type, quantity_delta, reference_id, created_by
      )
      values (v_product.id, 'sale', -v_qty, v_sale_id, v_user);
    end if;
  end loop;

  for v_payment in select value from jsonb_array_elements(p_payments)
  loop
    insert into public.payments(sale_id, method, amount, reference)
    values (
      v_sale_id,
      v_payment->>'method',
      (v_payment->>'amount')::numeric,
      v_payment->>'reference'
    );

    if v_payment->>'method' = 'cash' then
      insert into public.cash_movements(
        session_id, movement_type, amount, description, created_by
      )
      values (
        v_session,
        'sale',
        (v_payment->>'amount')::numeric,
        'Venta #' || v_sale_number,
        v_user
      );
    end if;
  end loop;

  return jsonb_build_object(
    'sale_id', v_sale_id,
    'sale_number', v_sale_number,
    'subtotal', v_subtotal,
    'discount', p_discount,
    'total', v_total,
    'paid', v_paid,
    'duplicate', false
  );
end;
$$;

revoke all on function private.create_pos_sale(jsonb, jsonb, numeric, uuid, text, uuid) from public, anon;
grant execute on function private.create_pos_sale(jsonb, jsonb, numeric, uuid, text, uuid) to authenticated;

-- Wrapper nuevo: idempotencia explícita para la versión actual del POS.
create or replace function public.create_pos_sale(
  p_items jsonb,
  p_payments jsonb,
  p_discount numeric,
  p_customer_id uuid,
  p_notes text,
  p_idempotency_key uuid
) returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.create_pos_sale(
    p_items, p_payments, p_discount, p_customer_id, p_notes, p_idempotency_key
  );
$$;

-- Compatibilidad temporal con la versión anterior del frontend.
-- Las nuevas versiones siempre deben enviar p_idempotency_key.
create or replace function public.create_pos_sale(
  p_items jsonb,
  p_payments jsonb,
  p_discount numeric default 0,
  p_customer_id uuid default null,
  p_notes text default null
) returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.create_pos_sale(
    p_items, p_payments, p_discount, p_customer_id, p_notes, gen_random_uuid()
  );
$$;

revoke all on function public.create_pos_sale(jsonb, jsonb, numeric, uuid, text, uuid) from public, anon;
revoke all on function public.create_pos_sale(jsonb, jsonb, numeric, uuid, text) from public, anon;
grant execute on function public.create_pos_sale(jsonb, jsonb, numeric, uuid, text, uuid) to authenticated;
grant execute on function public.create_pos_sale(jsonb, jsonb, numeric, uuid, text) to authenticated;

notify pgrst, 'reload schema';
commit;
