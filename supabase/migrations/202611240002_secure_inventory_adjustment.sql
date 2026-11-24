create or replace function public.adjust_product_stock(
 p_product_id uuid,
 p_quantity_delta numeric,
 p_notes text default null
) returns numeric
language plpgsql security definer set search_path=public
as $$
declare v_stock numeric; v_role text;
begin
 select role into v_role from public.profiles
 where id=auth.uid() and active=true;
 if v_role not in ('owner','manager') then
  raise exception 'No tenés permisos para ajustar stock.';
 end if;
 if p_quantity_delta=0 then raise exception 'El ajuste no puede ser cero.'; end if;
 select stock into v_stock from public.products where id=p_product_id and active=true for update;
 if not found then raise exception 'Producto inexistente o inactivo.'; end if;
 if v_stock+p_quantity_delta<0 then raise exception 'El ajuste dejaría el stock negativo.'; end if;
 update public.products set stock=stock+p_quantity_delta, updated_at=now() where id=p_product_id;
 insert into public.stock_movements(product_id,movement_type,quantity_delta,notes,created_by)
 values(p_product_id,case when p_quantity_delta>0 then 'adjustment_in' else 'adjustment_out' end,p_quantity_delta,p_notes,auth.uid());
 return v_stock+p_quantity_delta;
end;
$$;
grant execute on function public.adjust_product_stock(uuid,numeric,text) to authenticated;
drop policy if exists stock_movements_read_active on public.stock_movements;
create policy stock_movements_read_active on public.stock_movements for select to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active));
notify pgrst, 'reload schema';