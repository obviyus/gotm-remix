# GOTM

Every month the [PatientGamers](https://pg-gotm.com) Discord picks games to play together — one short (< 12h on HowLongToBeat) and one long (> 12h). This runs the election.

Live at **[pg-gotm.com](https://pg-gotm.com)**.

## How a month works

A month moves through five states:

`nominating` → `jury` → `voting` → `playing` → `over`

- **Nominating** — the jury sets a theme; anyone nominates a fitting game with an optional pitch
- **Jury** — the jury curates nominations down to a ballot (size isn't fixed)
- **Voting** — members rank the ballot; the winner is decided by **Instant Runoff Voting**
- **Playing** — winners are crowned and the community plays
- **Over** — next month begins, and it all repeats

Votes are tallied with ranked choice and rendered as an animated **Sankey diagram** showing how support flows between rounds. Game metadata comes from IGDB; each voter is shown a stable, PII-free pseudonym seeded off their Discord ID — same person, same "Brave Mario", every time. There's also a **Patience** view tracking games that just turned a year old — proper patient-gamer territory.

## Stack

React 19 + React Router 8 (SSR) on Bun · Vite 8 · Tailwind CSS v4 · Base UI · ECharts (the Sankey) · libSQL/Turso. Discord OAuth for login; IGDB/Twitch for game data.

## Develop

```bash
bun install
bun run dev          # uses a local file database
```

## Build & run

```bash
bun run build
bun run start
bun run typecheck && bun run lint
```

Docker: `docker compose up` (port 3000). CI publishes `ghcr.io/obviyus/gotm-remix` on push to `master`.

## Configuration

All required at runtime: `COOKIE_SECRET`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`, `GOTM_JURY_WEBHOOK_URL`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`.
