-- MATH RACING starter schema. Run this whole file in Supabase SQL Editor.
create extension if not exists pgcrypto;
create table if not exists public.racing_events(
 id uuid primary key default gen_random_uuid(), teacher_id uuid not null references auth.users(id) on delete cascade,
 title text not null, code text unique not null, class_name text default '', status text not null default 'waiting' check(status in ('waiting','active','finished')),
 created_at timestamptz not null default now());
create table if not exists public.race_questions(
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.racing_events(id) on delete cascade,
 prompt text not null, choices jsonb not null, correct_index integer not null, position integer not null default 0);
create table if not exists public.race_players(
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.racing_events(id) on delete cascade,
 name text not null, class_name text not null, school text not null, progress numeric not null default 0,
 correct_count integer not null default 0, wrong_count integer not null default 0,
 status text not null default 'playing', joined_at timestamptz not null default now(), unique(event_id,name));
create table if not exists public.race_answers(
 id uuid primary key default gen_random_uuid(), player_id uuid not null references public.race_players(id) on delete cascade,
 question_id uuid not null references public.race_questions(id) on delete cascade, answer_index integer not null,
 is_correct boolean not null, elapsed_ms integer not null default 0, created_at timestamptz not null default now(),unique(player_id,question_id));

alter table public.racing_events enable row level security;
alter table public.race_questions enable row level security;
alter table public.race_players enable row level security;
alter table public.race_answers enable row level security;
create policy "teachers manage own events" on public.racing_events for all to authenticated using (teacher_id=auth.uid()) with check (teacher_id=auth.uid());
create policy "teachers manage questions for own events" on public.race_questions for all to authenticated using (exists(select 1 from racing_events e where e.id=event_id and e.teacher_id=auth.uid())) with check (exists(select 1 from racing_events e where e.id=event_id and e.teacher_id=auth.uid()));
create policy "teacher view players" on public.race_players for select to authenticated using (exists(select 1 from racing_events e where e.id=event_id and e.teacher_id=auth.uid()));
create policy "teacher view answers" on public.race_answers for select to authenticated using (exists(select 1 from race_players p join racing_events e on e.id=p.event_id where p.id=player_id and e.teacher_id=auth.uid()));
-- RPCs accessible to students (anon) so no public direct write policies are needed.
create or replace function public.join_race(p_code text,p_name text,p_class text,p_school text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare e racing_events; p race_players;
begin select * into e from racing_events where code=upper(trim(p_code)); if not found then raise exception 'Kode tidak ditemukan'; end if;
if e.status not in ('waiting','active') then raise exception 'Event sudah ditutup'; end if;
insert into race_players(event_id,name,class_name,school) values(e.id,trim(p_name),trim(p_class),trim(p_school)) returning * into p;
return jsonb_build_object('player',to_jsonb(p),'event',jsonb_build_object('id',e.id,'title',e.title,'status',e.status));
end $$;
create or replace function public.get_race_questions(p_event_id uuid)
returns table(id uuid,prompt text,choices jsonb,position integer) language sql security definer set search_path=public as $$
select q.id,q.prompt,q.choices,q.position from race_questions q join racing_events e on e.id=q.event_id where e.id=p_event_id and e.status in ('waiting','active') order by q.position;
$$;
create or replace function public.submit_race_answer(p_player_id uuid,p_question_id uuid,p_answer integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p race_players; q race_questions; isright boolean; total integer; nextprogress numeric;
begin select * into p from race_players where id=p_player_id; if not found then raise exception 'Peserta tidak ditemukan'; end if;
select * into q from race_questions where id=p_question_id and event_id=p.event_id; if not found then raise exception 'Soal tidak valid'; end if;
if exists(select 1 from race_answers where player_id=p_player_id and question_id=p_question_id) then raise exception 'Soal sudah dijawab'; end if;
isright := p_answer=q.correct_index;
insert into race_answers(player_id,question_id,answer_index,is_correct) values(p_player_id,p_question_id,p_answer,isright);
if isright then update race_players set correct_count=correct_count+1 where id=p_player_id; else update race_players set wrong_count=wrong_count+1 where id=p_player_id; end if;
select count(*) into total from race_questions where event_id=p.event_id;
select (count(*) filter(where is_correct)::numeric / greatest(total,1))*100 into nextprogress from race_answers a join race_questions q2 on q2.id=a.question_id where a.player_id=p_player_id;
update race_players set progress=coalesce(nextprogress,0) where id=p_player_id;
return jsonb_build_object('correct',isright,'progress',coalesce(nextprogress,0)); end $$;
-- Join and answer RPCs callable from unauthenticated student devices. Avoid exposing answer key via table grants.
grant execute on function public.join_race(text,text,text,text) to anon,authenticated;
grant execute on function public.get_race_questions(uuid) to anon,authenticated;
grant execute on function public.submit_race_answer(uuid,uuid,integer) to anon,authenticated;
grant select on public.racing_events to anon;
grant select on public.race_players to anon;
create policy "public can see event metadata" on public.racing_events for select to anon using (true);
create policy "public can see participant race status" on public.race_players for select to anon using (true);
-- NOTE: for production, replace public participant/event reads with safer views and restrict student row visibility.
