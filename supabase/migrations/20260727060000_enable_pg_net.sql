-- pg_net is what core.send_notification_email() (see
-- 20260724110000_notification_email_delivery.sql) uses to call the Resend
-- API via net.http_post. Supabase-hosted projects normally have it
-- available already, but nothing before this asserted it the way
-- 20260724090000 asserts pg_cron — make it explicit and idempotent rather
-- than relying on a project default that could differ per environment.
create extension if not exists pg_net;
