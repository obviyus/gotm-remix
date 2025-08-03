# GOTM

This is the code for https://pg-gotm.com. It is currently used for the Game of the Month (GOTM) voting for the PatientGamers Discord server.

## GOTM Process

Every month, the users and jury select one short (< 12 hours on HLTB) and one long (> 12 hours on HLTB) game to play.

- The GOTM process begins at the `nominating` status. The jury decides a theme and users can nominate games that fit the theme along with an optional pitch.
- After the nomination period ends, the jury selects a list of games to be voted on and the month status changes to `jury`. The number of games per month is not fixed.
- When the jury has selected the games, the month status changes to `voting`. Users can vote on the games they want to play. This is done via a ranked voting system.
- Votes are ranked and displayed using a Sankey diagram. The game with the most votes is selected as the GOTM and the month status changes to `playing`.
- Once the next month begins, the month status changes to `over` and the process starts again.

## Development

This repository uses Bun for package management and the runtime. To start the development server:

1. Start the server (uses local file database):
```sh
$ bun run dev
```

## Production

For production deployment, set up environment variables:
```sh
TURSO_DATABASE_URL=your_turso_url
TURSO_AUTH_TOKEN=your_turso_token
```
