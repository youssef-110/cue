-- Tideline team storage. Run once in the Supabase SQL editor.
-- Every board, item, comment, etc. is one JSON document row; the app syncs
-- rows in realtime. Access is limited to emails listed in team_members, so a
-- stranger who signs up still sees nothing. Add your team at the bottom.
-- Recommended too: Authentication → Sign In / Providers → turn OFF
-- "Allow new users to sign up" and invite teammates by email instead.

create table if not exists public.team_members (
  email text primary key
);
alter table public.team_members enable row level security;
-- members can see who else is on the team; only the SQL editor can change it
drop policy if exists "members read" on public.team_members;

create or replace function public.is_team_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_members where lower(email) = lower(auth.jwt() ->> 'email'))
$$;

create policy "members read" on public.team_members for select to authenticated using (public.is_team_member());

create table if not exists public.docs (
  id          text primary key,
  kind        text not null check (kind in ('workspace','board','item','update','activity','notification','user')),
  data        jsonb not null,
  deleted     boolean not null default false,
  updated_at  timestamptz not null default now()
);

create index if not exists docs_kind_idx on public.docs (kind) where not deleted;

alter table public.docs enable row level security;

drop policy if exists "team read" on public.docs;
drop policy if exists "team insert" on public.docs;
drop policy if exists "team update" on public.docs;

-- Boards, items and workspaces are shared team work: any member may edit them.
-- Personal rows are owner-bound:
--   user          your own profile (placeholder teammates with 'u_' ids stay editable)
--   update        comments are written as yourself; others may only like them
--   activity      written as yourself, never edited afterwards
--   notification  sent as yourself; only the recipient (or sender) can mark it read
create policy "team read" on public.docs for select to authenticated using (public.is_team_member());

create policy "team insert" on public.docs for insert to authenticated with check (
  public.is_team_member() and case kind
    when 'user'         then id = auth.uid()::text or id like 'u\_%'
    when 'update'       then data ->> 'authorId' = auth.uid()::text
    when 'activity'     then data ->> 'actorId'  = auth.uid()::text
    when 'notification' then data ->> 'actorId'  = auth.uid()::text
    else true
  end
);

create policy "team update" on public.docs for update to authenticated
  using (
    public.is_team_member() and case kind
      when 'user'         then id = auth.uid()::text or id like 'u\_%'
      when 'activity'     then false
      when 'notification' then auth.uid()::text in (data ->> 'userId', data ->> 'actorId')
      else true
    end
  )
  with check (public.is_team_member());
-- No delete policy: the app soft-deletes (deleted = true) so nothing is lost by accident.

-- Ownership fields can never be rewritten, and a row can't change its kind.
create or replace function public.docs_guard() returns trigger
language plpgsql as $$
begin
  if new.id is distinct from old.id or new.kind is distinct from old.kind then
    raise exception 'docs: id and kind are immutable';
  end if;
  if new.data ->> 'authorId'  is distinct from old.data ->> 'authorId'
  or new.data ->> 'actorId'   is distinct from old.data ->> 'actorId'
  or new.data ->> 'userId'    is distinct from old.data ->> 'userId'
  or new.data ->> 'createdBy' is distinct from old.data ->> 'createdBy' then
    raise exception 'docs: ownership fields are immutable';
  end if;
  -- other people may only change the likes on a comment
  if new.kind = 'update' and old.data ->> 'authorId' <> auth.uid()::text
     and ((new.data - 'likes') is distinct from (old.data - 'likes') or new.deleted is distinct from old.deleted) then
    raise exception 'docs: only the author can edit a comment';
  end if;
  return new;
end $$;

drop trigger if exists docs_guard on public.docs;
create trigger docs_guard before update on public.docs for each row execute function public.docs_guard();

-- Realtime updates for every connected teammate.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'docs'
  ) then
    alter publication supabase_realtime add table public.docs;
  end if;
end $$;

-- Your team. Add one line per person, then re-run just this statement.
insert into public.team_members (email) values
  ('you@example.com')
on conflict do nothing;
