# Auth Email Templates

Themed HTML for all Supabase auth emails (confirm signup, invite, reset password, magic link, email change, reauthentication, and security notifications).

## Apply to your hosted project

### Option A: Sync script (requires Supabase platform role)

The script uses the [Management API](https://supabase.com/docs/reference/api/v1-update-auth-service-config) to push templates. It only works if your **Supabase account** has **Owner** or **Administrator** on the **organization/project** (not “admin” inside your app). See [Access control](https://supabase.com/docs/guides/platform/access-control).

1. Create a **Personal Access Token** at [Supabase Dashboard → Account → Access Tokens](https://supabase.com/dashboard/account/tokens) (use the same account that owns or administers the project).
2. From the project root run:
   ```bash
   SUPABASE_ACCESS_TOKEN=your_token_here npm run sync-email-templates
   ```
   Your project ref is read from `supabase/config.toml` (`project_id`). To override: `PROJECT_REF=other_ref npm run sync-email-templates`.

If you get **403 “does not have the necessary privileges”**, your token’s account is not Owner/Administrator for that project. Use Option B below.

### Option B: Dashboard (no special role)

1. Open **Supabase Dashboard** → your project → **Authentication** → **Email Templates**.
2. For each template (Confirm signup, Invite, Recovery, etc.), set the **Subject** and paste the contents of the matching file from `supabase/auth-email-templates/` into **Message (HTML)** (e.g. `confirm-signup.html` for Confirm signup).
3. Save each template.

## Local development

If you use `supabase start`, templates are already wired in `supabase/config.toml`. Restart with `supabase stop && supabase start` after changing HTML.

## Templates included

| File | Used for |
|------|----------|
| confirm-signup.html | Confirm sign up |
| invite.html | Invite user |
| recovery.html | Reset password |
| magic-link.html | OTP sign-in (6-digit code; used for franchisee and admin login) |
| email-change.html | Confirm email change |
| reauthentication.html | Reauthentication (OTP) |
| password-changed.html | Security: password changed |
| email-changed.html | Security: email changed |

## Customizing

- **Brand name:** Search for "Ignite Franchise Portal" in the HTML and replace with your brand.
- **Colors:** Header/button use `#18181b`. Change to match your brand.
- **Logo:** Add `<img src="https://your-domain.com/logo.png" alt="Logo" width="120" style="display:block; margin:0 auto;" />` in the header `<td>` of any template.
