-- Emails entered on the website download page (Gmail, Yahoo or Hotmail only).
-- The public can only ADD an email. Nobody can read the list from the website.
-- Read it in the Supabase dashboard: Table Editor -> download_leads.
create table if not exists public.download_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamptz not null default now(),
  source text not null default 'download-page',
  constraint download_leads_email_ok check (
    length(email) <= 120
    and email = lower(email)
    and email ~ '^[a-z0-9._%+-]+@(gmail\.com|yahoo\.com|hotmail\.com)$'
  )
);
create unique index if not exists download_leads_email_key on public.download_leads (email);
alter table public.download_leads enable row level security;
revoke all on public.download_leads from anon, authenticated;
grant insert on public.download_leads to anon;
drop policy if exists "anyone can add an email" on public.download_leads;
create policy "anyone can add an email" on public.download_leads
  for insert to anon with check (source = 'download-page');
