-- Supplier catalog, purchase orders and supplier price comparison
create table if not exists public.suppliers (id uuid primary key default gen_random_uuid(),name text not null,tax_id text,phone text,email text,notes text,active boolean not null default true,created_at timestamptz not null default now());
create table if not exists public.supplier_products (id uuid primary key default gen_random_uuid(),supplier_id uuid not null references public.suppliers(id) on delete cascade,product_id uuid not null references public.products(id) on delete cascade,supplier_sku text,last_cost_net numeric(14,2) not null default 0,vat_rate numeric(5,2) not null default 21,lead_time_days integer not null default 0,minimum_order_qty numeric(14,3) not null default 1,updated_at timestamptz not null default now(),unique(supplier_id,product_id));
create table if not exists public.purchases (id uuid primary key default gen_random_uuid(),supplier_id uuid not null references public.suppliers(id),invoice_number text,purchase_date date not null default current_date,due_date date,status text not null default 'draft' check(status in ('draft','received','cancelled')),subtotal numeric(14,2) not null default 0,tax_total numeric(14,2) not null default 0,total numeric(14,2) not null default 0,notes text,created_by uuid references public.profiles(id),received_at timestamptz,created_at timestamptz not null default now());
create table if not exists public.purchase_items (id uuid primary key default gen_random_uuid(),purchase_id uuid not null references public.purchases(id) on delete cascade,product_id uuid not null references public.products(id),quantity numeric(14,3) not null check(quantity>0),unit_cost_net numeric(14,2) not null check(unit_cost_net>=0),vat_rate numeric(5,2) not null default 21,line_total numeric(14,2) not null default 0);
create index if not exists supplier_products_product_idx on public.supplier_products(product_id);
create index if not exists purchases_date_idx on public.purchases(purchase_date desc);
create index if not exists purchase_items_product_idx on public.purchase_items(product_id);
alter table public.suppliers enable row level security; alter table public.supplier_products enable row level security; alter table public.purchases enable row level security; alter table public.purchase_items enable row level security;
create policy suppliers_read_active on public.suppliers for select to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active));
create policy suppliers_manage on public.suppliers for all to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('owner','manager'))) with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('owner','manager')));
create policy supplier_products_read on public.supplier_products for select to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active));
create policy supplier_products_manage on public.supplier_products for all to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('owner','manager'))) with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('owner','manager')));
create policy purchases_read on public.purchases for select to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active));
create policy purchases_manage on public.purchases for all to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('owner','manager'))) with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('owner','manager')));
create policy purchase_items_read on public.purchase_items for select to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active));
create policy purchase_items_manage on public.purchase_items for all to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('owner','manager'))) with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('owner','manager')));
create policy stock_movements_insert_managers on public.stock_movements for insert to authenticated with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('owner','manager')));
create or replace function public.receive_purchase(p_purchase_id uuid) returns void language plpgsql security invoker set search_path=public as $$
declare v_item record; v_status text;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and active and role in ('owner','manager')) then raise exception 'No tenés permisos para recibir compras.'; end if;
 select status into v_status from public.purchases where id=p_purchase_id for update;
 if not found then raise exception 'Compra inexistente.'; end if;
 if v_status<>'draft' then raise exception 'La compra ya fue procesada.'; end if;
 for v_item in select * from public.purchase_items where purchase_id=p_purchase_id loop
  update public.products set stock=stock+v_item.quantity,cost_price=v_item.unit_cost_net,vat_rate=v_item.vat_rate,updated_at=now() where id=v_item.product_id;
  insert into public.stock_movements(product_id,movement_type,quantity_delta,reference_id,notes,created_by) values(v_item.product_id,'purchase_in',v_item.quantity,p_purchase_id,'Ingreso por compra',auth.uid());
  insert into public.supplier_products(supplier_id,product_id,last_cost_net,vat_rate,updated_at) select p.supplier_id,v_item.product_id,v_item.unit_cost_net,v_item.vat_rate,now() from public.purchases p where p.id=p_purchase_id on conflict(supplier_id,product_id) do update set last_cost_net=excluded.last_cost_net,vat_rate=excluded.vat_rate,updated_at=now();
 end loop;
 update public.purchases set status='received',received_at=now() where id=p_purchase_id;
end; $$;
grant execute on function public.receive_purchase(uuid) to authenticated;