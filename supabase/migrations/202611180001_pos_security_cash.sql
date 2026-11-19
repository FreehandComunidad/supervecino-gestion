-- Hardening de SÚPERVECINO GESTIÓN: caja, ventas, RLS e índices.
-- Ejecutado en el proyecto Supabase mwpnagwjeqyibwmvcvel.

-- Los usuarios no pueden elevar su rol ni reactivarse desde el navegador.
drop policy if exists profiles_update_self on public.profiles;

-- Validación de precios: ningún precio enviado por el cliente debe aceptarse.
create or replace function public.create_pos_sale(
  p_items jsonb, p_payments jsonb, p_discount numeric default 0,
  p_customer_id uuid default null, p_notes text default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
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
begin
  if v_user is null then raise exception 'Debe iniciar sesión'; end if;
  select * into v_profile from public.profiles where id=v_user and active;
  if not found then raise exception 'Usuario sin perfil activo'; end if;
  p_discount := coalesce(p_discount,0);
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then raise exception 'La venta debe contener productos'; end if;
  if jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments)=0 then raise exception 'Debe indicar medios de pago'; end if;
  if p_discount < 0 then raise exception 'Descuento inválido'; end if;
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if v_item ? 'unit_price' then raise exception 'No se permite enviar precios desde el punto de venta'; end if;
  end loop;
  for v_item in
    select jsonb_build_object('product_id', product_id, 'quantity', sum(quantity))
    from (
      select (value->>'product_id')::uuid as product_id, (value->>'quantity')::numeric as quantity
      from jsonb_array_elements(p_items)
    ) items group by product_id
  loop
    v_qty := (v_item->>'quantity')::numeric;
    if v_qty <= 0 then raise exception 'Cantidad inválida'; end if;
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid and active for update;
    if not found then raise exception 'Producto inexistente o inactivo'; end if;
    if v_product.manages_stock and v_product.stock < v_qty then raise exception 'Stock insuficiente para % (disponible: %)',v_product.name,v_product.stock; end if;
    v_subtotal := v_subtotal + round(v_qty*v_product.sale_price,2);
  end loop;
  if p_discount > v_subtotal then raise exception 'El descuento supera el subtotal'; end if;
  v_total := round(v_subtotal - p_discount,2);
  if v_total <= 0 then raise exception 'El total debe ser mayor que cero'; end if;
  select id into v_session from public.cash_sessions where closed_at is null for update;
  if v_session is null then raise exception 'Debe abrir una caja antes de vender'; end if;
  for v_payment in select value from jsonb_array_elements(p_payments)
  loop
    v_method := v_payment->>'method';
    if v_method not in ('cash','debit','credit','transfer','wallet','other') then raise exception 'Medio de pago inválido'; end if;
    if coalesce((v_payment->>'amount')::numeric,0) <= 0 then raise exception 'Importe de pago inválido'; end if;
    v_paid := v_paid + (v_payment->>'amount')::numeric;
  end loop;
  if round(v_paid,2) <> v_total then raise exception 'Los pagos deben cubrir exactamente el total'; end if;
  insert into public.sales(customer_id,cashier_id,subtotal,discount,total,notes)
  values(p_customer_id,v_user,v_subtotal,p_discount,v_total,p_notes)
  returning id,sale_number into v_sale_id,v_sale_number;
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid for update;
    v_qty := (v_item->>'quantity')::numeric;
    v_line := round(v_qty*v_product.sale_price,2);
    insert into public.sale_items(sale_id,product_id,product_name,barcode,quantity,unit,unit_price,line_total)
    values(v_sale_id,v_product.id,v_product.name,v_product.barcode,v_qty,v_product.unit,v_product.sale_price,v_line);
    if v_product.manages_stock then
      update public.products set stock=stock-v_qty,updated_at=now() where id=v_product.id;
      insert into public.stock_movements(product_id,movement_type,quantity_delta,reference_id,created_by)
      values(v_product.id,'sale',-v_qty,v_sale_id,v_user);
    end if;
  end loop;
  for v_payment in select value from jsonb_array_elements(p_payments)
  loop
    insert into public.payments(sale_id,method,amount,reference)
    values(v_sale_id,v_payment->>'method',(v_payment->>'amount')::numeric,v_payment->>'reference');
    if v_payment->>'method'='cash' then
      insert into public.cash_movements(session_id,movement_type,amount,description,created_by)
      values(v_session,'sale',(v_payment->>'amount')::numeric,'Venta #'||v_sale_number,v_user);
    end if;
  end loop;
  return jsonb_build_object('sale_id',v_sale_id,'sale_number',v_sale_number,'subtotal',v_subtotal,'discount',p_discount,'total',v_total,'paid',v_paid);
end;
$$;
revoke all on function public.create_pos_sale(jsonb,jsonb,numeric,uuid,text) from public, anon;
grant execute on function public.create_pos_sale(jsonb,jsonb,numeric,uuid,text) to authenticated;

-- Caja: una sola sesión abierta a la vez.
create unique index if not exists cash_sessions_one_open_idx on public.cash_sessions ((true)) where closed_at is null;
create or replace function public.open_cash_session(p_opening_amount numeric default 0)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_id uuid;
begin
 if v_user is null or not exists(select 1 from public.profiles where id=v_user and active) then raise exception 'Usuario sin perfil activo'; end if;
 if p_opening_amount < 0 then raise exception 'El monto inicial no puede ser negativo'; end if;
 insert into public.cash_sessions(opened_by,opening_amount) values(v_user,p_opening_amount) returning id into v_id;
 return v_id;
exception when unique_violation then raise exception 'Ya existe una caja abierta';
end; $$;
create or replace function public.close_cash_session(p_closing_amount numeric, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_session public.cash_sessions%rowtype; v_expected numeric(14,2);
begin
 if v_user is null or not exists(select 1 from public.profiles where id=v_user and active) then raise exception 'Usuario sin perfil activo'; end if;
 if p_closing_amount < 0 then raise exception 'El cierre no puede ser negativo'; end if;
 select * into v_session from public.cash_sessions where closed_at is null for update;
 if not found then raise exception 'No hay una caja abierta'; end if;
 if not exists(select 1 from public.profiles where id=v_user and role in ('owner','manager')) and v_session.opened_by <> v_user then raise exception 'Solo quien abrió la caja o un encargado puede cerrarla'; end if;
 select v_session.opening_amount + coalesce(sum(case when movement_type in ('in','sale') then amount else -amount end),0)
 into v_expected from public.cash_movements where session_id=v_session.id;
 update public.cash_sessions set closed_by=v_user,closed_at=now(),closing_amount=p_closing_amount,expected_amount=v_expected,notes=p_notes where id=v_session.id;
 return jsonb_build_object('session_id',v_session.id,'expected_amount',v_expected,'closing_amount',p_closing_amount,'difference',p_closing_amount-v_expected);
end; $$;
revoke all on function public.open_cash_session(numeric) from public, anon;
revoke all on function public.close_cash_session(numeric,text) from public, anon;
grant execute on function public.open_cash_session(numeric) to authenticated;
grant execute on function public.close_cash_session(numeric,text) to authenticated;

-- Solo lectura directa en movimientos/ventas; escrituras por RPC transaccionales.
drop policy if exists sales_auth_access on public.sales;
create policy sales_read_active on public.sales for select to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active));
drop policy if exists sale_items_auth_access on public.sale_items;
create policy sale_items_read_active on public.sale_items for select to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active));
drop policy if exists payments_auth_access on public.payments;
create policy payments_read_active on public.payments for select to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active));
drop policy if exists stock_movements_auth_access on public.stock_movements;
create policy stock_movements_read_active on public.stock_movements for select to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active));
drop policy if exists cash_movements_auth_access on public.cash_movements;
create policy cash_movements_read_active on public.cash_movements for select to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active));
drop policy if exists cash_sessions_auth_access on public.cash_sessions;
create policy cash_sessions_read_active on public.cash_sessions for select to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active));

-- Catálogo editable solo por propietario/encargado.
drop policy if exists products_auth_access on public.products;
create policy products_read_active on public.products for select to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active));
create policy products_insert_managers on public.products for insert to authenticated with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('owner','manager')));
create policy products_update_managers on public.products for update to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('owner','manager'))) with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('owner','manager')));
create policy products_delete_managers on public.products for delete to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('owner','manager')));
drop policy if exists categories_auth_access on public.categories;
create policy categories_read_active on public.categories for select to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active));
create policy categories_insert_managers on public.categories for insert to authenticated with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('owner','manager')));
create policy categories_update_managers on public.categories for update to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('owner','manager'))) with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('owner','manager')));
create policy categories_delete_managers on public.categories for delete to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('owner','manager')));

-- Encapsular las rutinas privilegiadas en un esquema no expuesto por PostgREST.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
alter function public.create_pos_sale(jsonb,jsonb,numeric,uuid,text) set schema private;
alter function public.open_cash_session(numeric) set schema private;
alter function public.close_cash_session(numeric,text) set schema private;
grant execute on function private.create_pos_sale(jsonb,jsonb,numeric,uuid,text) to authenticated;
grant execute on function private.open_cash_session(numeric) to authenticated;
grant execute on function private.close_cash_session(numeric,text) to authenticated;
create or replace function public.create_pos_sale(p_items jsonb,p_payments jsonb,p_discount numeric default 0,p_customer_id uuid default null,p_notes text default null)
returns jsonb language sql security invoker set search_path=''
as $$ select private.create_pos_sale(p_items,p_payments,p_discount,p_customer_id,p_notes); $$;
create or replace function public.open_cash_session(p_opening_amount numeric default 0)
returns uuid language sql security invoker set search_path=''
as $$ select private.open_cash_session(p_opening_amount); $$;
create or replace function public.close_cash_session(p_closing_amount numeric,p_notes text default null)
returns jsonb language sql security invoker set search_path=''
as $$ select private.close_cash_session(p_closing_amount,p_notes); $$;
revoke all on function public.create_pos_sale(jsonb,jsonb,numeric,uuid,text) from public,anon;
revoke all on function public.open_cash_session(numeric) from public,anon;
revoke all on function public.close_cash_session(numeric,text) from public,anon;
grant execute on function public.create_pos_sale(jsonb,jsonb,numeric,uuid,text) to authenticated;
grant execute on function public.open_cash_session(numeric) to authenticated;
grant execute on function public.close_cash_session(numeric,text) to authenticated;
notify pgrst, 'reload schema';
