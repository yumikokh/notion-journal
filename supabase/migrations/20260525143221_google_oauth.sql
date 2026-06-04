-- Single-row store for the Google OAuth refresh token used by the
-- personal-use Calendar integration. Edge Functions read/write via
-- service_role and bypass RLS; anon must never touch this table.

create table if not exists public.google_oauth (
  id smallint primary key default 1,
  refresh_token text not null,
  scope text not null,
  connected_at timestamptz not null default now(),
  constraint google_oauth_singleton check (id = 1)
);

alter table public.google_oauth enable row level security;

-- No policies are defined; anon/authenticated have no access. Only
-- service_role (used by Edge Functions) bypasses RLS.
revoke all on public.google_oauth from anon, authenticated;
