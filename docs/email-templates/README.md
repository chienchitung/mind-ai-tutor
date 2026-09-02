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

All three embed the same image inline as a base64 `data:image/png;base64,...`
URI - not a link to a hosted file. Two things ruled out linking to
`public/brand/mindaitutor-cover-logo.svg` by URL, which the first draft of
these templates used:

- Most email clients block remote images by default until the recipient
  clicks "show images" - the logo would be missing or broken for anyone
  who doesn't.
- It's an `<svg>` file; loaded as `<img src="...svg">` it renders in
  Gmail/Apple Mail/Outlook.com/mobile, but classic Outlook desktop (Word's
  rendering engine) doesn't support SVG images at all.

Inlining a PNG as a data URI sidesteps both - nothing to fetch, and no
SVG-in-`<img>` compatibility question. The PNG is a pixel-identical
render of `public/brand/mindaitutor-cover-logo.svg` (same icon + wordmark
paths as `BrandLogo.tsx`, verified byte-for-byte identical) at 2x scale
for retina displays, generated with headless Chromium and also committed
as `public/brand/mindaitutor-email-logo.png` for reference/reuse. To
regenerate after a real logo change: screenshot that SVG at 760x120
(2x of the 380x60 source) with a transparent background, base64-encode
the PNG, and replace the `data:image/png;base64,...` string in the
`<img src>` of all three files - keep the `width="190" height="30"` on
the tag as-is, that's just the display size.

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
