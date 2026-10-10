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

## 6. Events: `/admin/events`, `/events`, Block 01

Use an obviously fake test event (e.g. "Test event", venue "Example Venue") dated a few days
ahead, and delete it at the end.

- [ ] `/admin/events` → "New event": title, label "Networking evening", start and end time, venue,
      no registration link → "Create draft". The edit page says "Draft".
- [ ] While it's a draft: `/events` doesn't list it, `/events/<link name>` is a 404, and the home
      page's Block 01 doesn't show it. "Preview as it will appear" shows it with the preview banner;
      signed out, the preview URL is a 404.
- [ ] "Publish". `/events/<link name>` shows "Networking evening" above the title, the date and time
      in ET, the venue, "Registration opens soon" and "Join the society to get the invite"; no
      background lines or blocks run behind the text (check at 390 px and on a laptop).
- [ ] Home page, The chain: Block 01 shows the event with "Registration opens soon" and "Join the
      society to get the invite". Clearing the label in the admin form makes the page say "Event".
- [ ] Add a registration link (https://lu.ma/…) and save: the event page and Block 01 now show
      "Register", opening that link in a new tab.
- [ ] Copy the share link from `/admin/events` and open it in a private window. Join with an
      address you own: in `/admin`, that member's source is `event-<link name>`, and the events
      list shows "Joined from the share link: 1". Delete the test member afterwards.
- [ ] "Cancel event": the event page and `/events` say "Cancelled"; Block 01 shows it marked
      "Cancelled" with "Get notified" (or the next published event, if there is one).
- [ ] `/sitemap.xml` lists `/events/<link name>` while it's public.
- [ ] `/admin/audit` lists `event.create`, `event.edit`, `event.publish` and `event.cancel`.
- [ ] Sign in as an Admin (not a super admin) on another device: `/admin/events` lists the
      events with "View" links and a "View only" note, and has no "New event", Publish, Cancel or
      Delete; the event page's form is greyed out with no Save; "Preview as it will appear" still
      works; `/admin/events/new` says it's for super admins. An event change sent anyway (e.g. a
      replayed request) gets a 403 "Not allowed", and the Admin's `/admin/audit` shows a `denied`
      row for it.
- [ ] As a super admin, "Delete" the test event; it's gone from `/events` and `/admin/events`, and
      `event.delete` is in the audit log.
