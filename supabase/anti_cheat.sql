-- MATH RACING STRICT ANTI-CHEAT MIGRATION
-- Run AFTER supabase/schema.sql in Supabase SQL Editor.
create extension if not exists pgcrypto;

alter table public.race_players
  add column if not exists session_token_hash text,
  add column if not exists violation_count integer not null default 0,
  add column if not exists violation_reason text,
  add column if not exists violation_at timestamptz,
  add column if not exists disqualified boolean not null default false,
  add column if not exists disqualification_reason text;

create table if not exists public.race_violations (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.race_players(id) on delete cascade,
  event_id uuid not null references public.racing_events(id) on delete cascade,
  client_event_id uuid not null,
  violation_type text not null check (violation_type in ('visibility_hidden','page_hidden','fullscreen_exit','focus_blur')),
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  unique(player_id, client_event_id)
);

alter table public.race_violations enable row level security;
drop policy if exists "teachers view race violations" on public.race_violations;
create policy "teachers view race violations" on public.race_violations
  for select to authenticated
  using (exists (
    select 1 from public.racing_events e
    where e.id = race_violations.event_id and e.teacher_id = auth.uid()
  ));
revoke all on public.race_violations from anon, authenticated;
grant select on public.race_violations to authenticated;

-- Replaces join_race: issues a random session token to the student's browser.
-- Only its SHA-256 hash is stored in the database.
create or replace function public.join_race(
  p_code text, p_name text, p_class text, p_school text
) returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare
  e public.racing_events;
  p public.race_players;
  v_token text;
begin
  if length(trim(coalesce(p_name,''))) = 0 or length(trim(coalesce(p_class,''))) = 0
     or length(trim(coalesce(p_school,''))) = 0 then
    raise exception 'Nama, kelas, dan sekolah wajib diisi';
  end if;
  select * into e from public.racing_events where code = upper(trim(p_code));
  if not found then raise exception 'Kode tidak ditemukan'; end if;
  if e.status not in ('waiting','active') then raise exception 'Event sudah ditutup'; end if;

  v_token := encode(gen_random_bytes(32), 'hex');
  insert into public.race_players(event_id,name,class_name,school,session_token_hash,status)
  values(e.id,trim(p_name),trim(p_class),trim(p_school),encode(digest(v_token,'sha256'),'hex'),'playing')
  returning * into p;

  return jsonb_build_object(
    'player', to_jsonb(p) - 'session_token_hash',
    'session_token', v_token,
    'event', jsonb_build_object('id',e.id,'title',e.title,'status',e.status,'code',e.code)
  );
exception when unique_violation then
  raise exception 'Nama ini sudah bergabung pada event tersebut';
end;
$$;

-- Server-authoritative violation recorder. Only confirmed hidden/page/fullscreen
-- events disqualify. blur is retained as an audit signal, not proof of cheating.
create or replace function public.report_race_violation(
  p_player_id uuid,
  p_session_token text,
  p_violation_type text,
  p_client_event_id uuid,
  p_details jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare
  p public.race_players;
  v_hash text;
  v_disqualify boolean;
  v_rows integer;
  v_reason text;
begin
  if p_violation_type not in ('visibility_hidden','page_hidden','fullscreen_exit','focus_blur') then
    raise exception 'Jenis pelanggaran tidak valid';
  end if;
  if p_session_token is null or length(p_session_token) < 32 then
    raise exception 'Sesi peserta tidak valid';
  end if;
  v_hash := encode(digest(p_session_token,'sha256'),'hex');

  select * into p from public.race_players
  where id = p_player_id and session_token_hash = v_hash
  for update;
  if not found then raise exception 'Sesi peserta tidak sah'; end if;

  if p.disqualified or p.status = 'disqualified' then
    return jsonb_build_object('disqualified',true,'reason',coalesce(p.disqualification_reason,'Pelanggaran anti-cheat'));
  end if;
  if p.status <> 'playing' then
    raise exception 'Balapan peserta tidak sedang aktif';
  end if;

  v_disqualify := p_violation_type in ('visibility_hidden','page_hidden','fullscreen_exit');
  v_reason := case p_violation_type
    when 'visibility_hidden' then 'Berpindah tab atau aplikasi (halaman tersembunyi)'
    when 'page_hidden' then 'Halaman balapan ditinggalkan'
    when 'fullscreen_exit' then 'Keluar dari mode fullscreen'
    else 'Perubahan fokus jendela browser (indikasi)'
  end;

  insert into public.race_violations(player_id,event_id,client_event_id,violation_type,details)
  values(p.id,p.event_id,p_client_event_id,p_violation_type,coalesce(p_details,'{}'::jsonb))
  on conflict(player_id,client_event_id) do nothing;
  get diagnostics v_rows = row_count;

  if v_rows = 1 then
    update public.race_players
    set violation_count = violation_count + 1,
        violation_reason = v_reason,
        violation_at = now(),
        disqualified = case when v_disqualify then true else disqualified end,
        disqualification_reason = case when v_disqualify then v_reason else disqualification_reason end,
        status = case when v_disqualify then 'disqualified' else status end
    where id = p.id returning * into p;
  end if;

  return jsonb_build_object(
    'recorded', v_rows = 1,
    'disqualified', p.disqualified,
    'reason', coalesce(p.disqualification_reason,v_reason),
    'violation_count', p.violation_count
  );
end;
$$;

revoke all on function public.report_race_violation(uuid,text,text,uuid,jsonb) from public;
grant execute on function public.report_race_violation(uuid,text,text,uuid,jsonb) to anon, authenticated;
revoke all on function public.join_race(text,text,text,text) from public;
grant execute on function public.join_race(text,text,text,text) to anon, authenticated;

-- Do not expose session hashes through ordinary table reads.
-- The starter's existing teacher SELECT policy remains in force; student session
-- should use RPCs rather than direct reads for private participant details.

-- Remove broad anonymous participant reads: the browser must not be able to
-- fetch other students or session-related fields directly.
revoke select on public.race_players from anon;
drop policy if exists "public can see participant race status" on public.race_players;

create or replace function public.get_my_race_player(p_player_id uuid,p_session_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions
as $$
declare p public.race_players; v_hash text;
begin
  v_hash := encode(digest(p_session_token,'sha256'),'hex');
  select * into p from public.race_players where id=p_player_id and session_token_hash=v_hash;
  if not found then raise exception 'Sesi peserta tidak sah'; end if;
  return to_jsonb(p) - 'session_token_hash';
end;
$$;

create or replace function public.finish_race(p_player_id uuid,p_session_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions
as $$
declare p public.race_players; v_hash text;
begin
  v_hash := encode(digest(p_session_token,'sha256'),'hex');
  update public.race_players
  set status='finished'
  where id=p_player_id and session_token_hash=v_hash and status='playing' and disqualified=false
  returning * into p;
  if not found then raise exception 'Peserta tidak dapat menyelesaikan race'; end if;
  return to_jsonb(p) - 'session_token_hash';
end;
$$;

-- Replace answer submission with a server-side status check so a disqualified
-- participant cannot continue answering through a manually crafted request.
drop function if exists public.submit_race_answer(uuid,uuid,integer);
create or replace function public.submit_race_answer(
  p_player_id uuid,p_question_id uuid,p_answer integer,p_session_token text
) returns jsonb language plpgsql security definer set search_path=public, extensions as $$
declare p public.race_players; q public.race_questions; isright boolean; total integer; nextprogress numeric; v_hash text;
begin
  v_hash := encode(digest(p_session_token,'sha256'),'hex');
  select * into p from public.race_players where id=p_player_id and session_token_hash=v_hash for update;
  if not found then raise exception 'Sesi peserta tidak sah'; end if;
  if p.disqualified or p.status <> 'playing' then raise exception 'Race tidak aktif atau peserta didiskualifikasi'; end if;
  select * into q from public.race_questions where id=p_question_id and event_id=p.event_id;
  if not found then raise exception 'Soal tidak valid'; end if;
  if exists(select 1 from public.race_answers where player_id=p_player_id and question_id=p_question_id) then raise exception 'Soal sudah dijawab'; end if;
  isright := p_answer=q.correct_index;
  insert into public.race_answers(player_id,question_id,answer_index,is_correct) values(p_player_id,p_question_id,p_answer,isright);
  if isright then update public.race_players set correct_count=correct_count+1 where id=p_player_id;
  else update public.race_players set wrong_count=wrong_count+1 where id=p_player_id; end if;
  select count(*) into total from public.race_questions where event_id=p.event_id;
  select (count(*) filter(where is_correct)::numeric / greatest(total,1))*100 into nextprogress
  from public.race_answers a join public.race_questions q2 on q2.id=a.question_id where a.player_id=p_player_id;
  update public.race_players set progress=coalesce(nextprogress,0) where id=p_player_id;
  return jsonb_build_object('correct',isright,'progress',coalesce(nextprogress,0));
end;
$$;
revoke all on function public.submit_race_answer(uuid,uuid,integer,text) from public;
grant execute on function public.submit_race_answer(uuid,uuid,integer,text) to anon,authenticated;
