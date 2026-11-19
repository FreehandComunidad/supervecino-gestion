alter table public.categories
  add column if not exists parent_id uuid references public.categories(id) on delete restrict;
alter table public.products
  add column if not exists subcategory_id uuid references public.categories(id) on delete set null;
create index if not exists categories_parent_id_idx on public.categories(parent_id);
create index if not exists products_subcategory_id_idx on public.products(subcategory_id);
drop policy if exists profiles_read_active_staff on public.profiles;
create policy profiles_read_active_staff on public.profiles
  for select to authenticated
  using (exists(select 1 from public.profiles me where me.id=(select auth.uid()) and me.active));
notify pgrst, 'reload schema';
