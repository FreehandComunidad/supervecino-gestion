create table if not exists public.product_price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  old_cost_price numeric not null default 0,
  new_cost_price numeric not null default 0,
  old_sale_price numeric not null default 0,
  new_sale_price numeric not null default 0,
  changed_by uuid references public.profiles(id),
  changed_at timestamptz not null default now()
);
create index if not exists product_price_history_product_changed_idx
  on public.product_price_history(product_id, changed_at desc);
alter table public.product_price_history enable row level security;
drop policy if exists product_price_history_read_active on public.product_price_history;
create policy product_price_history_read_active on public.product_price_history
  for select to authenticated
  using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active));
create or replace function public.audit_product_price_change()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  if old.cost_price is distinct from new.cost_price or old.sale_price is distinct from new.sale_price then
    insert into public.product_price_history(product_id,old_cost_price,new_cost_price,old_sale_price,new_sale_price,changed_by)
    values(old.id,coalesce(old.cost_price,0),coalesce(new.cost_price,0),coalesce(old.sale_price,0),coalesce(new.sale_price,0),auth.uid());
  end if;
  return new;
end;
$$;
drop trigger if exists products_price_history_trigger on public.products;
create trigger products_price_history_trigger
after update of cost_price,sale_price on public.products
for each row execute function public.audit_product_price_change();
notify pgrst, 'reload schema';
