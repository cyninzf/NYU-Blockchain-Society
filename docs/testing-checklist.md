# Testing checklist

Run on production (https://www.nyublockchainsociety.com) after a deploy that touches email,
sign-in or members. Use your own inbox; never test with real members' addresses. Admin sign-in
is by email link only (basic auth was removed in round 10).

## 1. Admin sign-in and team: `/admin/login`, `/admin/team`

- [ ] Request a link with the super admin email. The page says the same thing for any email.
- [ ] The email arrives from hello@nyublockchainsociety.com; its link opens a page with a
      "Sign in" button (nothing happens until you press it).
- [ ] After signing in, the header shows your email and "Super admin".
- [ ] Opening the same link again says it has expired or was already used.
- [ ] At `/admin/team`, add the other two organizers (role Admin or Super admin). The recovery
      super admin shows masked and can't be changed.
- [ ] Each organizer signs in on their own device. An Admin doesn't see the import, team or
      media-kit-preview tabs, and opening `/admin/team` directly says it's for super admins.
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
