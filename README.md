# MATH RACING (Starter MVP)

React/Vite + Supabase realtime/polling + Excel export. This starter includes teacher login, event creation, question entry, student join by race code, answer submission through RPC, live track/leaderboard and Excel export.

## 1. Create Supabase project
1. Create a project at https://supabase.com.
2. Open SQL Editor and run `supabase/schema.sql`.
3. In Authentication > Providers, ensure Email is enabled.
4. Create a teacher account via Authentication > Users (or sign-up temporarily then disable public sign-up). Teacher event ownership is tied to `auth.uid()`.
5. Copy Project URL and anon/public key from Project Settings > API.

## 2. Local development
1. Install Node.js LTS.
2. Clone/download the project.
3. Create `.env.local` at project root:
   ```
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
   ```
4. Run `npm install`, then `npm run dev`.
5. Open the local URL printed by Vite.

## 3. Teacher workflow
- Login with teacher email/password.
- Create event, optionally specify a code.
- Open event manager and add questions. Choices: one per line. Correct answer index: 0 for first choice, 1 for second, etc.
- Activate the event, then give the code to students.
- Live dashboard and Excel export.

## 4. Student workflow
- Join using full name, class, school, and event code.
- Select answer; the database RPC checks the answer and updates progress.

## 5. GitHub Pages deployment (static build)
GitHub Pages is static hosting. Set repo Settings > Pages > Build and deployment to GitHub Actions. Use this workflow or deploy the dist directory using an action that supports Vite. Supabase handles database and server RPCs.

For a quick deployment, use GitHub Actions with `npm ci`, `npm run build`, and deploy `dist`. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repository Actions variables, not secrets needed at build-time (the anon key is designed to be public, but security is enforced by policies/RPC). Use a Vite base path if deploying to a project subpath.

## Limitations / hardening before public classroom rollout
- This is an MVP starter. Public participant listing and event metadata policies are permissive for demo convenience; replace them with private views or stricter access policies before a public/high-stakes deployment.
- The SQL join function currently prevents duplicate names in a given event, and database answer submission prevents duplicate question attempts.
- Progress is based on proportion of answered questions marked correct, so race progress may not update to 100% if questions are unanswered.
- The race visual is a lightweight emoji-motor lane animation; Phaser-based richer assets and effects can be added in the next iteration.
- Consider adding time-based scoring, rate limiting, session tokens, offline handling, QR join, image upload, and audit logs.

## 6. Strict anti-cheat (required migration)
1. Run the original `supabase/schema.sql` first on a fresh project.
2. Then run `supabase/anti_cheat.sql` in Supabase SQL Editor.
3. The student must press **MULAI RACE DALAM FULLSCREEN** after joining. Fullscreen requires a direct user gesture and browser support.
4. A confirmed `visibilitychange` to `hidden`, `pagehide`, or fullscreen exit is recorded by the server and changes the participant status to `disqualified`. The client then shows the crash screen.
5. Window `blur` is logged as an indication only; it does not automatically disqualify because notifications, keyboard actions, and OS overlays can also cause blur.
6. The join RPC issues a random per-session token. The database stores only its SHA-256 hash; violation reports must present the token.

### Important browser limitation
A normal website cannot reliably detect every external app, AI use on a second device, or all operating-system overlays. Browser events can also be interrupted by force-closing the browser or losing connectivity. Treat this as a deterrent and audit trail, not a guaranteed secure exam kiosk. For high-stakes exams, use supervised devices or a managed kiosk/lockdown browser. Test on the exact Android browsers and devices used by students.

## 7. Locked Exam Mode (strict)
Run migrations in this exact order after the base schema:
1. `supabase/schema.sql` (fresh project only)
2. `supabase/anti_cheat.sql`
3. `supabase/locked_exam.sql`

Locked Exam Mode adds:
- Sequential questions only; the student UI has no previous-question navigation.
- A per-question countdown (default 60 seconds, configurable per event in the database from 10 to 600 seconds).
- Each accepted answer is committed immediately to Supabase; a timed-out question is stored as unanswered.
- Server-side ordering, duplicate-answer prevention, and server-side elapsed-time validation.
- A disconnected browser disables answer submission and retries the timer flow when connectivity returns. The student must stay on the page; a confirmed hidden/pagehide event can still trigger strict disqualification.
- Teacher-only recovery via `teacher_recover_player`. The recovery reason is audited in `race_recovery_actions`; saved answers remain intact and the student resumes at the next unanswered question after re-entering fullscreen.
- Live dashboard button `Pulihkan (guru)` appears for disqualified students.

Default event policy columns: `anti_cheat_enabled=true`, `strict_mode=true`, `require_fullscreen=true`, `log_focus_changes=true`, `question_time_limit_seconds=60`.

Important: the browser cannot reliably detect AI use on a second device or prevent OS-level switching in every browser. A reload/navigation can trigger `pagehide`, but events may not reach the server if the device is offline or force-closed. Teacher recovery is intentionally an audited exception, not a student-controlled bypass. Use supervised devices or a managed kiosk/lockdown browser for high-stakes exams.
