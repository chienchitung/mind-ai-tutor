# Auth email templates

Source of truth for the three emails Supabase Auth sends, kept here (not
just pasted into the Supabase dashboard) so they're reviewable and diffable
like everything else. Supabase renders these itself when it sends mail -
nothing in this repo executes them.

| File | Supabase Dashboard → Authentication → Email Templates | Fires on |
| --- | --- | --- |
| `confirm-email.html` | "Confirm signup" | New account signup |
| `reset-password.html` | "Reset password" | `resetPasswordForEmail` (Forgot password) |
| `invite-user.html` | "Invite user" | `auth.admin.inviteUserByEmail`, used by `app/api/team/invite` when inviting an email with no existing account |

## To apply

Paste each file's contents into the matching template's HTML editor in
the Supabase dashboard and save. Nothing else in the app reads these
files - updating one here doesn't change what Supabase sends until you
paste it in.

## Logo

All three load `https://www.mindaitutor.com/brand/mindaitutor-email-logo.png` -
a real hosted PNG, not the SVG and not a `data:` URI. Both of those were
tried first and both actually broke rendering, for two unrelated reasons -
worth recording so nobody swings back to either one:

- **`<img src="...cover-logo.svg">` (the SVG by URL)**: renders in Gmail/
  Apple Mail/Outlook.com/mobile, but classic Outlook desktop (Word's
  rendering engine) has no SVG support at all.
- **`<img src="data:image/png;base64,...">` (inlined, tried next)**:
  Gmail - the client that matters most here - strips `data:` URIs from
  HTML email bodies outright as an anti-spam measure. Confirmed via a
  real received email: broken-image icon, `alt` text shown instead.
  This is a known, long-standing Gmail limitation, not a bug in the PNG
  or the encoding.

A normal hosted PNG is the only one of the three that has no known gap:
every major client fetches ordinary remote images (Gmail proxies them
through its own image cache rather than blocking them, unlike `data:`
URIs), and PNG needs no SVG support. The tradeoff is the one every
hosted-image approach has - the image only appears once
`mindaitutor-email-logo.png` is actually deployed and reachable at that
URL, and remote images still start "blocked, click to show" for
recipients whose mail client defaults that way (most don't, for images
from a sender with clean SPF/DKIM, which the Resend setup covers) - both
far smaller gaps than the alternatives above covered.

The PNG is a pixel-identical render of
`public/brand/mindaitutor-cover-logo.svg` (same icon + wordmark paths as
`BrandLogo.tsx`, verified byte-for-byte identical) at 2x scale for retina
displays, generated with headless Chromium, committed at
`public/brand/mindaitutor-email-logo.png`. To regenerate after a real
logo change: screenshot that SVG at 760x120 (2x of the 380x60 source)
with a transparent background, save over that PNG, and redeploy - the
`<img src>` URL and its `width="190" height="30"` don't need to change.

## Variables

Supabase's template variables are fixed per email type - `{{ .UserName }}`,
`{{ .UserEmail }}` and `{{ .CurrentDate }}` (used in an earlier draft of
the reset-password template) are **not** real Supabase variables and
render as empty strings. Only these are valid:

- All three: `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .SiteURL }}`
- `invite-user.html` only: `{{ .Data.inviter_email }}` and
  `{{ .Data.team_name }}` - populated by `app/api/team/invite/route.ts`'s
  call to `inviteUserByEmail(email, { data: {...} })`. Both are guarded
  with `{{ if }}` in the template, so a missing team name (lookup failed,
  or the field is renamed later) degrades to generic wording instead of
  a blank gap.
