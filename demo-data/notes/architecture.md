# CampusKart architecture notes (synthetic demo data)

CampusKart is a campus marketplace where students buy and sell second-hand items.

## Components
- **Web:** Next.js frontend. Deploy target is described in the README.
- **API:** small Python service for listings, orders and users.
- **Storage:** listing images go to a third-party object bucket.

## Auth
Sign-up verification emails are sent through the college SMTP account (smtp.example.edu).
Sessions are cookie based; see `auth/session.ts`.

## Payments
Orders are paid with UPI deep links. Order status is updated when the buyer confirms payment.

## Conventions
- Small PRs, one reviewer minimum.
- Add new environment variables to `.env.example`.
