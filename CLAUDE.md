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
- Database (phase 1): Postgres via the Vercel Marketplace (Neon), accessed with Drizzle ORM
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
Home only, in prototype order. The top is a pinned story: the 3D blocks stay fixed (`position: sticky`) while the centered hero, the mission, and one step per industry (Blockchain → Finance → AI) scroll past. Each step lights its block. The pin then releases, followed by "The chain so far" (events and programs as blocks) → conference (stats, firms, program) → join → footer. Keep the pinned section about this length: never hijack scroll speed, and keep it readable with reduced motion.
All editable content lives in `/content` as typed TS data: `events.ts`, `program.ts`, `firms.ts`, `industries.ts`.

## Confirmed facts (use exactly)
- Conference: 632 registrations (never say "attendees"), 35 speakers and moderators, 7 panels plus a fireside. Session times and firms are in the prototype.
- Fall Mixer registration: https://luma.com/dwb1s0gv
- Links: X https://x.com/NYU_Blockchain · LinkedIn group https://www.linkedin.com/groups/8652445/ · NYU Alumni https://www.nyu.edu/alumni/get-involved/alumni-clubs/special-interest-clubs/nyu-blockchain-society.html
- TODO (keep the bracket placeholders until confirmed): conference year, Fall Mixer date and venue

## Phase 1 app: "Add your block" (join in the hero)
- The join flow lives in the hero, exactly as in the prototype. Step 1: pick blocks (Blockchain / Finance / AI) with the buttons or by tapping the cubes. Step 2: name and email, then "Add your block". The new member's node flies into the network and links to their blocks.
- Optional step 3, "Tell us more": firm, role, LinkedIn URL, and involvement (mentor / speak / hire / invest / attend). It's skippable and can be completed later via the email link.
- Every "Join" CTA opens this flow. Support `?src=<event>` (e.g. a QR code at the Fall Mixer) and store it as the member's source.
- Store in Postgres (`members` table). Server Action with zod validation, a honeypot field, rate limiting, and de-duplication by email. Send a welcome email with a magic link for editing later (Resend).
- Privacy line on the form: details are seen only by the society's organizers and used to run events and programs. TODO: final wording from the maintainer.
- `/admin`: list, filter by industry and source, and CSV export. Protected by HTTP basic auth in middleware (`ADMIN_USER` / `ADMIN_PASS`).
- Remove the prototype's "preview" wording and its localStorage-only behavior once the backend is wired up.

## Phase 2 (don't build yet)
An opt-in public directory and the live network map, where the hero lattice shows real members clustered by industry. Turn the map on at about 50 members. Members never need an account to join. To view or edit their own entry they get an email magic link (passwordless, via Auth.js). Optional extras later: "Continue with LinkedIn" as a convenience, and wallet sign-in only for onchain features such as event attendance badges. Never make either one required.

## Rules
- Never invent facts, people, numbers, sponsors or partners. Use `[placeholder]` and list it for the maintainer.
- No company logos for speaker firms. Names as text only.
- Accessibility: real buttons and links, visible focus, AA contrast, respect `prefers-reduced-motion` (the prototype already handles this).
- Mobile-first. Check at 390px width.
- Small commits with clear messages. Update this file when a decision changes.
