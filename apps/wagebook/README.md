This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Email notifications (Resend)

Every row inserted into `public.notifications` (leave/loan/expense
approvals, pay-run created, contract/probation alerts, etc. — see
`src/lib/notifications.ts`) triggers `core.send_notification_email()`
(`supabase/migrations/20260724110000_notification_email_delivery.sql`),
which calls the Resend API directly from Postgres via `pg_net`. No app
code or API route is involved, and no Resend package needs installing in
`apps/wagebook` — this is entirely a database-side trigger.

Until three secrets are set in **Supabase Vault**, the trigger no-ops
silently on every insert (in-app notifications still work; only the email
side effect is skipped). Vault, not `apps/wagebook`'s environment
variables, is the source of truth here — vault secrets are per-project
and never touch `.env` or `NEXT_PUBLIC_*`.

### One-time setup per environment

1. In [Resend](https://resend.com), verify the sending domain you'll send
   from, then create an API key scoped to **Sending access** only (not
   full account access).
2. In the Supabase SQL editor for that project (local/preview/staging/
   production each need their own — see `engineering-and-lifecycle.md`
   §3, one Supabase project per environment, never shared), run:

   ```sql
   select vault.create_secret(
     're_your_actual_api_key',
     'resend_api_key',
     'Resend API key for core.send_notification_email()'
   );

   select vault.create_secret(
     'Plutus <notifications@yourverifieddomain.com>',
     'resend_from_email',
     'Verified Resend from-address for notification emails'
   );

   select vault.create_secret(
     'https://app.yourverifieddomain.com',
     'app_base_url',
     'Base URL used to turn a notification link into a clickable email URL'
   );
   ```

   `resend_from_email` must be an address on the domain you verified in
   step 1, or Resend will reject the send. `app_base_url` has no trailing
   slash — it's prefixed directly onto the notification's `link` (e.g.
   `/employees/123/edit`).

3. Confirm the secrets landed:

   ```sql
   select name from vault.decrypted_secrets
   where name in ('resend_api_key', 'resend_from_email', 'app_base_url');
   ```

   (Reading `decrypted_secret` itself requires an elevated role — this
   just confirms all three names are present.)

To rotate a key later, use `vault.update_secret(id, new_secret)` rather
than creating a duplicate with the same name — `send_notification_email()`
does `limit 1` with no ordering, so a duplicate name makes which one gets
used undefined.

### Verifying it's working

Trigger any action that calls `notifyUsers` (e.g. submit a leave request)
and check:

```sql
select id, type, message, emailed_at from public.notifications
order by created_at desc limit 5;
```

`emailed_at` is set once a send was *attempted* via `net.http_post` — it
does not confirm Resend accepted or delivered the message, since
`net.http_post` is fire-and-forget and there's no delivery webhook wired
up. Check the Resend dashboard's logs for actual delivery status.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
