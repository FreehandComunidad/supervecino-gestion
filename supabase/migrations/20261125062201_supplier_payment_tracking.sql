create table if not exists public.supplier_payments (
 id uuid primary key default gen_random_uuid(),
 purchase_id uuid not null references public.purchases(id) on delete restrict,
 payment_date date not null default current_date,
 amount numeric(14,2) not null check (amount > 0),
 payment_method text not null default 'transfer' check (payment_method in ('cash','debit','credit','transfer','wallet','other')),
 reference text,
 notes text,
 created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now()
);
create index if not exists supplier_payments_purchase_idx on public.supplier_payments(purchase_id,payment_date desc);
create index if not exists supplier_payments_date_idx on public.supplier_payments(payment_date desc);
alter table public.supplier_payments enable row level security;
drop policy if exists supplier_payments_read on public.supplier_payments;
create policy supplier_payments_read on public.supplier_payments for select to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active));
drop policy if exists supplier_payments_manage on public.supplier_payments;
create policy supplier_payments_manage on public.supplier_payments for all to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('owner','manager')))
with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('owner','manager')));
grant select,insert,update,delete on public.supplier_payments to authenticated;
revoke all on public.supplier_payments from anon;

create or replace function public.register_supplier_payment(
 p_purchase_id uuid,p_amount numeric,p_payment_date date,p_payment_method text,p_reference text default null,p_notes text default null
) returns uuid language plpgsql security invoker set search_path=public as $$
declare v_purchase public.purchases%rowtype; v_paid numeric; v_id uuid; v_role text;
begin
 select role into v_role from public.profiles where id=(select auth.uid()) and active;
 if v_role not in ('owner','manager') then raise exception 'No tenés permisos para registrar pagos a proveedores.'; end if;
 if p_amount is null or p_amount<=0 then raise exception 'El importe debe ser mayor que cero.'; end if;
 select * into v_purchase from public.purchases where id=p_purchase_id for update;
 if not found then raise exception 'No se encontró la factura.'; end if;
 if v_purchase.status<>'received' then raise exception 'Primero tenés que recibir la factura.'; end if;
 select coalesce(sum(amount),0) into v_paid from public.supplier_payments where purchase_id=p_purchase_id;
 if p_amount>v_purchase.total-v_paid+0.005 then raise exception 'El pago supera el saldo pendiente.'; end if;
 insert into public.supplier_payments(purchase_id,payment_date,amount,payment_method,reference,notes,created_by)
 values(p_purchase_id,coalesce(p_payment_date,current_date),p_amount,coalesce(p_payment_method,'transfer'),nullif(trim(p_reference),''),nullif(trim(p_notes),''),(select auth.uid()))
 returning id into v_id;
 return v_id;
end; $$;
revoke all on function public.register_supplier_payment(uuid,numeric,date,text,text,text) from public;
revoke all on function public.register_supplier_payment(uuid,numeric,date,text,text,text) from anon;
grant execute on function public.register_supplier_payment(uuid,numeric,date,text,text,text) to authenticated;
