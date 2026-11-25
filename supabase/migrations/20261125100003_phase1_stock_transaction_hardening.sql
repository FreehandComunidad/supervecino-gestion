begin;

-- Ajustes de stock: la tabla admite el tipo 'adjustment'; el signo de quantity_delta
-- distingue entradas y salidas. La versión anterior usaba adjustment_in/out, que
-- violaban el CHECK de stock_movements y hacían revertir toda la operación.
create or replace function public.adjust_product_stock(
  p_product_id uuid,
  p_quantity_delta numeric,
  p_notes text default null
) returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_stock numeric;
  v_role text := private.get_current_app_role();
begin
  if v_user is null or v_role is null or v_role not in ('owner', 'manager') then
    raise exception 'No tenés permisos para ajustar stock.';
  end if;

  if p_quantity_delta is null or p_quantity_delta = 0 then
    raise exception 'El ajuste no puede ser cero.';
  end if;

  select p.stock into v_stock
  from public.products p
  where p.id = p_product_id and p.active = true
  for update;

  if not found then raise exception 'Producto inexistente o inactivo.'; end if;
  if v_stock + p_quantity_delta < 0 then
    raise exception 'El ajuste dejaría el stock negativo.';
  end if;

  update public.products
  set stock = stock + p_quantity_delta, updated_at = now()
  where id = p_product_id;

  insert into public.stock_movements(
    product_id, movement_type, quantity_delta, notes, created_by
  )
  values (
    p_product_id, 'adjustment', p_quantity_delta, p_notes, v_user
  );

  return v_stock + p_quantity_delta;
end;
$$;

revoke all on function public.adjust_product_stock(uuid, numeric, text) from public, anon;
grant execute on function public.adjust_product_stock(uuid, numeric, text) to authenticated;

-- Recepción: el orden estable por product_id reduce deadlocks entre recepciones
-- concurrentes. 'purchase' es el tipo permitido por el CHECK de stock_movements.
create or replace function public.receive_purchase(p_purchase_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item record;
  v_status text;
  v_user uuid := (select auth.uid());
  v_role text := private.get_current_app_role();
begin
  if v_user is null or v_role is null or v_role not in ('owner', 'manager') then
    raise exception 'No tenés permisos para recibir compras.';
  end if;

  select p.status into v_status
  from public.purchases p
  where p.id = p_purchase_id
  for update;

  if not found then raise exception 'Compra inexistente.'; end if;
  if v_status <> 'draft' then raise exception 'La compra ya fue procesada.'; end if;

  for v_item in
    select pi.*
    from public.purchase_items pi
    where pi.purchase_id = p_purchase_id
    order by pi.product_id
  loop
    update public.products
    set stock = stock + v_item.quantity,
        cost_price = v_item.unit_cost_net,
        vat_rate = v_item.vat_rate,
        updated_at = now()
    where id = v_item.product_id;

    if not found then
      raise exception 'Producto inexistente para el artículo de compra.';
    end if;

    insert into public.stock_movements(
      product_id, movement_type, quantity_delta, reference_id, notes, created_by
    )
    values (
      v_item.product_id, 'purchase', v_item.quantity,
      p_purchase_id, 'Ingreso por compra', v_user
    );

    insert into public.supplier_products(
      supplier_id, product_id, last_cost_net, vat_rate, updated_at
    )
    select p.supplier_id, v_item.product_id, v_item.unit_cost_net, v_item.vat_rate, now()
    from public.purchases p
    where p.id = p_purchase_id
    on conflict (supplier_id, product_id)
    do update set
      last_cost_net = excluded.last_cost_net,
      vat_rate = excluded.vat_rate,
      updated_at = now();
  end loop;

  update public.purchases
  set status = 'received', received_at = now()
  where id = p_purchase_id;
end;
$$;

revoke all on function public.receive_purchase(uuid) from public, anon;
grant execute on function public.receive_purchase(uuid) to authenticated;

-- Funciones invoker: fijar search_path vacío y exigir sesión/rol en el cuerpo.
alter function public.create_purchase_with_items(uuid, text, date, date, text, jsonb)
  set search_path = '';
alter function public.register_supplier_payment(uuid, numeric, date, text, text, text)
  set search_path = '';

revoke all on function public.create_purchase_with_items(uuid, text, date, date, text, jsonb) from public, anon;
grant execute on function public.create_purchase_with_items(uuid, text, date, date, text, jsonb) to authenticated;

revoke all on function public.register_supplier_payment(uuid, numeric, date, text, text, text) from public, anon;
grant execute on function public.register_supplier_payment(uuid, numeric, date, text, text, text) to authenticated;

notify pgrst, 'reload schema';
commit;
