create or replace function public.create_purchase_with_items(
 p_supplier_id uuid,
 p_invoice_number text,
 p_purchase_date date,
 p_due_date date,
 p_notes text,
 p_items jsonb
) returns uuid
language plpgsql
security invoker
set search_path=public
as $$
declare
 v_purchase_id uuid;
 v_subtotal numeric(14,2);
 v_tax_total numeric(14,2);
 v_item_count integer;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and active and role in ('owner','manager')) then
  raise exception 'No tenés permisos para registrar compras.';
 end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then
  raise exception 'La compra debe incluir al menos un producto.';
 end if;
 select count(*),
        coalesce(sum((x.quantity::numeric)*(x.unit_cost_net::numeric)),0),
        coalesce(sum((x.quantity::numeric)*(x.unit_cost_net::numeric)*(x.vat_rate::numeric)/100),0)
 into v_item_count,v_subtotal,v_tax_total
 from jsonb_to_recordset(p_items) as x(product_id uuid,quantity numeric,unit_cost_net numeric,vat_rate numeric);
 if v_item_count=0 or exists(
   select 1 from jsonb_to_recordset(p_items) as x(product_id uuid,quantity numeric,unit_cost_net numeric,vat_rate numeric)
   where x.product_id is null or x.quantity is null or x.quantity<=0 or x.unit_cost_net is null or x.unit_cost_net<0 or x.vat_rate is null or x.vat_rate<0 or x.vat_rate>100
 ) then raise exception 'Hay artículos con cantidades, costos o IVA inválidos.'; end if;
 insert into public.purchases(supplier_id,invoice_number,purchase_date,due_date,notes,status,subtotal,tax_total,total,created_by)
 values(p_supplier_id,nullif(trim(p_invoice_number),''),coalesce(p_purchase_date,current_date),p_due_date,nullif(trim(p_notes),''),'draft',v_subtotal,v_tax_total,v_subtotal+v_tax_total,auth.uid())
 returning id into v_purchase_id;
 insert into public.purchase_items(purchase_id,product_id,quantity,unit_cost_net,vat_rate,line_total)
 select v_purchase_id,x.product_id,x.quantity,x.unit_cost_net,x.vat_rate,
        round(x.quantity*x.unit_cost_net*(1+x.vat_rate/100),2)
 from jsonb_to_recordset(p_items) as x(product_id uuid,quantity numeric,unit_cost_net numeric,vat_rate numeric);
 return v_purchase_id;
end;
$$;
revoke all on function public.create_purchase_with_items(uuid,text,date,date,text,jsonb) from public;
revoke all on function public.create_purchase_with_items(uuid,text,date,date,text,jsonb) from anon;
grant execute on function public.create_purchase_with_items(uuid,text,date,date,text,jsonb) to authenticated;
