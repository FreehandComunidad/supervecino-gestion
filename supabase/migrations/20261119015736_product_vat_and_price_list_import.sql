alter table public.products
 add column if not exists vat_rate numeric(5,2) not null default 21 check (vat_rate >= 0 and vat_rate <= 100);
comment on column public.products.cost_price is 'Costo neto sin IVA';
comment on column public.products.vat_rate is 'Alícuota de IVA aplicable al producto';
comment on column public.products.sale_price is 'Precio final de venta con IVA incluido';
alter table public.product_price_history
 add column if not exists old_vat_rate numeric(5,2),
 add column if not exists new_vat_rate numeric(5,2);
create or replace function public.audit_product_price_change()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
 if old.cost_price is distinct from new.cost_price or old.sale_price is distinct from new.sale_price or old.vat_rate is distinct from new.vat_rate then
  insert into public.product_price_history(product_id,old_cost_price,new_cost_price,old_sale_price,new_sale_price,old_vat_rate,new_vat_rate,changed_by)
  values(old.id,coalesce(old.cost_price,0),coalesce(new.cost_price,0),coalesce(old.sale_price,0),coalesce(new.sale_price,0),old.vat_rate,new.vat_rate,auth.uid());
 end if;
 return new;
end; $$;
drop trigger if exists products_price_history_trigger on public.products;
create trigger products_price_history_trigger after update of cost_price,sale_price,vat_rate on public.products
for each row execute function public.audit_product_price_change();
notify pgrst, 'reload schema';
