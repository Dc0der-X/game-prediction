-- Row Level Security. Every policy targets skillxgen_app, the role user-facing queries run as.
-- The owning role (migrations, webhooks, auth provisioning) bypasses RLS and is only used server-side.
-- Identity comes from the transaction-local setting app.user_id; the role is always re-read from profiles.

create or replace function app.user_id() returns uuid language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;

create or replace function app.has_perm(p text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from profiles pr join role_permissions rp on rp.role_key = pr.role
    where pr.id = app.user_id() and pr.status = 'active' and rp.permission_key = p)
$$;

create or replace function app.can_access_course(c uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from courses co where co.id = c and co.status = 'published' and (
      co.is_free or exists (
        select 1 from enrolments e
        where e.user_id = app.user_id() and e.status in ('active', 'completed')
          and (e.course_id = co.id or e.programme_id = co.programme_id))))
$$;

create or replace function app.teaches_course(c uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select app.has_perm('courses.manage')
      or (app.has_perm('courses.teach') and exists (select 1 from courses co where co.id = c and co.instructor_id = app.user_id()))
$$;

create or replace function app.can_review_course(c uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select app.has_perm('submissions.review')
     and (app.has_perm('courses.manage') or exists (select 1 from courses co where co.id = c and co.instructor_id = app.user_id()))
$$;

-- Public curriculum outline (titles only, never lesson bodies). Runs with owner rights by design.
create view lesson_outline as
  select l.id, l.course_id, l.module_id, l.slug, l.title, l.duration_minutes, l.is_preview, l.position
  from lessons l join courses c on c.id = l.course_id where c.status = 'published';

grant usage on schema public, app to skillxgen_app;
grant execute on all functions in schema app to skillxgen_app;
grant select on lesson_outline to skillxgen_app;

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
  -- No direct access for the app role: local_auth_users, local_auth_tokens, rate_limits, payment_events.
  foreach t in array array[
    'programmes','courses','modules','lessons','enrolments','progress','files','assignments','submissions',
    'instructor_feedback','resumes','job_descriptions','resume_analyses','career_assessments','interview_sessions',
    'interview_questions','learning_sessions','lab_attempts','leads','lead_interactions','webinars','webinar_links',
    'registrations','blog_posts','resources','campaigns','content_assets','content_publications','testimonials',
    'case_studies','proof_items','refunds','coupons','support_tickets','ticket_messages','data_requests','settings',
    'email_templates','integrations'] loop
    execute format('grant select, insert, update, delete on public.%I to skillxgen_app', t);
  end loop;
end $$;

grant select on roles, permissions, role_permissions, payments, audit_logs, email_outbox to skillxgen_app;
grant select, update on notifications to skillxgen_app;
-- Column-level grant: users can never change their own role, status, email or identity link.
grant select on profiles to skillxgen_app;
grant update (full_name, country, headline, bio, career_level, target_role, linkedin_url, marketing_consent, last_seen_at) on profiles to skillxgen_app;

-- ── Access control tables ────────────────────────────────────────────
create policy roles_read on roles for select to skillxgen_app using (true);
create policy permissions_read on permissions for select to skillxgen_app using (true);
create policy role_permissions_read on role_permissions for select to skillxgen_app using (true);

create policy profiles_read on profiles for select to skillxgen_app
  using (id = app.user_id() or app.has_perm('users.view') or app.has_perm('submissions.review'));
create policy profiles_update_self on profiles for update to skillxgen_app
  using (id = app.user_id()) with check (id = app.user_id());

-- ── Catalogue ────────────────────────────────────────────────────────
create policy programmes_read on programmes for select to skillxgen_app
  using (status = 'published' or app.has_perm('programmes.manage'));
create policy programmes_write on programmes for all to skillxgen_app
  using (app.has_perm('programmes.manage')) with check (app.has_perm('programmes.manage'));

create policy courses_read on courses for select to skillxgen_app
  using (status = 'published' or app.has_perm('courses.manage') or instructor_id = app.user_id());
create policy courses_write on courses for all to skillxgen_app
  using (app.has_perm('courses.manage')) with check (app.has_perm('courses.manage'));

create policy modules_read on modules for select to skillxgen_app
  using (exists (select 1 from courses c where c.id = modules.course_id));
create policy modules_write on modules for all to skillxgen_app
  using (app.teaches_course(course_id)) with check (app.teaches_course(course_id));

-- Lesson bodies: previews, free courses, enrolled learners and the teaching team only.
create policy lessons_read on lessons for select to skillxgen_app
  using (app.teaches_course(course_id) or app.can_access_course(course_id)
      or (is_preview and exists (select 1 from courses c where c.id = lessons.course_id and c.status = 'published')));
create policy lessons_write on lessons for all to skillxgen_app
  using (app.teaches_course(course_id)) with check (app.teaches_course(course_id));

create policy assignments_read on assignments for select to skillxgen_app
  using (app.teaches_course(course_id) or (status = 'published' and app.can_access_course(course_id)));
create policy assignments_write on assignments for all to skillxgen_app
  using (app.teaches_course(course_id)) with check (app.teaches_course(course_id));

-- ── Learning records ─────────────────────────────────────────────────
create policy enrolments_read on enrolments for select to skillxgen_app
  using (user_id = app.user_id() or app.has_perm('users.view'));
-- Self-enrolment is only possible into published free courses; paid enrolments are created by the verified webhook.
create policy enrolments_self_free on enrolments for insert to skillxgen_app
  with check (user_id = app.user_id() and source = 'free' and payment_id is null and course_id is not null
    and exists (select 1 from courses c where c.id = enrolments.course_id and c.is_free and c.status = 'published'));
create policy enrolments_admin on enrolments for all to skillxgen_app
  using (app.has_perm('users.manage')) with check (app.has_perm('users.manage'));

create policy progress_own on progress for all to skillxgen_app
  using (user_id = app.user_id())
  with check (user_id = app.user_id() and app.can_access_course(course_id));
create policy progress_staff_read on progress for select to skillxgen_app using (app.has_perm('users.view'));

create policy files_own on files for all to skillxgen_app
  using (owner_id = app.user_id()) with check (owner_id = app.user_id());
create policy files_staff_read on files for select to skillxgen_app
  using ((bucket = 'assets' and app.has_perm('content.manage'))
      or (bucket = 'submissions' and exists (select 1 from submissions s where s.file_id = files.id)));

create policy submissions_read on submissions for select to skillxgen_app
  using (user_id = app.user_id()
      or exists (select 1 from assignments a where a.id = submissions.assignment_id and app.can_review_course(a.course_id)));
create policy submissions_insert_own on submissions for insert to skillxgen_app
  with check (user_id = app.user_id() and status = 'submitted'
    and exists (select 1 from assignments a where a.id = submissions.assignment_id and a.status = 'published' and app.can_access_course(a.course_id)));
-- Students may only revise work that has not been passed, and can never set their own status beyond "submitted".
create policy submissions_update_own on submissions for update to skillxgen_app
  using (user_id = app.user_id() and status in ('submitted', 'needs_changes'))
  with check (user_id = app.user_id() and status = 'submitted');
create policy submissions_review on submissions for update to skillxgen_app
  using (exists (select 1 from assignments a where a.id = submissions.assignment_id and app.can_review_course(a.course_id)))
  with check (exists (select 1 from assignments a where a.id = submissions.assignment_id and app.can_review_course(a.course_id)));

create policy feedback_read on instructor_feedback for select to skillxgen_app
  using (exists (select 1 from submissions s where s.id = instructor_feedback.submission_id));
create policy feedback_insert on instructor_feedback for insert to skillxgen_app
  with check (instructor_id = app.user_id() and exists (
    select 1 from submissions s join assignments a on a.id = s.assignment_id
    where s.id = instructor_feedback.submission_id and app.can_review_course(a.course_id)));

-- ── Private career data: strictly owner-only ─────────────────────────
do $$
declare t text;
begin
  foreach t in array array['resumes','job_descriptions','resume_analyses','interview_sessions','interview_questions','learning_sessions','lab_attempts'] loop
    execute format('create policy %I on public.%I for all to skillxgen_app using (user_id = app.user_id()) with check (user_id = app.user_id())', t || '_own', t);
  end loop;
end $$;
create policy career_assessments_own on career_assessments for all to skillxgen_app
  using (user_id = app.user_id()) with check (user_id = app.user_id());
create policy career_assessments_crm on career_assessments for select to skillxgen_app
  using (lead_id is not null and app.has_perm('leads.view'));

-- ── CRM ──────────────────────────────────────────────────────────────
create policy leads_read on leads for select to skillxgen_app using (app.has_perm('leads.view'));
create policy leads_write on leads for all to skillxgen_app
  using (app.has_perm('leads.manage')) with check (app.has_perm('leads.manage'));
create policy lead_interactions_read on lead_interactions for select to skillxgen_app using (app.has_perm('leads.view'));
create policy lead_interactions_write on lead_interactions for all to skillxgen_app
  using (app.has_perm('leads.manage')) with check (app.has_perm('leads.manage'));

create policy webinars_read on webinars for select to skillxgen_app
  using (status in ('scheduled', 'completed') or app.has_perm('webinars.manage'));
create policy webinars_write on webinars for all to skillxgen_app
  using (app.has_perm('webinars.manage')) with check (app.has_perm('webinars.manage'));
create policy registrations_read on registrations for select to skillxgen_app
  using (user_id = app.user_id() or app.has_perm('webinars.manage'));
create policy registrations_write on registrations for all to skillxgen_app
  using (app.has_perm('webinars.manage')) with check (app.has_perm('webinars.manage'));
create policy webinar_links_read on webinar_links for select to skillxgen_app
  using (app.has_perm('webinars.manage') or exists (
    select 1 from registrations r where r.webinar_id = webinar_links.webinar_id and r.user_id = app.user_id() and r.status <> 'cancelled'));
create policy webinar_links_write on webinar_links for all to skillxgen_app
  using (app.has_perm('webinars.manage')) with check (app.has_perm('webinars.manage'));

-- ── Content & marketing ──────────────────────────────────────────────
create policy blog_read on blog_posts for select to skillxgen_app using (status = 'published' or app.has_perm('blog.manage'));
create policy blog_write on blog_posts for all to skillxgen_app using (app.has_perm('blog.manage')) with check (app.has_perm('blog.manage'));
create policy resources_read on resources for select to skillxgen_app using (status = 'published' or app.has_perm('blog.manage'));
create policy resources_write on resources for all to skillxgen_app using (app.has_perm('blog.manage')) with check (app.has_perm('blog.manage'));

create policy campaigns_all on campaigns for all to skillxgen_app using (app.has_perm('content.manage')) with check (app.has_perm('content.manage'));
-- Only approvers can move content into an approved / scheduled / published state.
create policy content_assets_all on content_assets for all to skillxgen_app
  using (app.has_perm('content.manage'))
  with check (app.has_perm('content.manage') and (status not in ('approved', 'scheduled', 'published') or app.has_perm('content.approve')));
create policy content_publications_all on content_publications for all to skillxgen_app
  using (app.has_perm('content.manage')) with check (app.has_perm('content.approve'));

-- Proof: the public only ever sees published rows (which the table CHECKs guarantee are consented + verified).
do $$
declare t text;
begin
  foreach t in array array['testimonials','case_studies','proof_items'] loop
    execute format('create policy %I on public.%I for select to skillxgen_app using (published or app.has_perm(''proof.manage''))', t || '_read', t);
    execute format('create policy %I on public.%I for all to skillxgen_app using (app.has_perm(''proof.manage'')) with check (app.has_perm(''proof.manage'') and (verification_status <> ''verified'' or app.has_perm(''proof.verify'')))', t || '_write', t);
  end loop;
end $$;

-- ── Commerce ─────────────────────────────────────────────────────────
create policy payments_read on payments for select to skillxgen_app using (user_id = app.user_id() or app.has_perm('payments.view'));
create policy refunds_read on refunds for select to skillxgen_app
  using (app.has_perm('payments.view') or exists (select 1 from payments p where p.id = refunds.payment_id and p.user_id = app.user_id()));
create policy refunds_write on refunds for insert to skillxgen_app with check (app.has_perm('payments.manage') and recorded_by = app.user_id());
create policy coupons_all on coupons for all to skillxgen_app using (app.has_perm('payments.manage')) with check (app.has_perm('payments.manage'));

-- ── Operations ───────────────────────────────────────────────────────
create policy notifications_read on notifications for select to skillxgen_app using (user_id = app.user_id());
create policy notifications_update on notifications for update to skillxgen_app using (user_id = app.user_id()) with check (user_id = app.user_id());

create policy tickets_read on support_tickets for select to skillxgen_app using (user_id = app.user_id() or app.has_perm('support.manage'));
create policy tickets_insert on support_tickets for insert to skillxgen_app with check (user_id = app.user_id() and status = 'open' and assigned_to is null);
create policy tickets_manage on support_tickets for update to skillxgen_app using (app.has_perm('support.manage')) with check (app.has_perm('support.manage'));
create policy ticket_messages_read on ticket_messages for select to skillxgen_app
  using (exists (select 1 from support_tickets t where t.id = ticket_messages.ticket_id));
create policy ticket_messages_insert on ticket_messages for insert to skillxgen_app
  with check (author_id = app.user_id() and is_staff = app.has_perm('support.manage')
    and exists (select 1 from support_tickets t where t.id = ticket_messages.ticket_id and t.status <> 'closed'));

create policy audit_read on audit_logs for select to skillxgen_app using (app.has_perm('audit.view'));
create policy integrations_read on integrations for select to skillxgen_app using (app.has_perm('integrations.view'));
create policy integrations_write on integrations for update to skillxgen_app using (app.has_perm('settings.manage')) with check (app.has_perm('settings.manage'));
create policy email_templates_all on email_templates for all to skillxgen_app using (app.has_perm('settings.manage')) with check (app.has_perm('settings.manage'));
create policy email_outbox_read on email_outbox for select to skillxgen_app using (app.has_perm('settings.manage'));
create policy settings_all on settings for all to skillxgen_app using (app.has_perm('settings.manage')) with check (app.has_perm('settings.manage'));

create policy data_requests_read on data_requests for select to skillxgen_app using (user_id = app.user_id() or app.has_perm('data.manage'));
create policy data_requests_insert on data_requests for insert to skillxgen_app with check (user_id = app.user_id() and status = 'pending');
create policy data_requests_manage on data_requests for update to skillxgen_app using (app.has_perm('data.manage')) with check (app.has_perm('data.manage'));
