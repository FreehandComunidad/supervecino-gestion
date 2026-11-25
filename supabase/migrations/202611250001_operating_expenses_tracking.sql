create table if not exists public.operating_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  category text not null,
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  payment_method text not null default 'cash' check (payment_method in ('cash','debit','credit','transfer','wallet','other')),
  reference text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists operating_expenses_expense_date_idx on public.operating_expenses(expense_date desc);
create index if not exists operating_expenses_category_idx on public.operating_expenses(category);

alter table public.operating_expenses enable row level security;

drop policy if exists operating_expenses_read_active on public.operating_expenses;
create policy operating_expenses_read_active on public.operating_expenses
for select to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active));

drop policy if exists operating_expenses_manage on public.operating_expenses;
create policy operating_expenses_manage on public.operating_expenses
for all to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active and p.role in ('owner','manager')))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active and p.role in ('owner','manager')));

grant select, insert, update, delete on public.operating_expenses to authenticated;
revoke all on public.operating_expenses from anon;