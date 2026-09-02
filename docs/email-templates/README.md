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

All three use the same asset: `https://www.mindaitutor.com/brand/mindaitutor-cover-logo.svg`
(the repo's `public/brand/mindaitutor-cover-logo.svg` - the same icon +
wordmark lockup as `BrandLogo.tsx`, deployed and publicly reachable once
this branch ships), loaded via `<img>` rather than inlined as `<svg>` -
inline SVG is stripped by several major email clients. Renders correctly
in Gmail, Apple Mail, Outlook.com, and mobile mail apps; classic Outlook
desktop (Word's rendering engine) does not support SVG images and will
show the `alt` text ("MindAiTutor") instead of the logo. If that
audience matters, replace the `<img src>` in all three files with a
hosted PNG export of the same asset - regenerating one wasn't something
this session could do without image tooling.

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
