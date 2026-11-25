begin;

select plan(22);

insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
values
 ('00000000-0000-4000-8000-000000000111','authenticated','authenticated','ci-purchase-owner@supervecino.local','',now(),now(),now()),
 ('00000000-0000-4000-8000-000000000112','authenticated','authenticated','ci-purchase-manager@supervecino.local','',now(),now(),now()),
 ('00000000-0000-4000-8000-000000000113','authenticated','authenticated','ci-purchase-cashier@supervecino.local','',now(),now(),now())
on conflict(id) do nothing;

insert into public.profiles(id,full_name,role,active)
values
 ('00000000-0000-4000-8000-000000000111','CI Purchase Owner','owner',true),
 ('00000000-0000-4000-8000-000000000112','CI Purchase Manager','manager',true),
 ('00000000-0000-4000-8000-000000000113','CI Purchase Cashier','cashier',true)
on conflict(id) do update set role=excluded.role,active=true;

insert into public.suppliers(id,name,active)
values ('00000000-0000-4000-8000-000000000111','CI Purchase Supplier',true)
on conflict(id) do nothing;

insert into public.products(id,name,sale_price,cost_price,stock,min_stock,manages_stock,active)
values ('00000000-0000-4000-8000-000000000111','CI Purchase Product',100,40,5,1,true,true)
on conflict(id) do nothing;

insert into public.purchases(id,supplier_id,invoice_number,purchase_date,status,subtotal,tax_total,total,created_by)
values ('00000000-0000-4000-8000-000000000112','00000000-0000-4000-8000-000000000111','CI-PAID-FIXTURE',current_date,'received',40,8.4,48.4,'00000000-0000-4000-8000-000000000112')
on conflict(id) do nothing;

insert into public.operating_expenses(expense_date,category,description,amount,payment_method,created_by)
values(current_date,'Prueba CI','CI synthetic expense',25,'cash','00000000-0000-4000-8000-000000000112');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000113',true);
set local role authenticated;
select throws_ok(
 'select public.create_purchase_with_items(''00000000-0000-4000-8000-000000000111'',''CI-CASHIER'',current_date,null,null,''[{"product_id":"00000000-0000-4000-8000-000000000111","quantity":1,"unit_cost_net":50,"vat_rate":21}]''::jsonb)',
 'P0001','No tenés permisos para registrar compras.','cashier cannot create a purchase through direct RPC'
);
select throws_ok(
 'select public.receive_purchase(''00000000-0000-4000-8000-000000000112'')',
 'P0001','No tenés permisos para recibir compras.','cashier cannot receive a purchase through direct RPC'
);
select throws_ok(
 'select public.register_supplier_payment(''00000000-0000-4000-8000-000000000112'',1,current_date,''transfer'',null,null)',
 'P0001','No tenés permisos para registrar pagos a proveedores.','cashier cannot register supplier payments through direct RPC'
);
select throws_ok(
 'select public.adjust_product_stock(''00000000-0000-4000-8000-000000000111'',1,''CI cashier bypass'')',
 'P0001','No tenés permisos para ajustar stock.','cashier cannot adjust stock through direct RPC'
);
select is((select count(*)::integer from public.purchases),0,'cashier cannot read purchase headers');
select is((select count(*)::integer from public.purchase_items),0,'cashier cannot read purchase lines');
select is((select count(*)::integer from public.supplier_payments),0,'cashier cannot read supplier payments');
select is((select count(*)::integer from public.suppliers),0,'cashier cannot read supplier identities');
select is((select count(*)::integer from public.supplier_products),0,'cashier cannot read supplier costs and lead times');
select is((select count(*)::integer from public.operating_expenses),0,'cashier cannot read operating expenses');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000112',true);
set local role authenticated;
select lives_ok(
 'select public.create_purchase_with_items(''00000000-0000-4000-8000-000000000111'',''CI-MANAGER-001'',current_date,null,''CI manager purchase'',''[{"product_id":"00000000-0000-4000-8000-000000000111","quantity":2,"unit_cost_net":50,"vat_rate":21}]''::jsonb)',
 'manager can create a purchase with multiple line data through RPC'
);
select lives_ok(
 'select public.receive_purchase((select id from public.purchases where invoice_number=''CI-MANAGER-001''))',
 'manager can receive the purchase once'
);
select is((select stock from public.products where id='00000000-0000-4000-8000-000000000111'),7::numeric,'receiving purchase updates stock exactly once');
select is((select cost_price from public.products where id='00000000-0000-4000-8000-000000000111'),50::numeric,'receiving purchase updates the product net cost');
select is((select count(*)::integer from public.supplier_products where supplier_id='00000000-0000-4000-8000-000000000111' and product_id='00000000-0000-4000-8000-000000000111'),1,'receiving purchase updates supplier-product terms');
select lives_ok(
 'select public.register_supplier_payment((select id from public.purchases where invoice_number=''CI-MANAGER-001''),50,current_date,''transfer'',null,''CI partial payment'')',
 'manager can record a partial supplier payment'
);
select lives_ok(
 'select public.register_supplier_payment((select id from public.purchases where invoice_number=''CI-MANAGER-001''),71,current_date,''transfer'',null,''CI final payment'')',
 'manager can settle the remaining supplier balance'
);
select throws_ok(
 'select public.register_supplier_payment((select id from public.purchases where invoice_number=''CI-MANAGER-001''),1,current_date,''transfer'',null,null)',
 'P0001','El pago supera el saldo pendiente.','manager cannot overpay the supplier invoice'
);
select is(
 (select coalesce(sum(amount),0) from public.supplier_payments sp join public.purchases p on p.id=sp.purchase_id where p.invoice_number='CI-MANAGER-001'),
 121::numeric,
 'partial and final payments reconcile to the invoice total'
);
select is((select count(*)::integer from public.purchases),2,'manager can read all purchase headers');
select is((select count(*)::integer from public.operating_expenses),1,'manager can read operating expenses');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000111',true);
set local role authenticated;
select is((select count(*)::integer from public.purchases),2,'owner can read all purchase headers');
select is((select count(*)::integer from public.supplier_payments),2,'owner can audit supplier payments');
select lives_ok('select count(*) from public.get_products_management()','owner can access the protected cost and margin RPC');
reset role;

select * from finish();
rollback;
