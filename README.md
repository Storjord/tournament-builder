# Tournament Builder

A frontend-only tournament bracket starter built with Next.js App Router,
React, TypeScript, Tailwind CSS, and ESLint.

## Development

Use Node.js 22.17 or newer (Node.js 22 LTS or a newer supported LTS recommended).

```sh
npm ci
npm run dev
```

Open http://localhost:3000.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

## Individual recurve tournaments

Enter 2-32 unique archers in qualification order, highest-ranked first (seed 1).
Qualification ties must be resolved before entry. Setup changes apply when you
select **Build tournament**, which clears previous results.

### Single elimination

The fixed bracket separates the top two seeds until the final and the top four
until the semifinals. For eight archers, first-round pairings are 1-8, 4-5, 2-7,
and 3-6. There is no reseeding after upsets. Non-power-of-two fields use the next
power-of-two bracket, with first-round byes awarded to the highest seeds.

The final determines gold and silver. Semifinal losers contest bronze. For
three archers, the sole semifinal loser receives uncontested bronze; two-archer
events have no bronze. These small-field adaptations are not Olympic event sizes.

Changing or clearing a winner clears results along its dependent bracket path,
including the bronze result when affected. A score correction with the same
winner preserves later results.

### Swiss system

Swiss replaces round robin as the alternative format. It is **not the Olympic
medal format**, nor a certified FIDE pairing implementation. Final standings
determine the outcome directly, with no knockout or medal matches.

The app fixes the number of rounds before play: `ceil(log2(N)) + 1`, capped at
full round-robin length (N-1 for even fields, N for odd fields).

| Archers | Rounds |
|---------|--------|
| 2 | 1 |
| 3-4 | 3 |
| 5-8 | 4 |
| 9-16 | 5 |
| 17-32 | 6 |

At 32 archers this is 96 matches, versus 496 for round robin. Small fields can
effectively become round robin. More rounds improve ranking evidence but do not
guarantee unique ranks. The field is fixed: late entries, withdrawals, requested
byes, and forfeits are not supported.

#### Pairing policy

- Only round 1 appears initially; the next appears automatically once every
  match in the current round has a completed result.
- No rematches and at most one appearance per archer per round.
- For odd fields, a bye awards one match point, not a played win or a set score.
  Choose the lowest-point eligible archer, breaking this pairing-only tie by
  lowest-ranked qualification seed (largest seed number). No archer receives two byes. If that choice cannot
  produce a completable schedule, try the next eligible archer.
- Pairing order is match points descending, then qualification seed ascending;
  provisional opponent tiebreaks do not change pairings.
- Round 1 prefers top-half versus bottom-half qualification seeds (after the
  bye is removed). Later rounds prefer top-half versus bottom-half within each
  equal-point group.
- Deterministic backtracking finds a complete pairing with the smallest feasible
  maximum match-point gap for the chosen bye. Most-constrained archers are
  processed first, tied by pairing order; candidate opponents are ordered by
  point gap, half-split preference, then qualification seed.
- Small near-round-robin fields also check that the remaining rounds can be
  completed without rematches or repeated byes. Pairing failures are displayed
  explicitly rather than silently allowing rematches.

Changing a winner clears **all later Swiss results and pairings**. Clearing a
result also removes later rounds until the current round is complete again.
Score-only corrections that preserve the winner retain later rounds.

#### Standings and bye adjustment

Rank by match points (played wins + pairing byes), then **Buchholz** (sum of
opponents' match points), then **Sonneborn-Berger** (sum of defeated opponents'
match points). Any remaining ties share rank, including first place.
Qualification seed is display order only, never a standings tiebreaker.

For a pairing bye, use the full-point dummy-opponent treatment described in
FIDE's September 2023 tie-break regulations, articles 16.3.1 and 16.4:
the archer's own current/final match points are added to both BH and SB.
Actual opponents' points include their pairing-bye points. This avoids treating
a bye as a zero-strength opponent. No other unplayed-result categories or
cut modifiers are implemented.

Standings and opponent-strength scores are provisional until all fixed rounds
finish; they update as results arrive. Equal-point archers may have faced
different opposition, so Swiss ranks are based on a partial schedule.

### Results

Enter **completed match set points**, not arrow scores or per-set scores.
Accepted results in either direction: 6-0, 6-2, 6-4, 7-1, 7-3, and 6-5.
The 6-5 score records a shoot-off win (one additional set point after 5-5).
Incomplete scores and tied results cannot be saved. Use **Clear result** to
remove a recorded result, or **Reset results** to clear the entire tournament.

### Rules references

- [World Archery rulebook](https://www.worldarchery.sport/rulebook):
  Book 2 for event structure and match charts; Book 3 for target scoring and ties.
- [Olympic recurve format and scoring](https://www.nbcolympics.com/news/archery-101-olympic-competition-format-and-scoring).
- [FIDE basic Swiss rules, effective February 2026](https://handbook.fide.com/chapter/C0401202507):
  reference for fixed rounds, no rematches, same-score pairing, and allocated byes.
  Chess colour rules do not apply to this archery adaptation.
- [FIDE tie-break regulations, September 2023](https://handbook.fide.com/chapter/TieBreakRegulations2023):
  BH (article 8.1), SB (9.1), and the explicitly adopted full-point bye treatment
  (16.3.1 and 16.4). The app uses this declared policy, not a claim of compliance
  with every current chess or archery competition regulation.

State is in browser memory only: refreshing clears changes. Browser-local saving,
import/export, qualification scoring, team events, arrow entry, and unfinished
match tracking are not implemented. No database, authentication, API routes, or
runtime server data dependencies are required.

## Structure

- [Page](src/app/page.tsx): statically prerendered application shell.
- [Bracket builder](src/components/bracket-builder.tsx): interactive client component.
- [Match card](src/components/match-card.tsx): final-score entry and validation.
- [Bracket logic](src/lib/bracket.ts): seeding, schedules, scoring, progression, and standings.
- [Elimination tests](tests/bracket.test.mjs): exhaustive field-size, seeding, score and result-correction tests using Node's test runner.
- [Swiss tests](tests/swiss.test.mjs): round counts, pairing rules, byes, standings tiebreaks and result corrections.

## Deploy to Vercel

Push the project to your Git provider and import it in Vercel. Select the Next.js
framework preset and keep its default build and output settings. No environment
variables or database setup are needed.

The home page is statically prerendered; bracket interactions run in the browser.
Standard Next.js deployment is retained rather than forcing `output: "export"`,
so server features can be added later if needed.
