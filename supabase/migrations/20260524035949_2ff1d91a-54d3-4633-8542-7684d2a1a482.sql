
create table public.resumes (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  data jsonb not null,
  is_primary boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index resumes_user_id_idx on public.resumes(user_id);

alter table public.resumes enable row level security;

create policy "owners read own resumes"
  on public.resumes for select
  to authenticated
  using (auth.uid() = user_id);

create policy "owners insert own resumes"
  on public.resumes for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "owners update own resumes"
  on public.resumes for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "owners delete own resumes"
  on public.resumes for delete
  to authenticated
  using (auth.uid() = user_id);
