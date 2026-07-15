# Web Push setup — Mumbai Sentinel

This is the "get alerts" feature — when someone reports an incident nearby, subscribed users get an actual phone notification, even if they're not looking at the app. It works on Android and desktop out of the box; iPhone/iPad users need to add the site to their home screen first (more on that at the bottom).

Getting this working took a fair bit of debugging, so this doc explains not just the steps but *why* things are set up the way they are.

There are three pieces to this:
1. **VAPID keys** — basically your site's ID card, proving to browsers that notifications really are coming from you
2. **A database table** — to remember who's subscribed and roughly where they are
3. **A Supabase Edge Function** — the background code that actually sends the notification when a report comes in

---

## Your VAPID keys

**⚠️ Not included here since this repo is public.** The public key is safe to share anywhere (it's below), but the private key is a secret — treat it like a password. It only lives in two places: Supabase's Edge Function secrets, and this project's own notes kept outside GitHub. If you ever need it again, check Supabase → Edge Functions → send-push → Secrets.

VAPID_PUBLIC_KEY=BDs5ztlaC7U_2cV_EcuKJaVF7vYQ_EvsuBqVNrqzkB-SL3brN03rlkVXHbm-2kJZawLdfLn0nXpvdV-NmmqENp8
VAPID_PRIVATE_KEY=[keep this secret — see Supabase Edge Function secrets, not stored in this public repo]

---

## 1. Create the subscriptions table

In Supabase → SQL Editor, run:

```sql
create table push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  lat double precision,
  lng double precision,
  radius_km integer default 5,
  created_at timestamp with time zone default now()
);

alter table push_subscriptions enable row level security;

create policy "Public insert push_subscriptions"
  on push_subscriptions for insert with check (true);
create policy "Public update push_subscriptions"
  on push_subscriptions for update using (true);
create policy "Public delete push_subscriptions"
  on push_subscriptions for delete using (true);
Notice there’s no “public read” policy here — that’s intentional. Subscription details are private; only the Edge Function itself (using an admin-level key) is allowed to read them.

2. Deploy the Edge Function

In Supabase, go to Edge Functions → Deploy a new function → Via Editor.

	•	Name it exactly send-push
	•	Paste in the code from supabase/functions/send-push/index.ts
	•	Hit Deploy

A quick story on why this function looks the way it does

The first attempt at this used a very popular library called web-push. It kept failing with a cryptic error: Not implemented: crypto.ECDH. Turns out that library relies on some low-level Node.js crypto internals that Supabase’s edge environment (which runs on Deno, not Node) simply doesn’t have — no amount of tweaking the import style fixed it.

The real fix was switching to a different library, @negrel/webpush, which does the same job but is built entirely on standard Web Crypto APIs that Deno actually supports. If you ever touch this function again, keep it on jsr:@negrel/webpush — going back to the old web-push package will just bring the same error back.

3. Add the function’s secrets

In Supabase, go to Edge Functions → Secrets and add three:
|Name               |Value                                                                                                                         |
|-------------------|------------------------------------------------------------------------------------------------------------------------------|
|`VAPID_PUBLIC_KEY` |the public key above                                                                                                          |
|`VAPID_PRIVATE_KEY`|your private key (kept out of this public repo — see your own notes or generate a fresh pair if lost)                         |
|`VAPID_SUBJECT`    |`mailto:your@email.com` — **the `mailto:` part matters**, just typing the email alone will fail with a “not a valid URL” error|
You don’t need to add SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — Supabase provides those automatically.

4. Add the public key to Vercel

In Vercel → your project → Settings → Environment Variables, add:
|Name                   |Value               |
|-----------------------|----------------
|`VITE_VAPID_PUBLIC_KEY`|the public key above|
Then redeploy — environment variable changes don’t apply to a site that’s already deployed, you need a fresh build.

5. Update the app files

	•	src/App.jsx — has the “Get alerts” button and subscription logic
	•	public/sw.js — the background script that actually shows the notification

Push both up to GitHub and Vercel will rebuild automatically.

How to test it

Quick test using Supabase’s built-in tester (Edge Functions → send-push → Test):
{
  "incident": {
    "id": "test-1",
    "category": "traffic",
    "description": "test incident",
    "lat": 19.076,
    "lng": 72.8777
  }
}
The response tells you exactly what happened:

	•	sent — how many notifications actually went out
	•	skippedByDistance — real subscribers exist, they’re just outside the radius of these test coordinates (not a bug, just means the test location doesn’t match anyone’s real saved location)
	•	failures — an actual delivery problem, with the real error message attached
	•	removed — old, dead subscriptions that got cleaned up automatically

The test that actually matters: subscribe for real on the live site (say yes to location when it asks), then submit a real incident report near wherever you are, and see if a notification shows up. The built-in tester is useful for checking the plumbing works, but it can’t replace testing with a real location.

If you want to see what happened with a real report (not the tester): go to Edge Functions → send-push → Logs (not “Invocations” — that tab only shows request headers, not the actual result). Look for a line that starts with send-push result: right after a report goes through.

Things worth knowing

	•	iPhones are the tricky part. Push only works there if someone’s added the site to their home screen (Share → Add to Home Screen) and they’re on a recent-ish iOS version. In a normal Safari tab, the alerts button just won’t do anything. Android and desktop don’t have this restriction.
	•	The 5km radius is fixed for now. Making it adjustable per person would be a small follow-up if it’s ever wanted.
	•	Technically, anyone could call this function directly and fake an incident to spam subscribers, since it’s triggered from the browser rather than locked down server-side. This is the same level of trust the rest of the app runs on — not bulletproof, just a reasonable deterrent for now. Worth hardening later if this gets real public use.
	•	Dead subscriptions clean themselves up — if someone’s browser stops accepting pushes, the function notices and removes them automatically.
	•	No rate limiting yet. Not an issue at current traffic levels, but worth keeping in mind if this ever gets busy.

Good instinct to check before pasting — the public key being visible is totally fine (it's designed to be public), but the private key is the one thing that actually matters to keep out of a public repo.
