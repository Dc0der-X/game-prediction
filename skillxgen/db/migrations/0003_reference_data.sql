-- Reference data required for the application to function (not demonstration data).
insert into roles (key, name, description, rank) values
  ('super_admin', 'Super Admin', 'Full control, including assigning administrator roles.', 100),
  ('admin', 'Admin', 'Runs day-to-day operations: catalogue, CRM, content, payments, support.', 80),
  ('instructor', 'Instructor', 'Teaches assigned courses and reviews student submissions.', 50),
  ('student', 'Student', 'Learner account. Access is limited to the user''s own data.', 10);

insert into permissions (key, description) values
  ('admin.access', 'Open the administration area'),
  ('users.view', 'View users, students and enrolments'),
  ('users.manage', 'Suspend users, manage enrolments and assign non-admin roles'),
  ('roles.assign_admin', 'Grant or revoke admin and super admin roles'),
  ('programmes.manage', 'Create and edit programmes and pricing'),
  ('courses.manage', 'Create and edit any course, curriculum and assignment'),
  ('courses.teach', 'Edit curriculum and assignments of courses the user instructs'),
  ('submissions.review', 'Review student submissions and give feedback'),
  ('leads.view', 'View CRM leads'),
  ('leads.manage', 'Edit leads, add notes, change pipeline stage'),
  ('leads.export', 'Export permitted CRM records'),
  ('content.manage', 'Create and edit marketing content and campaigns'),
  ('content.approve', 'Approve and publish marketing content'),
  ('blog.manage', 'Manage blog posts and free resources'),
  ('proof.manage', 'Manage testimonials, case studies and proof items'),
  ('proof.verify', 'Mark proof as verified (required before publication)'),
  ('webinars.manage', 'Manage webinars and registrations'),
  ('payments.view', 'View payment records'),
  ('payments.manage', 'Record refunds and manage coupons'),
  ('support.manage', 'Respond to and manage support tickets'),
  ('analytics.view', 'View platform analytics'),
  ('settings.manage', 'Manage AI configuration, email templates and integration checks'),
  ('integrations.view', 'View integration status'),
  ('audit.view', 'View audit logs'),
  ('data.manage', 'Handle data export and deletion requests');

insert into role_permissions (role_key, permission_key) select 'super_admin', key from permissions;
insert into role_permissions (role_key, permission_key) select 'admin', key from permissions where key <> 'roles.assign_admin';
insert into role_permissions (role_key, permission_key) values
  ('instructor', 'admin.access'), ('instructor', 'courses.teach'), ('instructor', 'submissions.review');

insert into integrations (key, name, category, description) values
  ('database', 'PostgreSQL', 'core', 'Primary relational database with Row Level Security.'),
  ('auth', 'Clerk', 'core', 'Authentication, email verification, sessions and password reset.'),
  ('storage', 'File storage', 'core', 'Private storage for resumes, submissions and marketing assets (local disk or Supabase Storage).'),
  ('ai', 'AI provider', 'ai', 'LLM provider used to enrich the career tools. Rule-based analysis works without it.'),
  ('stripe', 'Stripe', 'payments', 'Checkout and verified webhooks. Test mode only until explicitly enabled.'),
  ('resend', 'Resend', 'email', 'Transactional email delivery. Without it, email is stored in the outbox.'),
  ('n8n', 'n8n', 'automation', 'Outbound signed webhooks for workflow automation.'),
  ('postiz', 'Postiz', 'marketing', 'Social content distribution for approved content.'),
  ('twenty', 'Twenty CRM', 'crm', 'External CRM. Not selected: SkillXGen ships a native CRM module.'),
  ('umami', 'Umami', 'analytics', 'Privacy-friendly website analytics.'),
  ('calcom', 'Cal.com', 'scheduling', 'Consultation booking link.');

insert into email_templates (key, name, description, subject, body) values
  ('verify_email', 'Verify email', 'Sent by the local auth adapter after registration. Variables: name, link',
   'Confirm your SkillXGen email address',
   E'Hi {{name}},\n\nConfirm your email address to activate your SkillXGen account:\n\n{{link}}\n\nThis link expires in 24 hours. If you did not create an account, ignore this email.\n\n— SkillXGen'),
  ('reset_password', 'Reset password', 'Sent by the local auth adapter. Variables: name, link',
   'Reset your SkillXGen password',
   E'Hi {{name}},\n\nUse the link below to choose a new password. It expires in 1 hour.\n\n{{link}}\n\nIf you did not request this, you can ignore this email.\n\n— SkillXGen'),
  ('enquiry_received', 'Enquiry received', 'Confirmation to a lead after an enquiry. Variables: name, topic, unsubscribe_link',
   'We received your enquiry',
   E'Hi {{name}},\n\nThanks for getting in touch about {{topic}}. A member of the SkillXGen team will reply within two working days.\n\nWe will never promise a job outcome — we will tell you honestly whether a programme fits your goals.\n\n— SkillXGen\n\nYou are receiving this because you contacted us. Stop all non-essential email: {{unsubscribe_link}}'),
  ('webinar_registration', 'Webinar registration', 'Variables: name, title, starts_at, unsubscribe_link',
   'You are registered: {{title}}',
   E'Hi {{name}},\n\nYou are registered for "{{title}}" on {{starts_at}}.\n\nThe join link will be sent before the session and is available in your account if you registered while signed in.\n\n— SkillXGen\n\nUnsubscribe: {{unsubscribe_link}}'),
  ('payment_receipt', 'Payment receipt', 'Variables: name, programme, amount, receipt_number, link',
   'Receipt {{receipt_number}} — {{programme}}',
   E'Hi {{name}},\n\nWe have received your payment of {{amount}} for {{programme}}.\n\nReceipt number: {{receipt_number}}\nView your receipt and start learning: {{link}}\n\n— SkillXGen'),
  ('payment_failed', 'Payment failed', 'Variables: name, programme, link',
   'Your payment for {{programme}} did not complete',
   E'Hi {{name}},\n\nYour payment for {{programme}} did not complete and you have not been charged. You can try again here:\n\n{{link}}\n\n— SkillXGen'),
  ('feedback_ready', 'Instructor feedback ready', 'Variables: name, assignment, link',
   'Feedback on "{{assignment}}"',
   E'Hi {{name}},\n\nYour instructor has reviewed "{{assignment}}". Read the feedback here:\n\n{{link}}\n\n— SkillXGen'),
  ('ticket_reply', 'Support reply', 'Variables: name, subject, link',
   'Reply to your support request: {{subject}}',
   E'Hi {{name}},\n\nThe support team has replied to "{{subject}}".\n\n{{link}}\n\n— SkillXGen');

insert into settings (key, value) values
  ('ai', '{"enabled": true, "model": "", "max_output_tokens": 1500}'),
  ('proof', '{"publish_completion_stats": false}');
