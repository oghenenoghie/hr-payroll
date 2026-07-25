-- Email delivery for notifications, via Resend called directly from
-- Postgres (net.http_post) — no separate Edge Function to deploy or wire
-- up. The API key, verified from-address, and the app's own base URL
-- (for turning a notification's relative `link` into something clickable
-- in an email client) live in Supabase Vault, never in a migration file
-- or anywhere that gets committed to git. Until an operator sets those
-- three secrets, this trigger no-ops silently on every insert — it must
-- never block or fail the notification itself, which is the real
-- product feature; email is a delivery channel layered on top of it.
alter table public.notifications add column emailed_at timestamptz;

create or replace function core.send_notification_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_api_key text;
  v_from_email text;
  v_app_base_url text;
  v_recipient_email text;
  v_body text;
begin
  select decrypted_secret into v_api_key from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  select decrypted_secret into v_from_email from vault.decrypted_secrets where name = 'resend_from_email' limit 1;

  if v_api_key is null or v_from_email is null then
    return new;
  end if;

  select email into v_recipient_email from auth.users where id = new.recipient_user_id;
  if v_recipient_email is null then
    return new;
  end if;

  select decrypted_secret into v_app_base_url from vault.decrypted_secrets where name = 'app_base_url' limit 1;

  v_body := new.message;
  if new.link is not null and v_app_base_url is not null then
    v_body := v_body || chr(10) || chr(10) || 'View: ' || v_app_base_url || new.link;
  end if;

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_api_key, 'Content-Type', 'application/json'),
    body := jsonb_build_object(
      'from', v_from_email,
      'to', jsonb_build_array(v_recipient_email),
      'subject', 'Plutus notification',
      'text', v_body
    )
  );

  -- Records that a send was attempted/dispatched, not that Resend
  -- confirmed delivery — net.http_post is fire-and-forget async, and
  -- tracking actual delivery status would need a separate webhook back
  -- from Resend, which is out of scope here.
  update public.notifications set emailed_at = now() where id = new.id;

  return new;
end;
$$;

revoke execute on function core.send_notification_email() from public, anon, authenticated;

create trigger send_notification_email_trigger
after insert on public.notifications
for each row
execute function core.send_notification_email();
