-- SkillXGen core schema. Plain PostgreSQL 14+ (Supabase / Neon / RDS compatible).
create extension if not exists citext;
create schema if not exists app;

-- Restricted role every user-facing query runs as (see src/lib/db.ts). Never granted BYPASSRLS.
do $$ begin
  if not exists (select from pg_roles where rolname = 'skillxgen_app') then
    create role skillxgen_app nologin;
  end if;
end $$;
grant skillxgen_app to current_user;

create or replace function app.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create or replace function app.random_token() returns text language sql volatile as $$
  select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
$$;

-- ── Access control ────────────────────────────────────────────────────
create table roles (
  key text primary key,
  name text not null,
  description text not null default '',
  rank int not null default 0
);
create table permissions (
  key text primary key,
  description text not null default ''
);
create table role_permissions (
  role_key text not null references roles(key) on delete cascade,
  permission_key text not null references permissions(key) on delete cascade,
  primary key (role_key, permission_key)
);

create table profiles (
  id uuid primary key default gen_random_uuid(),
  auth_provider text not null check (auth_provider in ('clerk', 'local')),
  auth_user_id text not null,
  email citext not null unique,
  full_name text not null default '',
  role text not null default 'student' references roles(key),
  status text not null default 'active' check (status in ('active', 'suspended', 'deleted')),
  country text,
  headline text,
  bio text,
  career_level text,
  target_role text,
  linkedin_url text,
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz,
  unique (auth_provider, auth_user_id)
);
create trigger profiles_touch before update on profiles for each row execute function app.touch_updated_at();

-- Local development / test auth adapter (not used when AUTH_PROVIDER=clerk).
create table local_auth_users (
  profile_id uuid primary key references profiles(id) on delete cascade,
  password_hash text not null,
  email_verified_at timestamptz,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  sessions_valid_after timestamptz not null default now()
);
create table local_auth_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  purpose text not null check (purpose in ('verify_email', 'reset_password')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── Catalogue & learning ──────────────────────────────────────────────
create table programmes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  tagline text not null default '',
  summary text not null default '',
  overview text not null default '',
  category text not null default 'programme' check (category in ('programme', 'service')),
  audience jsonb not null default '[]',
  prerequisites jsonb not null default '[]',
  curriculum jsonb not null default '[]',
  outcomes jsonb not null default '[]',
  projects jsonb not null default '[]',
  deliverables jsonb not null default '[]',
  limitations jsonb not null default '[]',
  duration text not null default '',
  delivery_format text not null default '',
  instructor_info text not null default '',
  price_usd int check (price_usd >= 0),
  price_gbp int check (price_gbp >= 0),
  price_cad int check (price_cad >= 0),
  enquiry_only boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger programmes_touch before update on programmes for each row execute function app.touch_updated_at();

create table courses (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid references programmes(id) on delete set null,
  slug text not null unique,
  title text not null,
  summary text not null default '',
  description text not null default '',
  level text not null default 'beginner' check (level in ('beginner', 'intermediate', 'advanced')),
  category text not null default 'core' check (category in ('core', 'certification', 'interview', 'free')),
  is_free boolean not null default false,
  est_hours numeric(5,1),
  instructor_id uuid references profiles(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger courses_touch before update on courses for each row execute function app.touch_updated_at();
create index courses_programme_idx on courses(programme_id);

create table modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  title text not null,
  summary text not null default '',
  position int not null default 0
);
create index modules_course_idx on modules(course_id, position);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  module_id uuid not null references modules(id) on delete cascade,
  slug text not null,
  title text not null,
  content text not null default '',
  video_url text,
  duration_minutes int not null default 10 check (duration_minutes >= 0),
  is_preview boolean not null default false,
  resources jsonb not null default '[]',
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, slug)
);
create trigger lessons_touch before update on lessons for each row execute function app.touch_updated_at();
create index lessons_module_idx on lessons(module_id, position);

create table coupons (
  id uuid primary key default gen_random_uuid(),
  code citext not null unique,
  description text not null default '',
  percent_off int check (percent_off between 1 and 100),
  amount_off int check (amount_off > 0),
  currency text check (currency in ('usd', 'gbp', 'cad')),
  programme_id uuid references programmes(id) on delete cascade,
  max_redemptions int check (max_redemptions > 0),
  redeemed_count int not null default 0,
  valid_from timestamptz,
  valid_until timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((percent_off is not null) <> (amount_off is not null)),
  check (amount_off is null or currency is not null)
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete restrict,
  programme_id uuid not null references programmes(id) on delete restrict,
  currency text not null check (currency in ('usd', 'gbp', 'cad')),
  amount int not null check (amount >= 0),
  discount_amount int not null default 0 check (discount_amount >= 0),
  coupon_id uuid references coupons(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'expired', 'refunded', 'partially_refunded')),
  provider text not null check (provider in ('stripe', 'mock')),
  provider_session_id text unique,
  provider_payment_intent text,
  livemode boolean not null default false,
  receipt_number text unique,
  failure_reason text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger payments_touch before update on payments for each row execute function app.touch_updated_at();
create index payments_user_idx on payments(user_id, created_at desc);
create sequence receipt_seq start 1001;

create table refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id) on delete cascade,
  amount int not null check (amount > 0),
  reason text not null default '',
  status text not null default 'recorded' check (status in ('recorded', 'processed')),
  provider_refund_id text unique,
  recorded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Webhook idempotency ledger.
create table payment_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

create table enrolments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  programme_id uuid references programmes(id) on delete cascade,
  course_id uuid references courses(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled', 'refunded')),
  source text not null check (source in ('free', 'payment', 'admin')),
  payment_id uuid references payments(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((programme_id is not null) <> (course_id is not null))
);
create unique index enrolments_user_programme on enrolments(user_id, programme_id) where programme_id is not null;
create unique index enrolments_user_course on enrolments(user_id, course_id) where course_id is not null;

create table progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  last_viewed_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, lesson_id)
);
create index progress_user_course_idx on progress(user_id, course_id, last_viewed_at desc);

create table files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade,
  bucket text not null check (bucket in ('resumes', 'submissions', 'assets')),
  storage_key text not null unique,
  original_name text not null,
  mime_type text not null,
  size_bytes int not null check (size_bytes > 0),
  sha256 text not null,
  created_at timestamptz not null default now()
);

create table assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  title text not null,
  instructions text not null default '',
  kind text not null default 'assignment' check (kind in ('assignment', 'project')),
  max_score int not null default 100 check (max_score > 0),
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  content text not null default '',
  link_url text,
  file_id uuid references files(id) on delete set null,
  status text not null default 'submitted' check (status in ('submitted', 'in_review', 'needs_changes', 'passed')),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, user_id)
);
create trigger submissions_touch before update on submissions for each row execute function app.touch_updated_at();

create table instructor_feedback (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  instructor_id uuid references profiles(id) on delete set null,
  comments text not null,
  score int check (score >= 0),
  outcome text not null check (outcome in ('needs_changes', 'passed')),
  created_at timestamptz not null default now()
);
create index instructor_feedback_submission_idx on instructor_feedback(submission_id, created_at);

-- ── AI career tools ───────────────────────────────────────────────────
create table resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  file_id uuid references files(id) on delete set null,
  parsed_text text not null,
  parsed jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table job_descriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null default '',
  company text not null default '',
  raw_text text not null,
  parsed jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table resume_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  resume_id uuid not null references resumes(id) on delete cascade,
  job_description_id uuid references job_descriptions(id) on delete set null,
  engine text not null,
  model text,
  result jsonb not null,
  created_at timestamptz not null default now()
);
create table career_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  lead_id uuid,
  target_role text not null,
  input jsonb not null,
  result jsonb not null,
  engine text not null,
  created_at timestamptz not null default now()
);
create table interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  resume_id uuid references resumes(id) on delete set null,
  job_description_id uuid references job_descriptions(id) on delete set null,
  target_role text not null,
  mode text not null check (mode in ('technical', 'behavioural', 'mixed')),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  engine text not null,
  summary jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create table interview_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references interview_sessions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  position int not null,
  category text not null,
  question text not null,
  guidance jsonb not null default '{}',
  follow_ups jsonb not null default '[]',
  answer text,
  feedback jsonb,
  score int check (score between 0 and 100),
  answered_at timestamptz
);
create index interview_questions_session_idx on interview_questions(session_id, position);
create table learning_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  topic text not null,
  prompt text not null,
  response text not null,
  engine text not null,
  created_at timestamptz not null default now()
);
create table lab_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  lab_slug text not null,
  answers jsonb not null default '{}',
  score int not null default 0,
  max_score int not null default 0,
  completed_at timestamptz not null default now(),
  unique (user_id, lab_slug)
);

-- ── CRM ───────────────────────────────────────────────────────────────
create table leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email citext not null unique,
  country text,
  career_level text,
  current_skills text,
  target_role text,
  programme_interest text,
  budget_range text,
  source text not null,
  message text,
  consent_marketing boolean not null default false,
  consent_at timestamptz,
  consent_text text,
  unsubscribed_at timestamptz,
  unsubscribe_token text not null unique default app.random_token(),
  stage text not null default 'new' check (stage in ('new', 'contacted', 'qualified', 'consultation_booked', 'consultation_completed', 'offer_sent', 'won', 'lost')),
  lost_reason text,
  assigned_to uuid references profiles(id) on delete set null,
  follow_up_at date,
  profile_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (stage <> 'lost' or lost_reason is not null)
);
create trigger leads_touch before update on leads for each row execute function app.touch_updated_at();
create index leads_stage_idx on leads(stage, created_at desc);
alter table career_assessments add constraint career_assessments_lead_fk foreign key (lead_id) references leads(id) on delete set null;

create table lead_interactions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  type text not null check (type in ('enquiry', 'consultation_request', 'webinar_registration', 'resource_download', 'assessment', 'note', 'email', 'call', 'meeting', 'stage_change', 'system')),
  summary text not null,
  details jsonb not null default '{}',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index lead_interactions_lead_idx on lead_interactions(lead_id, created_at desc);

create table webinars (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  starts_at timestamptz not null,
  duration_minutes int not null default 60,
  host_name text not null default 'SkillXGen',
  capacity int,
  status text not null default 'scheduled' check (status in ('draft', 'scheduled', 'completed', 'cancelled')),
  recording_url text,
  created_at timestamptz not null default now()
);
-- Join links are kept out of the public table so they are never exposed to non-registrants.
create table webinar_links (
  webinar_id uuid primary key references webinars(id) on delete cascade,
  join_url text not null
);
create table registrations (
  id uuid primary key default gen_random_uuid(),
  webinar_id uuid not null references webinars(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,
  user_id uuid references profiles(id) on delete set null,
  name text not null,
  email citext not null,
  status text not null default 'registered' check (status in ('registered', 'attended', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (webinar_id, email)
);

-- ── Content, marketing, proof ─────────────────────────────────────────
create table blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text not null default '',
  body text not null default '',
  tags text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  author_id uuid references profiles(id) on delete set null,
  author_name text not null default 'SkillXGen Team',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger blog_posts_touch before update on blog_posts for each row execute function app.touch_updated_at();

create table resources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  kind text not null default 'guide' check (kind in ('guide', 'checklist', 'roadmap', 'template', 'report')),
  body text not null default '',
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  objective text not null default '',
  audience text not null default '',
  status text not null default 'planned' check (status in ('planned', 'active', 'paused', 'completed')),
  start_date date,
  end_date date,
  owner_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table content_assets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete set null,
  kind text not null check (kind in ('idea', 'linkedin', 'youtube_script', 'short_video', 'instagram', 'reddit', 'newsletter', 'blog', 'asset')),
  title text not null,
  body text not null default '',
  notes text not null default '',
  status text not null default 'draft' check (status in ('idea', 'draft', 'in_review', 'approved', 'scheduled', 'published', 'failed', 'archived')),
  scheduled_for timestamptz,
  author_id uuid references profiles(id) on delete set null,
  approved_by uuid references profiles(id) on delete set null,
  approved_at timestamptz,
  file_id uuid references files(id) on delete set null,
  blog_post_id uuid references blog_posts(id) on delete set null,
  metrics jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger content_assets_touch before update on content_assets for each row execute function app.touch_updated_at();

create table content_publications (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references content_assets(id) on delete cascade,
  channel text not null,
  provider text not null,
  status text not null check (status in ('success', 'failed', 'not_connected')),
  external_ref text,
  detail text not null default '',
  attempted_by uuid references profiles(id) on delete set null,
  attempted_at timestamptz not null default now()
);

-- Proof: a row can only be published once consent is granted AND it is verified (enforced here, not just in the UI).
create table testimonials (
  id uuid primary key default gen_random_uuid(),
  person_name text not null,
  person_title text not null default '',
  quote text not null,
  programme_id uuid references programmes(id) on delete set null,
  outcome_type text not null default 'none' check (outcome_type in ('none', 'training_completion', 'certification', 'interview_success', 'placement')),
  consent_status text not null default 'pending' check (consent_status in ('pending', 'granted', 'withdrawn')),
  consent_evidence text not null default '',
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'verified', 'rejected')),
  verified_by uuid references profiles(id) on delete set null,
  verified_at timestamptz,
  published boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  check (not published or (consent_status = 'granted' and verification_status = 'verified' and not is_demo))
);
create table case_studies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  person_name text not null default '',
  summary text not null default '',
  body text not null default '',
  programme_id uuid references programmes(id) on delete set null,
  outcome_type text not null default 'training_completion' check (outcome_type in ('training_completion', 'certification', 'interview_success', 'placement')),
  consent_status text not null default 'pending' check (consent_status in ('pending', 'granted', 'withdrawn')),
  consent_evidence text not null default '',
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'verified', 'rejected')),
  verified_by uuid references profiles(id) on delete set null,
  verified_at timestamptz,
  published boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  check (not published or (consent_status = 'granted' and verification_status = 'verified' and not is_demo))
);
create table proof_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('student_project', 'certification', 'placement', 'interview_success', 'training_completion', 'instructor_credential')),
  title text not null,
  person_name text not null default '',
  description text not null default '',
  evidence_note text not null default '',
  issued_on date,
  consent_status text not null default 'pending' check (consent_status in ('pending', 'granted', 'withdrawn')),
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'verified', 'rejected')),
  verified_by uuid references profiles(id) on delete set null,
  verified_at timestamptz,
  published boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  check (not published or (consent_status = 'granted' and verification_status = 'verified' and not is_demo))
);

-- ── Operations ────────────────────────────────────────────────────────
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body text not null default '',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications(user_id, created_at desc);

create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  subject text not null,
  category text not null default 'general' check (category in ('general', 'technical', 'billing', 'course', 'career')),
  status text not null default 'open' check (status in ('open', 'pending', 'resolved', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  assigned_to uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger support_tickets_touch before update on support_tickets for each row execute function app.touch_updated_at();
create table ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  is_staff boolean not null default false,
  body text not null,
  created_at timestamptz not null default now()
);

create table audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_role text,
  action text not null,
  entity text not null,
  entity_id text,
  meta jsonb not null default '{}',
  ip text,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on audit_logs(created_at desc);

create table integrations (
  key text primary key,
  name text not null,
  category text not null,
  description text not null default '',
  status text not null default 'disconnected' check (status in ('connected', 'disconnected', 'unavailable', 'error')),
  last_checked_at timestamptz,
  last_message text not null default ''
);

create table email_templates (
  key text primary key,
  name text not null,
  description text not null default '',
  subject text not null,
  body text not null,
  updated_at timestamptz not null default now()
);
create table email_outbox (
  id uuid primary key default gen_random_uuid(),
  to_email citext not null,
  template_key text,
  subject text not null,
  body text not null,
  provider text not null,
  status text not null check (status in ('stored', 'sent', 'failed', 'suppressed')),
  error text,
  created_at timestamptz not null default now()
);
create index email_outbox_created_idx on email_outbox(created_at desc);

create table settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 1,
  primary key (key, window_start)
);

create table data_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  email citext not null,
  type text not null check (type in ('export', 'deletion')),
  status text not null default 'pending' check (status in ('pending', 'completed', 'rejected')),
  note text not null default '',
  handled_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
