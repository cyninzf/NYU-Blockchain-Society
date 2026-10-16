# Testing checklist

Run on production (https://www.nyublockchainsociety.com) after a deploy that touches email,
sign-in, members or events. Use your own inbox; never test with real members' addresses. Admin sign-in
is by email link only (basic auth was removed in round 10).

## 1. Admin sign-in and team: `/admin/login`, `/admin/team`

- [ ] Request a link with the super admin email. The page says the same thing for any email.
- [ ] The email arrives from hello@nyublockchainsociety.com; its link opens a page with a
      "Sign in" button (nothing happens until you press it).
- [ ] After signing in, the header shows your email and "Super admin".
- [ ] Opening the same link again says it has expired or was already used.
- [ ] At `/admin/team`, add the other two organizers (role Admin or Super admin). The recovery
      super admin shows masked and can't be changed.
- [ ] Each organizer signs in on their own device. An Admin doesn't see the Team or Media kit
      preview tabs or the Import button on Contacts, and opening `/admin/team` directly says it's for super admins.
- [ ] "Sign out", then use the browser's back button: the admin pages ask you to sign in again.

## 2. Join, welcome email, update and unsubscribe: `/`, `/update`, `/unsubscribe`

- [ ] On the home page, "Join the network" with an address you own. While there are fewer than
      50 members, the success says "Block added. You're on the chain." (no number).
- [ ] One welcome email arrives (same heading), with "Update your block" and "Unsubscribe".
      Joining again with the same email sends nothing.
- [ ] "Update your block" → enter your email → the link → "Continue" → change a block and the
      city → "Saved." The change shows in `/admin` for that member.
- [ ] "Unsubscribe" in the email → press the button → "You're unsubscribed." Requesting an
      update link for that email now sends nothing. "Resubscribe" undoes it.
- [ ] Delete the test member afterwards (super admin, `/admin`, Delete).

## 3. Announcements: `/admin/announcements`

- [ ] Write a subject and two paragraphs; pick filters; the recipient count and "emails left
      today" update.
- [ ] "Send a test to me": the test arrives marked "[Test]", paragraphs intact, unsubscribe link
      at the bottom.
- [ ] Don't press "Send to N members" unless you mean to: it emails real members.
- [ ] Edit the text without a new test, then try to send: it's refused ("send yourself a test").

## 4. Audit log: `/admin/audit`

- [ ] As a super admin: your sign-in, the team changes, the test send and the test member's
      delete are listed with your email.
- [ ] As an Admin: only your own actions are listed.

## 5. Public pages: `/media-kit`, `/api/chain`

- [ ] `/media-kit` shows the Boilerplate section with no "Draft" tag; Copy works.
- [ ] `/api/chain` returns `{"stats":null}` while there are fewer than 50 members (no count of any
      kind), and the home page has no "blocks on the chain" section.
- [ ] No member names appear on any public page.

## 6. Events: `/admin/events`, `/networking`, Block 01

Use an obviously fake test event (e.g. "Test event", venue "Example Venue") dated a few days
ahead, and delete it at the end.

- [ ] `/admin/events` → "New event": title, label "Networking evening", start and end time, venue,
      no registration link → "Create draft". The edit page says "Draft".
- [ ] While it's a draft: `/networking` doesn't list it, `/networking/<link name>` is a 404, and the home
      page's Block 01 doesn't show it. "Preview as it will appear" shows it with the preview banner;
      signed out, the preview URL is a 404.
- [ ] "Publish". `/networking/<link name>` shows "Networking evening" above the title, the date and time
      in ET, the venue, "Registration opens soon" and "Join the society to get the invite"; no
      background lines or blocks run behind the text (check at 390 px and on a laptop).
- [ ] Home page, The chain: Block 01 shows the event with "Registration opens soon" and "Join the
      society to get the invite". Clearing the label in the admin form makes the page say "Event".
- [ ] Add a registration link (https://lu.ma/…) and save: the event page and Block 01 now show
      "Register", opening that link in a new tab.
- [ ] Copy the share link from `/admin/events` and open it in a private window. Join with an
      address you own: in `/admin`, that member's source is `event-<link name>`, and the events
      list shows "Joined from the share link: 1". Delete the test member afterwards.
- [ ] "Cancel event": the event page and `/networking` say "Cancelled"; Block 01 shows it marked
      "Cancelled" with "Get notified" (or the next published event, if there is one).
- [ ] `/sitemap.xml` lists `/networking/<link name>` while it's public.
- [ ] `/admin/audit` lists `event.create`, `event.edit`, `event.publish` and `event.cancel`.
- [ ] Sign in as an Admin (not a super admin) on another device: `/admin/events` lists the
      events with "View" links and a "View only" note, and has no "New event", Publish, Cancel or
      Delete; the event page's form is greyed out with no Save; "Preview as it will appear" still
      works; `/admin/events/new` says it's for super admins. An event change sent anyway (e.g. a
      replayed request) gets a 403 "Not allowed", and the Admin's `/admin/audit` shows a `denied`
      row for it.
- [ ] As a super admin, "Delete" the test event; it's gone from `/networking` and `/admin/events`, and
      `event.delete` is in the audit log.

## 7. Check-in, QR, live screen, calendar and share previews

Everything here runs on a **draft** test event in test mode, so nothing is published. Create a
fake draft (e.g. "Test event", venue "Example Venue"), any date. Test check-ins are stored apart,
never counted, and cleared at the end.

- [ ] While it's a draft and you're signed out (private window): `/networking/<link name>/checkin`,
      `/networking/<link name>/checkin?test=1` and `/networking/<link name>/live` are 404s.
- [ ] Signed in as a super admin, `/admin/events/<id>` shows "Test mode" with "Check-in (test
      mode)" and "Live screen (test mode)". Open check-in in test mode: "Test mode" banner, and
      check-in works even though it's a draft and outside the window.
- [ ] Test join, default path: enter a new address, then the join form without ticking "Create a
      real member": "Test mode: nothing was created…". `/admin` has no new member.
- [ ] Test join, real path: tick "Create a real member" with an address you own: "You're checked
      in. Welcome." The member exists (source `event-<link name>`) and the event page lists them
      under "Test check-ins", not in "Check-ins".
- [ ] One-tap link in test mode: with a member address you own, the email arrives as "[Test]
      Check in: …"; its page shows the banner; "Check in" records a test check-in.
- [ ] Live screen (test mode), in another tab: banner, title, and with `count=1` "<n> checked in
      tonight" counting test check-ins only. A new test check-in adds a node with a glow within
      ~5 s.
- [ ] As an Admin (not super), `?test=1` on the draft is a 404, and calling a test action anyway
      (e.g. a replayed request) gets a 403 and a `denied` row in their audit log.
- [ ] "Clear test check-ins" empties the test list; `/admin/audit` shows
      `event.checkin.clear_tests`.
- [ ] Calendar and share preview (draft-safe): the "Preview as it will appear" page shows "Add to
      calendar" (Google and Outlook open with the title, time in ET, address and description).
      The share image and `.ics` only exist once published, so check them on the real event:
      paste `/networking/<link name>` into a link preview checker (or an unposted LinkedIn / X draft)
      and download `/networking/<link name>/calendar.ics`.
- [ ] QR and display link (once the real event is published): `/admin/events/<id>` shows the QR
      (scan it: it opens check-in), PNG / SVG downloads and the printable page. "Create display
      link" shows a URL once: on the TV, it opens the live screen without signing in, only from
      3 hours before the start until 2 hours after the end ("Not live right now" otherwise);
      "Revoke" stops it at once ("This display link doesn't work"). Both are in `/admin/audit`.
- [ ] Clean up: clear the test check-ins, delete the test members (super admin, `/admin`) and the
      draft.

## 8. Invites to contacts: `/admin/settings`, `/admin/contacts/invite`

Use one fake contact with your own address (never a real contact's) and a source label of its
own, so the campaign can only ever reach you. Do the real send on production only once you're
sure; tests work on a preview too. Vercel needs `CRON_SECRET` and `RESEND_WEBHOOK_SECRET` set,
and a Resend webhook (email.bounced, email.complained) pointing at `/api/resend/webhook`.

- [ ] As an Admin (not super): `/admin/contacts` shows the Invite column read-only, with no Invite
      button; `/admin/contacts/invite` and `/admin/settings` say they're for super admins.
- [ ] `/admin/contacts/invite` with no postal address: a red note, and both send buttons are off.
      Set the address in `/admin/settings`; `/admin/audit` shows `settings.edit`.
- [ ] Make a one-row CSV `name,email` with your name and an address you own (a "+invite" alias
      works), import it at `/admin/contacts/import` with the source `invite-test-<today>`.
      `/admin/contacts?source=invite-test-<today>` shows it as "Eligible".
- [ ] In `/admin/contacts/invite`, pick that source (1 eligible) and, optionally, an upcoming
      published event. Edit the text: the preview updates. "Send to 1 contact" before any test
      is refused ("Send yourself a test…").
- [ ] "Send a test to me": it arrives marked "[Test]" from hello@nyublockchainsociety.com, with
      the 2024 conference line, the one-liner, the featured event (title, date, venue, "Members
      get the invite first"), the reason, an unsubscribe link and the postal address.
- [ ] Production only: "Send to 1 contact" → confirm. The campaign shows Sent 1 and "Done"; the
      contact shows "Invited" with the date; `/admin/audit` has `invite.test`, `invite.campaign`
      and `invite.batch`. Sending again finds 0 eligible (once ever).
- [ ] The invite arrives: "Hi <first name>," and the join button. Open it in a private window:
      the join flow opens with your address pre-filled, and the URL no longer shows the token.
      Join (any address): the contact shows "Joined" and "auto (invite)". Opening the same
      invite link again doesn't pre-fill (single use).
- [ ] Unsubscribe instead (second fake contact, same steps): the link's page unsubscribes on
      the button press ("You won't get another invitation"), with no Resubscribe. The contact
      shows "Unsubscribed"; re-importing the same address in a new source still shows
      "Unsubscribed" and is never eligible.
- [ ] Pause / Resume on a queued campaign switches its status, logged as `invite.pause` /
      `invite.resume`.
- [ ] Clean up: delete the fake contacts and any test member (super admin).

## 9. Conference 2027 hub and inquiries: `/conference`, `/admin/inquiries`

- [ ] `/conference` shows "NYU Blockchain Conference 2027" and "Planning underway", with no date,
      month, venue or speakers. "The first edition" shows November 1, 2024 · New York University,
      632 registrations, 35 speakers and moderators, 7 panels plus a fireside (never
      "attendees"), and "See the 2024 program" opens `/conference/2024`, which is unchanged.
- [ ] Home page, The chain: Block 00's last chip reads "Next: 2027 · Planning underway" and opens
      `/conference`.
- [ ] "Get notified" in a private window: the join flow opens with conference updates picked.
      Join with an address you own: the success screen says "We'll tell you when the next
      conference is announced." and `/admin` shows notify "conference" and source
      `conference-2027`.
- [ ] In the same browser, reload `/conference`: the note "You're already on the chain…" with a
      link to `/update` appears under the button.
- [ ] Share preview: paste `/conference` into a link preview checker (or an unposted LinkedIn /
      X draft): title "NYU Blockchain Conference 2027", "Planning underway", no date.
- [ ] Inquiry form: send a message as "Sponsor" with an address you own and a message under
      1,000 characters (the counter shows the length): "Thank you…" on screen; no email to that
      address. The super admin inbox gets "Conference 2027 inquiry (Sponsor): <name>"; pressing
      Reply addresses the inquirer.
- [ ] Sending immediately after loading the page, or more than 5 in an hour, shows the normal
      thank-you or "Too many messages" respectively, and stores nothing extra.
- [ ] `/admin/inquiries`: the message is listed. As an Admin it's read-only; as a super admin,
      set it to "Replied": `/admin/audit` shows `inquiry.status` new → replied. The inquirer is
      not in Members or Contacts.
- [ ] Clean up: delete the test member (super admin, `/admin`). Inquiries stay as a record (there
      is no delete).

## 10. Accelerator: `/accelerator`, `/admin/inquiries/accelerator`

Use addresses you own. Wait a few seconds after the page loads before sending (faster sends are
treated as bots: they see the thank-you and nothing is stored).

- [ ] `/accelerator` shows "Block 02 · Accelerator · Building", the title "Accelerator" and one
      paragraph, with no funding, equity, cohort, date or perk promises. The two path cards
      ("I'm a founder", "I want to mentor, invest or partner") jump to their forms.
- [ ] Home page, The chain: Block 02's card opens `/accelerator`; its "Get notified" button
      still opens the join flow instead.
- [ ] Share preview: paste `/accelerator` into a link preview checker: "Accelerator", "Block 02 ·
      Building", no date; the description is the accelerator one.
- [ ] Founder form, checkbox unticked: fill every field (Focus: two of them; Website:
      `example.com`). "Thank you…" on screen; no email to that address. The super admin inbox
      gets "Accelerator founder: <name> (<company>)" with stage, focus and `https://example.com`;
      Reply addresses the founder. They are not in Members or Contacts.
- [ ] Founder form validation: no focus, no stage or a website like `not a site` shows a clear
      error and keeps what was typed.
- [ ] Founder form with "Also add me as a member" ticked and a new address: the inbox gets the
      welcome email ("Block added. You're on the chain." plus "We'll tell you when the
      Accelerator launches."); `/admin` shows the member with blocks = the focus picked, notify
      "accelerator" and source `accelerator-founder`. The notification says "They also asked to
      be added as a member."
- [ ] Same, with an address that is already a member: the same thank-you, no second welcome
      email, and that member now also has notify "accelerator" (source unchanged).
- [ ] Supporter form: Mentor + Invest, message left empty: "Thank you…"; the inbox gets
      "Accelerator supporter: <name>"; Reply addresses the supporter.
- [ ] More than 5 sends in an hour from one network (both forms count together) shows "Too many
      messages from here"; a fourth send in a day with one email shows "We already have your
      details".
- [ ] `/admin/inquiries` has sub-tabs Conference · Accelerator. On Accelerator, filter by type
      (Founders / Supporters), stage, focus and status: each narrows the list as expected.
- [ ] As an Admin: read-only (a status badge, no Save, no Export CSV).
- [ ] As a super admin: set the founder to "Contacted": `/admin/audit` shows
      `accelerator.status` new → contacted. "Export CSV" downloads the filtered rows and logs
      `export.accelerator`.
- [ ] Clean up: delete the test member (super admin, `/admin`). Interest rows stay as a record
      (there is no delete).

### Nav, chain blocks and "Get notified" (rounds 14 and 15)

- [ ] At 1440 px the nav reads The chain · Conference · Accelerator · Join. Conference is
      underlined on `/conference` and `/conference/2024`; Accelerator on `/accelerator`.
- [ ] At 390 px (and anything up to 900 px) only the brand, Join and the menu button show. Open the
      menu: its top row looks exactly like the header (brand, Join in the same place, Close where
      the menu button was), followed by The chain, Conference, Accelerator only (no Networking,
      Media kit or "Add your block"). Join from the menu opens the join flow. With the keyboard:
      Tab to the menu button, Enter opens the sheet; Tab stays inside it; Esc closes it and focus
      returns to the button. A screen reader announces "Menu, button, collapsed".
- [ ] The footer shows The chain, Conference, Networking, Accelerator and Media kit (desktop and
      phone).
- [ ] Home page, The chain: clicking the title or the text of each card opens its page (Block 00
      → `/conference`, Block 01 → the events page, Block 02 → `/accelerator`), with the pointer
      cursor and glowing edges on hover for all three. Each card ends with the same text link and
      a white "Get notified" button. The 2024 and 2027 chips and an event's title open their own
      pages, not the card's.
- [ ] Tab through the chain: each card gives exactly its inner links (chips, event title), the
      text link, then "Get notified"; the focused card shows an outline.
- [ ] Private window: each "Get notified" opens the join flow with its line above "Which blocks do
      you work in?" ("…upcoming networking events", "…the accelerator", "…when the next
      conference is announced"). Join from Block 01: `/admin` shows notify "networking" and
      source `chain-networking` (Block 02: `chain-accelerator`; Block 00: `chain-conference`).
- [ ] With a published upcoming event, Block 01 shows "Next: <title> · <date> · <venue>" plus the
      same two actions (no Register button on the card; it's on the event page).
- [ ] Sign in through "Update your block" (`/update`), then open the home page in that browser:
      each block shows "You're on the list for …" with "Update your block" for programs you
      picked, and "You're a member. Add … to your updates" for ones you didn't, instead of
      "Get notified".

## 11. Canonical URLs: `/networking` (round 15)

- [ ] `/networking` is headed "Networking" with "Upcoming" (and "Past" once there are past
      events). Block 01's card and "See all events", and the footer's "Networking", open it.
- [ ] Old links redirect permanently (308) with the query kept: `/events` → `/networking`;
      `/events/<slug>?src=event-<slug>` → `/networking/<slug>?src=event-<slug>` (join from there:
      source `event-<slug>`); `/events/<slug>/checkin`, `/events/<slug>/live?d=<display token>`,
      `/events/<slug>/calendar.ics` and an old check-in email link all land on the `/networking`
      version and work.
- [ ] In `/admin/events/<id>`: "Public page", "Preview", the share link, "Check-in (test mode)",
      "Live screen (test mode)", a new display link and the QR (scan it) all use `/networking/…`.
      The check-in email's button links to `/networking/<slug>/checkin/confirm`.
- [ ] `/sitemap.xml` lists `/networking` and `/networking/<slug>` only (no `/events`). An event
      page's canonical tag, og:url and JSON-LD url are `/networking/<slug>`; its share image loads.

> Verified on production by the maintainer on October 11, 2026 (deployment
> `dpl_DPN3tLQKT1CCHQBbFtABWxvpVzrA`): the ticked items in sections 12 to 16. Sentry and Vercel
> logs were clean after that deploy. Unticked items haven't been reported as checked.

## 12. Privacy, Sentry and analytics (round 16)

Privacy links
- [ ] `/privacy` opens from the footer on every page (home, `/conference`, `/networking`, an
      event page, `/accelerator`, `/media-kit`) and shows "Last updated", the short version and
      all sections, including Cookies ("no cookie banner") and Alumni in the EU and UK. Checked at
      390 px: no sideways scrolling.
- [ ] "See our privacy policy." appears under: the join flow (every step), `/update` (the email
      form and the edit form), check-in (the email step and the join step), the conference
      inquiry form and both accelerator forms. Each link opens `/privacy`.
- [ ] Under "Your choices and rights", `/privacy` says to use our contact form for access or
      deletion requests and that they're confirmed by email first; "our contact form" (there and
      in the EU/UK section) opens `/contact`. No email address appears on the page.

Deleting inquiries (round 17)
- [ ] As an Admin, `/admin/inquiries` and its Accelerator tab show no Delete.
- [ ] As a super admin, send a test conference inquiry and a test accelerator form (addresses you
      own). On each row, "Delete" opens a confirm step; "Delete #<id> permanently" removes it.
- [ ] `/admin/audit` shows `inquiry.delete` "Deleted conference inquiry #<id>" and
      `accelerator.delete` "Deleted accelerator founder #<id>" (or supporter) with your email and
      the time, and nothing from the message.

Sentry (after setting the environment variables and redeploying)
- [ ] `/admin/sentry-test` as an Admin: "Only super admins can open this page."
- [ ] As a super admin: "Send a server test error" says "Sent. Look for event …"; in Sentry,
      Issues shows "Sentry test error (server) from /admin/sentry-test" with tags `area:admin`,
      `test:yes`. `/admin/audit` shows `sentry.test`.
- [ ] "Send a browser test error" (with ad blockers off) shows the browser event in Sentry too.
- [ ] Open one test event in Sentry: no user, no cookies or headers, the request URL has no query
      string, and no email address appears anywhere. Resolve both test issues afterwards.
- [ ] On a preview without the Sentry variables, the test page says Sentry is off, and the site
      works normally.
- [ ] After each deploy (round 18): open `/admin/contacts` as a super admin, do an action there
      (for example filter, or link and undo a contact), and browse a few other admin tabs. In
      Sentry, confirm no new "session lookup failed" event appears.
- [ ] Open any database error event in Sentry: its message shows the SQL with `$1, $2` and
      "[params removed]", and no email address or token anywhere in the chain.

Analytics (after enabling Web Analytics in Vercel and redeploying)
- [x] Visit `/`, `/conference`, `/networking` and `/accelerator` (ad blockers off): they appear
      under Analytics → Pages within a few minutes. `/admin`, `/update`, a check-in confirm link
      and a live screen never appear; a `?src=…` visit shows the src and no other query.
- [x] Analytics → Events: "Get notified" on Block 02 → `get_notified_clicked` (block
      accelerator); a join from it → `join_completed` (src chain-accelerator, notify accelerator);
      a conference inquiry and each accelerator form → `inquiry_submitted` with its type; a real
      check-in (not test mode) → `checkin_completed` with the event slug. No event carries a name
      or email.

## 13. Contact form and privacy requests: `/contact`, `/admin/inquiries/contact` (round 19)

Use an address you own. Wait a few seconds after the page loads before sending.

- [ ] The footer shows "Contact" next to "Privacy"; `/contact` shows the form with three topics
      and "See our privacy policy." No email address appears on `/contact`, `/privacy` or the
      footer.
- [ ] General question: "Thank you… will reply by email." on screen. No email to you. The super
      admin inbox gets "Contact (General question): <name>"; Reply addresses you. In
      `/admin/inquiries/contact` the row shows Verified "Not needed".
- [ ] Privacy request: access my data: the thank-you says to check your inbox. You get exactly one
      email, "Confirm your privacy request"; the super admin gets the notification, which says
      it's unverified. Admin shows "Unverified".
- [ ] Open the link: `/contact/verify` shows "Confirm my request" (nothing happens on load). Press
      it: "your request is confirmed", the address bar no longer has the token, and admin shows
      "Verified" with the time. Open the same link again: "expired or was already used".
- [ ] Privacy request: delete my data: same as access; leave the link unclicked and check the row
      stays "Unverified" (the link stops working after 48 hours).
- [x] Deleted before confirming (round 23): send another privacy request, delete it in admin, then
      open its link and press "Confirm my request": "This request is no longer open. If you still
      need help, send us a new message." with a link to /contact (no error page, no "confirmed").
      An expired or used link says "This link has expired or was already used…" with the same link.
- [ ] As an Admin: the Contact tab is read-only (no Save, no Delete).
- [ ] As a super admin: set a message to "Replied" (`/admin/audit`: `contact_message.status` new →
      replied), then delete each test message ("Delete" → "Delete #<id> permanently");
      `/admin/audit` shows `contact_message.delete` "Deleted contact message #<id>" with your email
      and the time, and nothing from the message.
- [ ] More than 5 sends in an hour from one network shows "Too many messages from here".

## 14. Suspected spam and form validation (rounds 20 and 21)

There is no hidden honeypot field any more: the only spam flag is a submission sent in under 2
seconds. Test in both Chrome and Safari (iPhone too, if you can).

- [ ] On `/contact`, `/conference`, both `/accelerator` forms, the join flow and an event check-in
      quick join (a published event in its window, or `?test=1` with "Create a real member"),
      fill the form normally (AutoFill is fine) and send. Each arrives as a normal row with no
      "Suspected spam" badge, the super admin gets the usual notification (a join gets the
      welcome email), and Vercel logs show no "flagged:" line for it.
- [ ] Validation keeps what you typed, in Chrome and Safari: on `/contact`, write a message under
      10 characters and send. The form stays filled (name, email, topic, message), "Tell us a
      little more (at least 10 characters)." appears right under the message, and the cursor is
      in the message. Fix it and send: the thank-you appears. Repeat with a bad email
      (`name@`) on `/conference` and with nothing ticked under Focus on the founder form.
- [ ] Join flow: type a name, then an email like `a@b`: the error is under the email and Next
      doesn't advance.
- [ ] Flag one on purpose: open a form, fill it with AutoFill and send within 2 seconds of the page
      appearing (or reload and paste fast). The thank-you looks the same; no email arrives; the
      row shows "Suspected spam · sent too fast"; Vercel logs show "<form> flagged: too_fast". A
      flagged join appears under Members → Show "Pending: suspected spam", not in the member list,
      the counts or `/api/chain`.
- [ ] As an Admin: badges and the Spam filter show, but no "Not spam" or Delete.
- [ ] As a super admin: "Not spam" on the flagged inquiry sends the notification once (pressing
      it again does nothing); on a flagged privacy request it sends the confirmation link and the
      notification; on the pending join it creates the member and sends the welcome email.
      `/admin/audit` shows the `*.not_spam` entries without any message content. Delete the
      remaining test items (`pending.delete` for the pending one).

## 15. Members by country, join sources, welcome email and daily digest (round 22)

Members by country (`/admin`, Members):
- [ ] "Members by country" shows no city or state tiles ("New York City", "New York"): those members
      count under United States. Anything that matches no country shows as "Unrecognized".
- [ ] Each member's "City and country" still reads exactly as they typed it (Details column, Edit).
- [ ] The Country filter works for United States and for Unrecognized.

Join sources (a private window each time, so the tab session is fresh):
- [ ] Open `/?src=test-launch`, go to `/conference`, press "Get notified" and join with an obviously
      fake address (e.g. `src-test@example.com`). In `/admin` the member's Source is `test-launch`,
      not `conference-2027`.
- [ ] Open the site from a link on another site with no `?src=` (e.g. post the plain URL in a
      private LinkedIn or X draft preview and click it, or click it from an email): the member's
      Source is `ref-<that site>` (e.g. `ref-linkedin.com`, `ref-t.co`). Typed directly: no source.
- [ ] An event share link (`/networking/<slug>?src=event-<slug>`) still shows the event on the
      join success screen.
- [ ] Delete the test members afterwards (`member.delete` in the audit log).

Welcome email:
- [x] Settings → "Send test welcome email to me": one `[Test] Block added. You're on the chain.`
      arrives, only to you. Two paragraphs, "Update your profile" button (→ `/update`), "Follow us
      on LinkedIn and X" (LinkedIn → the company page, X → @NYU_Blockchain), the small print and
      Unsubscribe. The plain-text part (View source / Show original) matches. Audit: `welcome.test`.
- [x] Footer and join section "LinkedIn" open https://www.linkedin.com/company/nyu-blockchain-society/.

Daily digest:
- [ ] Settings → "Digest recipients": saving an address that isn't on Team is refused with a clear
      message; an active admin's address saves (`settings.edit` with old → new).
- [x] "Send test digest to me": one `[Test] Daily digest: …` arrives, only to you, with "Waiting
      for review" first (if anything waits, each with how long), verified privacy requests, new
      members (name, affiliation, source, no email addresses) and new messages by type, plus
      "Open admin". Audit: `digest.test`.
- [ ] The next morning (after 15:00 UTC): if anything was waiting or new, the super admin and the
      listed organizers each got one digest, and `/admin/audit` shows `digest.send` "Daily digest
      sent to <n> recipients". On a quiet day nothing arrives and nothing is logged.

## 16. Admin paging (round 23)

- [x] `/admin/contacts`: "Showing 1–100 of <n>" and Next; Next shows "Showing 101–200 of <n>" with
      Previous; the last page shows the remainder and no active Next.
- [ ] Search or filter (e.g. a source), go to page 2: the search box and filters keep their
      values and every row matches. Press Filter again: back to page 1.
- [ ] "Export CSV (n)" shows the full match count and the file has every matching row.
- [ ] `/admin` (Members): the same pager once there are more than 100 members (until then, just
      "Showing 1–<n> of <n>").

## 17. Footer copy (round 24)

- [ ] The site footer reads "NYU Blockchain Society · Official NYU Alumni Club" (no "Based in New
      York"); the home mission ends "Based in New York, open to NYU alumni worldwide."
- [ ] Any email (e.g. Settings → "Send test welcome email to me") ends with "NYU Blockchain Society
      · Official NYU Alumni Club" and nothing about New York.

## 18. Contacts import: company, source and notes (round 25)

On the **preview deployment only**, with an obviously fake CSV (every address `@example.com`).
Delete the test rows afterwards. Example file (save as `fixtures/local/import-test.csv`, git-ignored):

```
name,email,company,title,source,notes,favourite colour
Test One,test1@example.com,Example Co,Analyst,via Alex Example,Met at the mixer,blue
Test Two, TEST2@Example.com ,,Builder,,Follow up,
No Email,,Some Co,,via Alex Example,,
Bad Email,bad@,,,,,
Test One Again,TEST1@example.com,,,,,
```

- [ ] `/admin/contacts/import` (super admin), choose the file, leave the label empty → Preview: the
      mapping finds name, email, company, title (headline), source and notes; "favourite colour"
      isn't used. Counts: 2 new, 0 matched, 3 skipped; "1 row has no source of their own" and
      Import is disabled.
- [ ] Type `fake-list` as the label → Update preview: By source shows `via-alex-example` 1 and
      `fake-list` 1. Skipped rows: 3 "Missing email", 4 "Invalid email", 5 "Duplicate in file".
      Emails are masked everywhere in the preview.
- [ ] Import: summary 2 new, 0 matched, 3 skipped; "No members were created and no emails were
      sent". `/admin/contacts` shows Company and Notes columns ("2026-…: Met at the mixer"); the
      Source filter lists `via-alex-example` and `fake-list`.
- [ ] Edit the file: Test Two gets company "Second Co" and source "via Sam Example", notes "Call
      back". Import again (label `fake-list`): 0 new, 2 matched, 1 updated. Test Two now has
      company "Second Co" (it was empty), still source `fake-list`, and notes with "Follow up",
      "Call back" and "Also from via-sam-example" as separate dated lines. Test One is unchanged.
- [ ] Import the same file a third time: 0 new, 2 matched, 0 updated; notes don't repeat.
- [ ] Export CSV has `company` and `notes`. `/admin/audit` shows `contacts.import` with counts only.
- [ ] An admin (not super) doesn't see Import, and `/admin/contacts/import` is refused.
- [ ] `/privacy` mentions contacts from introductions and shows "Last updated October 16, 2026".
- [ ] Delete the test contacts (Delete per row).

## 19. Personal introductions in invites (round 26)

On the **preview deployment only**, with fake contacts (`@example.com`). Nothing is sent from a
preview (real sends are production-only), so this checks the picker, statuses and refusals.
Import a fake CSV first (section 18), e.g. two rows with source "via Alex Example" and one with none
(label `fake-list`).

- [ ] `/admin/contacts`: the via- rows show Invite "Personal (not auto-invited)", the `fake-list`
      row "Eligible". The Invite filter has "Personal (not auto-invited)" and lists only the via-
      rows; the CSV export shows `personal` for them.
- [ ] `/admin/contacts/invite`: "Contacts from" is pre-selected to a non-via source (or "Pick a
      source"); via- sources are listed under "Personal introductions (not auto-invited)".
- [ ] Pick `via-alex-example`: the warning "These are personal introductions. They'll get the
      standard society invite." shows with an unticked "Include these personal introductions"
      box, and the Send button is disabled until it's ticked. Switching source clears the tick.
- [ ] Ticked, "Send to n contacts" (after a test to yourself) shows the warning again in the
      confirm dialog; on a preview the server answers that invites only go out from production.
- [ ] Other sources work exactly as before.
- [ ] Delete the fake contacts.
