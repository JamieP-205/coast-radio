# The website editor

Jim signs in at https://coastinternetradio.com/admin/ to change the website himself.

## What Jim can change

- **Words:** the headline, welcome message, sign-off, About Jim, support message, page introductions and the footer line.
- **Photos:** the studio photo on the home page and the photo on About Jim. Photos are made smaller in the browser before they're uploaded.
- **Colours:** Coast navy, sea green, heather or charcoal. The red stays the same because it's in the logo.
- **Home page layout:** move Just played, News and the welcome message up or down, or hide them.
- **Announcement:** a red bar across the top of every page, with an optional link.
- **News:** one short story on the home page.
- **Show times and going live:** the weekly shows, plus a switch for "I'm live now" (3 hours) or "No live show today" (until midnight).
- **Contact details:** the phone number, email, Facebook, X and PayPal links shown on the site.

Changes save as a draft while Jim types and show straight away in the preview. Listeners only see them after he presses **Publish changes**. **Undo last publish** puts back the version before, up to the last 10 publishes, and undoing the first publish puts the website back to how it was built.

## Setting it up on Netlify

1. Choose a new password for Jim, at least 12 characters. Don't reuse the old site's password.
2. In the project folder, run:

   ```
   npm run hash-password
   ```

   Type the password when asked. It prints `ADMIN_PASSWORD_HASH` and `SESSION_SECRET`. The password itself is never saved anywhere.
3. In Netlify, open the project, then **Project configuration > Environment variables**, and add:

   | Key | Value |
   |---|---|
   | `ADMIN_USERNAME` | The username Jim will type |
   | `ADMIN_PASSWORD_HASH` | From step 2 |
   | `SESSION_SECRET` | From step 2 |

   Mark the last two as secret.
4. Deploy. Environment variables only reach the functions after a new deploy.
5. Sign in at `/admin/` and check the preview loads.

Give Jim the password in person or by phone, not by email or text.

## Changing the password

Run `npm run hash-password` again, replace `ADMIN_PASSWORD_HASH` in Netlify and redeploy. Replacing `SESSION_SECRET` as well signs out every browser that's signed in.

## How it works

| Address | What it does |
|---|---|
| `GET /api/content` | The published version, cached by Netlify's CDN for up to 5 minutes and cleared on every publish |
| `POST /api/login`, `POST /api/logout`, `GET /api/session` | Sign in and out |
| `GET`/`PUT /api/draft` | Load and save Jim's draft |
| `POST /api/publish`, `POST /api/undo` | Publish the draft, or go back one version |
| `POST /api/photos`, `GET /api/photos/:id` | Upload and serve Jim's photos |

- Everything is stored in Netlify Blobs: `coast-site` holds the draft, the published version, the last 10 versions and sign-in attempts, and `coast-photos` holds uploaded photos.
- Every draft is checked by `netlify/lib/content.mjs` before it's saved. Unknown fields are dropped, text has length limits, links must be `https://`, and photos must come from the site itself, so nothing Jim types can add code to the page.
- The site's own script applies published content with `textContent` and plain attributes, never as HTML.
- Sign-in uses a scrypt hash of the password and a signed, HttpOnly cookie that lasts 30 days. Five wrong tries from one connection pause sign-in for 15 minutes. Anything that changes the site must also come from the site's own pages.
- The editor shows the real website in a frame at `/?preview`. The page then waits for content from the editor instead of loading the published version, and tells the editor what Jim clicks on.

## If something goes wrong

- **"The editor hasn't been set up yet."** One of the three environment variables is missing, or the site hasn't been redeployed since they were added.
- **Changes don't appear for listeners.** Publishing clears Netlify's cached copy, but if that fails the copy refreshes itself within 5 minutes.
- **Jim is locked out after wrong passwords.** Wait 15 minutes, or delete the `login-tries/...` entry in the `coast-site` store under **Blobs** in Netlify.
