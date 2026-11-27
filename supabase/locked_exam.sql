-- MATH RACING LOCKED EXAM + RECOVERY + SERVER-TIMED QUESTIONS
-- Run AFTER schema.sql and anti_cheat.sql.
create extension if not exists pgcrypto;

alter table public.racing_events
  add column if not exists anti_cheat_enabled boolean not null default true,
  add column if not exists strict_mode boolean not null default true,
  add column if not exists require_fullscreen boolean not null default true,
  add column if not exists log_focus_changes boolean not null default true,
  add column if not exists question_time_limit_seconds integer not null default 60 check (question_time_limit_seconds between 10 and 600);

alter table public.race_players
  add column if not exists current_question_index integer not null default 0,
  add column if not exists current_question_started_at timestamptz not null default now(),
  add column if not exists unanswered_count integer not null default 0,
  add column if not exists finished_at timestamptz;

alter table public.race_answers alter column answer_index drop not null;
alter table public.race_answers add column if not exists elapsed_ms integer not null default 0;

create table if not exists public.race_recovery_actions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.racing_events(id) on delete cascade,
  player_id uuid not null references public.race_players(id) on delete cascade,
  teacher_id uuid not null references auth.users(id),
  reason text not null,
  recovered_at timestamptz not null default now()
);
alter table public.race_recovery_actions enable row level security;
drop policy if exists "teachers view recovery actions" on public.race_recovery_actions;
create policy "teachers view recovery actions" on public.race_recovery_actions
 for select to authenticated using (exists(select 1 from public.racing_events e where e.id=event_id and e.teacher_id=auth.uid()));
revoke all on public.race_recovery_actions from anon, authenticated;
grant select on public.race_recovery_actions to authenticated;

-- New sessions start at question 1 with a server timestamp.
create or replace function public.join_race(p_code text,p_name text,p_class text,p_school text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare e public.racing_events; p public.race_players; v_token text;
begin
 if length(trim(coalesce(p_name,'')))=0 or length(trim(coalesce(p_class,'')))=0 or length(trim(coalesce(p_school,'')))=0 then raise exception 'Nama, kelas, dan sekolah wajib diisi'; end if;
 select * into e from public.racing_events where code=upper(trim(p_code));
 if not found then raise exception 'Kode tidak ditemukan'; end if;
 if e.status not in ('waiting','active') then raise exception 'Event sudah ditutup'; end if;
 v_token:=encode(gen_random_bytes(32),'hex');
 insert into public.race_players(event_id,name,class_name,school,session_token_hash,status,current_question_index,current_question_started_at)
 values(e.id,trim(p_name),trim(p_class),trim(p_school),encode(digest(v_token,'sha256'),'hex'),'playing',0,now()) returning * into p;
 return jsonb_build_object('player',to_jsonb(p)-'session_token_hash','session_token',v_token,
  'event',jsonb_build_object('id',e.id,'title',e.title,'status',e.status,'code',e.code,
  'anti_cheat_enabled',e.anti_cheat_enabled,'strict_mode',e.strict_mode,'require_fullscreen',e.require_fullscreen,
  'log_focus_changes',e.log_focus_changes,'question_time_limit_seconds',e.question_time_limit_seconds));
exception when unique_violation then raise exception 'Nama ini sudah bergabung pada event tersebut';
end $$;

-- Server-authoritative sequential answer submission. NULL answer means timeout/skip.
create or replace function public.submit_race_answer(p_player_id uuid,p_question_id uuid,p_answer integer,p_session_token text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare p public.race_players; q public.race_questions; e public.racing_events; v_hash text; v_elapsed integer; v_correct boolean; v_total integer; v_progress numeric; v_next integer;
begin
 v_hash:=encode(digest(p_session_token,'sha256'),'hex');
 select * into p from public.race_players where id=p_player_id and session_token_hash=v_hash for update;
 if not found then raise exception 'Sesi peserta tidak sah'; end if;
 if p.disqualified or p.status<>'playing' then raise exception 'Peserta tidak dapat melanjutkan race'; end if;
 select * into e from public.racing_events where id=p.event_id;
 select * into q from public.race_questions where id=p_question_id and event_id=p.event_id and position=p.current_question_index;
 if not found then raise exception 'Urutan soal tidak valid. Soal sebelumnya tidak dapat dilewati atau diulang.'; end if;
 if exists(select 1 from public.race_answers where player_id=p_player_id and question_id=p_question_id) then raise exception 'Soal sudah tersimpan'; end if;
 v_elapsed:=greatest(0,floor(extract(epoch from (now()-p.current_question_started_at))*1000)::integer);
 if p_answer is null and v_elapsed < e.question_time_limit_seconds*1000 then raise exception 'Waktu soal belum habis'; end if;
 if p_answer is not null and v_elapsed >= e.question_time_limit_seconds*1000 then raise exception 'Waktu soal sudah habis'; end if;
 v_correct:=p_answer is not null and p_answer=q.correct_index;
 insert into public.race_answers(player_id,question_id,answer_index,is_correct,elapsed_ms)
 values(p_player_id,p_question_id,p_answer,v_correct,v_elapsed);
 if p_answer is null then update public.race_players set unanswered_count=unanswered_count+1 where id=p_player_id;
 elsif v_correct then update public.race_players set correct_count=correct_count+1 where id=p_player_id;
 else update public.race_players set wrong_count=wrong_count+1 where id=p_player_id; end if;
 v_next:=p.current_question_index+1;
 select count(*) into v_total from public.race_questions where event_id=p.event_id;
 select (count(*) filter(where is_correct)::numeric/greatest(v_total,1))*100 into v_progress from public.race_answers a join public.race_questions qq on qq.id=a.question_id where a.player_id=p_player_id;
 update public.race_players set progress=coalesce(v_progress,0),current_question_index=v_next,current_question_started_at=now() where id=p_player_id;
 return jsonb_build_object('correct',v_correct,'progress',coalesce(v_progress,0),'elapsed_ms',v_elapsed,'next_question_index',v_next,'complete',v_next>=v_total);
end $$;
revoke all on function public.submit_race_answer(uuid,uuid,integer,text) from public;
grant execute on function public.submit_race_answer(uuid,uuid,integer,text) to anon,authenticated;

create or replace function public.finish_race(p_player_id uuid,p_session_token text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare p public.race_players; v_hash text; v_total integer;
begin
 v_hash:=encode(digest(p_session_token,'sha256'),'hex');
 select * into p from public.race_players where id=p_player_id and session_token_hash=v_hash for update;
 if not found then raise exception 'Sesi peserta tidak sah'; end if;
 select count(*) into v_total from public.race_questions where event_id=p.event_id;
 if p.disqualified or p.status<>'playing' or p.current_question_index<v_total then raise exception 'Belum semua soal diselesaikan'; end if;
 update public.race_players set status='finished',finished_at=now() where id=p.id returning * into p;
 return to_jsonb(p)-'session_token_hash';
end $$;
revoke all on function public.finish_race(uuid,text) from public;
grant execute on function public.finish_race(uuid,text) to anon,authenticated;

-- Teacher-only recovery. Keeps all submitted answers and resumes at the next unanswered question.
create or replace function public.teacher_recover_player(p_player_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.race_players; e public.racing_events;
begin
 if auth.uid() is null then raise exception 'Guru harus login'; end if;
 select * into p from public.race_players where id=p_player_id for update;
 if not found then raise exception 'Peserta tidak ditemukan'; end if;
 select * into e from public.racing_events where id=p.event_id and teacher_id=auth.uid();
 if not found then raise exception 'Tidak memiliki akses ke event ini'; end if;
 if p.status<>'disqualified' then raise exception 'Peserta bukan peserta diskualifikasi'; end if;
 insert into public.race_recovery_actions(event_id,player_id,teacher_id,reason) values(p.event_id,p.id,auth.uid(),coalesce(nullif(trim(p_reason),''),'Pemulihan disetujui guru'));
 update public.race_players set disqualified=false,status='playing',disqualification_reason=null,
   current_question_started_at=now() where id=p.id returning * into p;
 return to_jsonb(p)-'session_token_hash';
end $$;
revoke all on function public.teacher_recover_player(uuid,text) from public;
grant execute on function public.teacher_recover_player(uuid,text) to authenticated;

-- Realtime changes for participant state should be enabled in Supabase publication.
-- In Dashboard: Database > Publications > supabase_realtime, add race_players if absent.
