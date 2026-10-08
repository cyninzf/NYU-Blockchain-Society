# NYU Blockchain Society — Website

Repo: https://github.com/cyninzf/NYU-Blockchain-Society
Maintainer: Fang. Co-leads: two society organizers (names kept out of this public repo).

## Public repo rules
- Never commit secrets: database URLs, passwords, API keys. Use .env.local locally and Vercel environment variables in production. Provide a .env.example with empty values only.
- Never commit member data: no CSVs, Luma exports, spreadsheets, or real names/emails in seed data or tests. Use obviously fake test data (e.g. test@example.com).
- Never put personal contact details of organizers or members in code or docs.

## The spec
`docs/prototype.html` is the approved design. Match it closely: layout, copy, colors, type, motion and the hero interaction. Port it; don't redesign it. When unsure, open it in a browser and compare.

## Stack
- Next.js (App Router) + TypeScript, deployed on Vercel (auto-deploy from `main`, previews on PRs)
- Styling: plain CSS ported from the prototype (`app/globals.css` + CSS Modules). No Tailwind, no UI kit.
- Fonts: Geist + Geist Mono via `next/font/google`
- Hero animation: a `"use client"` component wrapping the prototype's canvas code (no three.js needed)
- Database (phase 1): Postgres via the Vercel Marketplace (Neon), accessed with Drizzle ORM (`lib/db/`)
- Migrations: `npm run db:generate` creates SQL in `drizzle/`; `npm run build` runs `drizzle-kit migrate` (never `push`) before `next build`, so each Vercel deployment migrates its own database (preview → its Neon branch, production → main). Locally without `DATABASE_URL` the step is skipped.
- No local database and no Vercel CLI in Codespaces. Verify database features on the preview deployment only.
- Next 16: auth for `/admin` lives in `proxy.ts` (the renamed middleware).
- Domain stays registered at Wix; DNS will point to Vercel later. Don't build anything on Wix.

## Commands
- `npm run dev`: dev server (Codespaces: open forwarded port 3000)
- `npm run build`: must pass before every commit
- `npm run lint`

## Positioning (decided)
- Headline: "Blockchain, finance & AI."
- Mission: NYU Blockchain Society is the professional network for NYU alumni at the intersection of blockchain, finance, and AI. We bring together the institutions, builders, investors, and policymakers shaping what comes next, connect alumni with the next generation of talent, and help NYU founders build.
- Audience: alumni and industry professionals first. Students are welcome at events, but this is not a student club.
- Mentorship and the accelerator are "Building" (in development). Never present them as live.

## Brand (decided)
- Base: deep NYU violet night (#1C0533 → #3A0A63), NYU Violet #57068C, glow #9B4DDB, lilac #D8C2F0. Tokens are in the prototype's `:root`.
- Logo: three isometric blocks drawn as a network ("node stack"). Files in `public/brand/`:
  - `mark-node-white.svg` / `mark-node-violet.svg`: nav, hero, slides, 48px and up
  - `mark-solid-white.svg` / `mark-solid-violet.svg`: small sizes under 48px
  - `favicon.svg`: favicon / app icon; `avatar.svg`: X and LinkedIn avatar
- The three blocks represent Blockchain (top), Finance and AI. Headline words and blocks are linked: hovering either highlights the other.

## Pages and sections (v1)
Home only, in prototype order (plus `/admin`). The top is a pinned story: the 3D blocks stay fixed (`position: sticky`) while the centered hero, the mission, and one step per industry (Blockchain → Finance → AI) scroll past. Each step lights its block. The pin then releases, followed by "The chain so far" (events and programs as blocks) → conference (stats, firms, program) → network wall (once it has 12 approved entries) → join → footer. Keep the pinned section about this length: never hijack scroll speed, and keep it readable with reduced motion.
All editable content lives in `/content` as typed TS data: `events.ts`, `program.ts`, `firms.ts`, `industries.ts`.

## Confirmed facts (use exactly)
- Conference: NYU Blockchain Conference 2024, November 1, 2024, New York University, 44 West 4th Street. 632 registrations (never say "attendees"), 35 speakers and moderators, 7 panels plus a fireside. Do not name any NYU school as host. Program, moderators and speakers are in `content/program.ts`; never invent titles.
- Links: X https://x.com/NYU_Blockchain · LinkedIn group https://www.linkedin.com/groups/8652445/ · NYU Alumni https://www.nyu.edu/alumni/get-involved/alumni-clubs/special-interest-clubs/nyu-blockchain-society.html

## Phase 1 app: "Add your block" (join in the hero)
Built. See "Decided" below for the flow, data model and admin.
- Not built yet: welcome email and magic link for editing later (Resend). Until then, a member edits by re-joining with the same email, which can only fill empty fields.

## Phase 2 (don't build yet)
An opt-in public directory and the live network map, where the hero lattice shows real members clustered by industry. Turn the map on at about 50 members. Members never need an account to join. To view or edit their own entry they get an email magic link (passwordless, via Auth.js). Optional extras later: "Continue with LinkedIn" as a convenience, and wallet sign-in only for onchain features such as event attendance badges. Never make either one required.

## Decided
Type and layout
- Hero headline `clamp(36px, 5.3vw, 120px)`. Subtitle and CTAs must stay above the fold at 1440×900 and 1280×720. Join heading `clamp(36px, 5.6vw, 90px)` with tight section padding. Mission one step down; story text is capped so it never overlaps the 3D blocks. Check 390, 1024, 1280 and 1440 px.
- The pinned story releases exactly when it ends (negative margin on the content layer, not on the pin).
- The HUD ("New York · time ET · Hover a block · drag to rotate") shows only over the hero and fades out on scroll.
- Background: a sparse field of tiny wireframe node-stack cubes with faint links, slow drift and slight parallax. Very low opacity; the hero blocks stay the focal point. Static under reduced motion; the render loop pauses when the tab is hidden or the canvas is off-screen.

Content
- Under the hero subtitle: "An official NYU Alumni special-interest club ↗" linking to the NYU Alumni page (new tab, rel="noopener"). Text only, never NYU logos. Keep the footer link.
- No bracket placeholders in `/content`.
- "The chain so far": every block is clickable (the whole card), and hover/focus lights the edge to the next block.
  - Block 00 · Done · NYU Blockchain Conference: scrolls to the conference section.
  - Block 01 · Networking Nights, the recurring alumni networking series, driven by `networkingNights` in `content/events.ts` (`nextDate`, `venue`, `lumaUrl`, all optional). With a date and a Luma URL it shows "Upcoming" and opens Luma; otherwise "Next date soon" and opens the join flow with `notify=networking`. Clear the fields after each event.
  - Block 02 Mentorship and Block 03 Accelerator · Building · "Get notified" opens the join flow with `notify=mentorship` / `notify=accelerator`.
- Conference section: "NYU Blockchain Conference 2024" with date and address, a "Speakers came from" text wordmark list, and program rows as native disclosures listing moderator and speakers.
- The two society co-leads who moderated (15:00, 16:00) are listed by firm only: Light Node Ventures, Harmonic Chain Digital. Never add their names.

Join flow ("Add your block")
- Joining = building your block onto the chain. One question per step, Enter advances, Back always available, one-handed on mobile: 1) blocks (multi-select, skippable, via chips or the logo), 2) name, 3) email, 4) "You are…" one tap: Alumni / Student / Faculty-Staff / Friend of NYU.
- Each completed step draws a node and edge toward the chain in the hero; on success the block snaps on. Copy: "Block #<n> added. You're on the chain." (n = join order = `members.id`), plus "We'll tell you when <Program> launches." when the person came from a notify block.
- One line under the final step, no checkbox: "By joining, organizers may email you about events and programs. Unsubscribe anytime. Only organizers see your details."
- Optional "Strengthen your block": LinkedIn URL, role and company, NYU school and grad year, and "Show my name on the network wall" with a display name. Each saves on its own; skipping is fine.
- Entry points: nav "Join", hero "Join the network", join section and footer "Add your block", and the Networking/Building blocks (with notify). `?src=<event>` is stored as the member's source.
- While the flow is open the lede is hidden (and the headline on mobile) so each question sits under the visual.

Data and security
- `members`: id serial (= block number), name, email (unique on `lower(email)`), affiliation enum, blocks text[], notify text[], source, linkedin_url, role, company, school, grad_year, show_on_wall (default false), wall_name, wall_approved (default false), created_at, updated_at. `rate_limit_hits` backs rate limiting.
- Re-submitting an existing email updates that row and keeps its block number; the response is identical, so it never reveals whether an email exists. Follow-up "Strengthen" edits for an existing email can only fill empty fields.
- Server actions with zod, a honeypot, a signed minimum-fill-time token, and Postgres rate limiting keyed by an HMAC of the IP. Never store raw IPs. `FORM_SECRET` is optional (falls back to `DATABASE_URL`).
- Without `DATABASE_URL` outside Vercel, the flow shows a clear local-only message instead of failing.

Network wall and admin
- Network wall shows only rows with `show_on_wall` AND `wall_approved`, as small blocks (wall name + block glyph). Hidden entirely until at least 12 approved entries exist. Cached with tag `wall`; admin changes refresh it.
- `/admin` (basic auth via `ADMIN_USER` / `ADMIN_PASS` in `proxy.ts`, re-checked in admin actions and the export route; noindex): member table filtered by affiliation, block, notify and wall status; approve/unapprove wall entries; delete a member for removal requests; CSV export (formula-safe).

## Rules
- Never invent facts, people, numbers, sponsors or partners. If something is unknown, leave it out or ask the maintainer.
- No company logos for speaker firms. Names as text only.
- Accessibility: real buttons and links, visible focus, AA contrast, respect `prefers-reduced-motion` (the prototype already handles this).
- Mobile-first. Check at 390px width.
- Small commits with clear messages. Update this file when a decision changes.
