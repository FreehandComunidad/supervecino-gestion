begin;

-- Helper central para consultar el rol sin recursión de RLS sobre profiles.
create or replace function private.get_current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.active = true
  limit 1;
$$;

revoke all on function private.get_current_app_role() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.get_current_app_role() to authenticated;

-- Perfiles: cada empleado ve el suyo; encargados y propietario ven todos.
drop policy if exists profiles_read_authenticated on public.profiles;
drop policy if exists profiles_read_self on public.profiles;
create policy profiles_read_scoped
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or private.get_current_app_role() in ('owner', 'manager')
);

-- Catálogo: empleados ven datos operativos, solo responsables administran.
drop policy if exists products_read_active on public.products;
create policy products_read_active
on public.products for select to authenticated
using (private.get_current_app_role() is not null);

drop policy if exists products_insert_managers on public.products;
create policy products_insert_managers
on public.products for insert to authenticated
with check (private.get_current_app_role() in ('owner', 'manager'));

drop policy if exists products_update_managers on public.products;
create policy products_update_managers
on public.products for update to authenticated
using (private.get_current_app_role() in ('owner', 'manager'))
with check (private.get_current_app_role() in ('owner', 'manager'));

drop policy if exists products_delete_managers on public.products;
create policy products_delete_managers
on public.products for delete to authenticated
using (private.get_current_app_role() in ('owner', 'manager'));

drop policy if exists categories_read_active on public.categories;
create policy categories_read_active
on public.categories for select to authenticated
using (private.get_current_app_role() is not null);

drop policy if exists categories_insert_managers on public.categories;
create policy categories_insert_managers
on public.categories for insert to authenticated
with check (private.get_current_app_role() in ('owner', 'manager'));

drop policy if exists categories_update_managers on public.categories;
create policy categories_update_managers
on public.categories for update to authenticated
using (private.get_current_app_role() in ('owner', 'manager'))
with check (private.get_current_app_role() in ('owner', 'manager'));

drop policy if exists categories_delete_managers on public.categories;
create policy categories_delete_managers
on public.categories for delete to authenticated
using (private.get_current_app_role() in ('owner', 'manager'));

-- Ventas: caja y detalle solo del propio cajero; responsables ven todo.
drop policy if exists sales_read_active on public.sales;
create policy sales_read_role_scoped
on public.sales for select to authenticated
using (
  private.get_current_app_role() in ('owner', 'manager')
  or (private.get_current_app_role() = 'cashier' and cashier_id = (select auth.uid()))
);

drop policy if exists sale_items_read_active on public.sale_items;
create policy sale_items_read_role_scoped
on public.sale_items for select to authenticated
using (
  exists (
    select 1 from public.sales s
    where s.id = sale_items.sale_id
      and (
        private.get_current_app_role() in ('owner', 'manager')
        or (private.get_current_app_role() = 'cashier' and s.cashier_id = (select auth.uid()))
      )
  )
);

drop policy if exists payments_read_active on public.payments;
create policy payments_read_role_scoped
on public.payments for select to authenticated
using (
  exists (
    select 1 from public.sales s
    where s.id = payments.sale_id
      and (
        private.get_current_app_role() in ('owner', 'manager')
        or (private.get_current_app_role() = 'cashier' and s.cashier_id = (select auth.uid()))
      )
  )
);

-- Una caja abierta es visible para los cajeros que trabajan en ella.
-- El historial cerrado queda limitado al responsable y a los encargados.
drop policy if exists cash_sessions_read_active on public.cash_sessions;
create policy cash_sessions_read_role_scoped
on public.cash_sessions for select to authenticated
using (
  private.get_current_app_role() in ('owner', 'manager')
  or (
    private.get_current_app_role() = 'cashier'
    and (
      closed_at is null
      or opened_by = (select auth.uid())
      or closed_by = (select auth.uid())
    )
  )
);

drop policy if exists cash_movements_read_active on public.cash_movements;
create policy cash_movements_read_role_scoped
on public.cash_movements for select to authenticated
using (
  private.get_current_app_role() in ('owner', 'manager')
  or (
    private.get_current_app_role() = 'cashier'
    and (
      created_by = (select auth.uid())
      or exists (
        select 1 from public.cash_sessions s
        where s.id = cash_movements.session_id
          and s.closed_at is null
      )
    )
  )
);

-- Stock y costos operativos: solo propietario y encargados.
drop policy if exists stock_movements_read_active on public.stock_movements;
create policy stock_movements_read_managers
on public.stock_movements for select to authenticated
using (private.get_current_app_role() in ('owner', 'manager'));

drop policy if exists product_price_history_read_active on public.product_price_history;
create policy product_price_history_read_managers
on public.product_price_history for select to authenticated
using (private.get_current_app_role() in ('owner', 'manager'));

drop policy if exists purchases_read on public.purchases;
create policy purchases_read_managers
on public.purchases for select to authenticated
using (private.get_current_app_role() in ('owner', 'manager'));

drop policy if exists purchase_items_read on public.purchase_items;
create policy purchase_items_read_managers
on public.purchase_items for select to authenticated
using (private.get_current_app_role() in ('owner', 'manager'));

drop policy if exists supplier_payments_read on public.supplier_payments;
create policy supplier_payments_read_managers
on public.supplier_payments for select to authenticated
using (private.get_current_app_role() in ('owner', 'manager'));

drop policy if exists suppliers_read_active on public.suppliers;
create policy suppliers_read_managers
on public.suppliers for select to authenticated
using (private.get_current_app_role() in ('owner', 'manager'));

drop policy if exists supplier_products_read on public.supplier_products;
create policy supplier_products_read_managers
on public.supplier_products for select to authenticated
using (private.get_current_app_role() in ('owner', 'manager'));

drop policy if exists operating_expenses_read_active on public.operating_expenses;
create policy operating_expenses_read_managers
on public.operating_expenses for select to authenticated
using (private.get_current_app_role() in ('owner', 'manager'));

-- Ocultar costo e IVA internos en las consultas directas del personal.
-- Los responsables los obtienen mediante una RPC con autorización explícita.
revoke select on table public.products from public, anon, authenticated;
grant select (
  id, barcode, sku, name, category_id, unit, sale_price, stock, min_stock,
  manages_stock, active, created_at, updated_at, subcategory_id, brand, presentation
) on table public.products to authenticated;

create or replace function public.get_products_management()
returns setof public.products
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     or private.get_current_app_role() not in ('owner', 'manager') then
    raise exception 'No tenés permisos para consultar costos y rentabilidad.';
  end if;

  return query
  select p.*
  from public.products p
  where p.active = true
  order by p.name;
end;
$$;

revoke all on function public.get_products_management() from public, anon;
grant execute on function public.get_products_management() to authenticated;

notify pgrst, 'reload schema';
commit;
