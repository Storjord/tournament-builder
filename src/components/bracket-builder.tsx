"use client";

import { useRef, useState, type FormEvent } from "react";
import {
  buildElimination, buildSwiss, parseParticipants, saveResult, swissStandings,
  type Match, type Results, type Scores, type TournamentStyle,
} from "@/lib/bracket";
import { MatchCard } from "@/components/match-card";

const demoParticipants = ["Archer A", "Archer B", "Archer C", "Archer D", "Archer E", "Archer F", "Archer G", "Archer H"];

const formats: { value: TournamentStyle; name: string; detail: string }[] = [
  { value: "elimination", name: "Single elimination", detail: "Seeded knockout with a bronze medal match." },
  { value: "swiss", name: "Swiss system", detail: "Fixed rounds against similar records, ranked on points." },
];

/** Seed number beside each non-empty line; blank lines are skipped when parsing. */
function seedLabels(input: string): string[] {
  const labels: string[] = [];
  let seed = 0;
  for (const line of input.split(/\r?\n/)) {
    if (line.trim()) seed += 1;
    labels.push(line.trim() ? String(seed) : "");
  }
  return labels;
}

function eliminationRoundName(index: number, total: number, matches: number): string {
  if (index === total - 1) return "Gold medal match";
  if (index === total - 2) return "Semifinals";
  if (index === total - 3) return "Quarterfinals";
  return `Round of ${matches * 2}`;
}

const settled = (match: Match) => match.status === "complete" || match.status === "bye";

export function BracketBuilder() {
  const [input, setInput] = useState(demoParticipants.join("\n"));
  const [selectedStyle, setSelectedStyle] = useState<TournamentStyle>("elimination");
  const [style, setStyle] = useState<TournamentStyle>("elimination");
  const [participants, setParticipants] = useState(demoParticipants);
  const [results, setResults] = useState<Results>({});
  const [error, setError] = useState("");
  const [generation, setGeneration] = useState(0);
  const gutter = useRef<HTMLDivElement>(null);
  const elimination = style === "elimination" ? buildElimination(participants, results) : null;
  const swiss = style === "swiss" ? buildSwiss(participants, results) : null;
  const rounds = elimination?.rounds ?? swiss?.rounds ?? [];
  const final = elimination?.rounds.at(-1)?.[0];
  const rows = swiss ? swissStandings(participants, rounds) : [];
  const complete = (!swiss || rounds.length === swiss.totalRounds) && !swiss?.error &&
    rounds.flat().every(settled);
  const leaders = rows.filter((row) => row.rank === 1);

  function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setParticipants(parseParticipants(input));
      setStyle(selectedStyle);
      setResults({});
      setGeneration((current) => current + 1);
      setError("");
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      setError(error.message);
    }
  }

  function update(id: string, scores: Scores | null) {
    setResults((current) => saveResult(participants, style, current, id, scores));
  }

  function card(match: Match, label: string, caption: string) {
    return <MatchCard
      key={`${generation}-${match.id}-${JSON.stringify(match.participants)}-${JSON.stringify(match.scores)}`}
      match={match} participants={participants} label={label} caption={caption} byePoints={style === "swiss"}
      onSave={(scores) => update(match.id, scores)}
    />;
  }

  const medals = elimination ? [
    { name: "Gold", color: "bg-gold", archer: final?.winner, pending: "Awaiting gold medal match" },
    { name: "Silver", color: "bg-silver", archer: final?.loser, pending: "Awaiting gold medal match" },
    ...(elimination.bronze ? [{
      name: "Bronze", color: "bg-bronze",
      archer: elimination.bronze.winner && `${elimination.bronze.winner}${elimination.bronze.status === "bye" ? " (uncontested)" : ""}`,
      pending: "Awaiting bronze medal match",
    }] : []),
  ] : [];

  return (
    <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-10">
      <form onSubmit={generate} className="self-start rounded-lg border border-rule bg-sheet p-6 lg:sticky lg:top-6">
        <h2 className="stretch-wide text-lg font-bold tracking-tight">Setup</h2>

        <fieldset className="mt-5">
          <legend className="mb-2 text-sm font-semibold">Format</legend>
          <div className="grid gap-2">
            {formats.map((format) => (
              <label key={format.value} className="flex gap-3 rounded-md border border-rule p-3 has-checked:border-ink has-checked:bg-range/50">
                <input
                  type="radio" name="format" value={format.value}
                  checked={selectedStyle === format.value}
                  onChange={() => setSelectedStyle(format.value)}
                  className="mt-0.5 size-4 shrink-0 accent-ink"
                />
                <span>
                  <span className="block text-sm font-semibold">{format.name}</span>
                  <span className="mt-0.5 block text-sm leading-snug text-muted">{format.detail}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <label htmlFor="participants" className="mt-6 block text-sm font-semibold">Archers</label>
        <p id="participant-help" className="mt-1 mb-3 text-sm leading-snug text-muted">
          One per line in qualification order, seed 1 first. Resolve ranking ties before entry. 2–32 archers.
        </p>
        <div className={`flex overflow-hidden rounded-md border bg-range/40 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue ${error ? "border-red" : "border-rule"}`}>
          <div ref={gutter} aria-hidden="true" className="stretch-narrow w-9 shrink-0 overflow-hidden border-r border-rule py-2 pr-2 text-right text-xs leading-7 text-muted tabular-nums select-none">
            {seedLabels(input).map((label, index) => <div key={index} className="h-7">{label}</div>)}
          </div>
          <textarea
            id="participants" value={input} wrap="off" rows={10} spellCheck={false}
            onChange={(event) => setInput(event.target.value)}
            onScroll={(event) => { if (gutter.current) gutter.current.scrollTop = event.currentTarget.scrollTop; }}
            aria-describedby={`participant-help${error ? " participant-error" : ""}`}
            aria-invalid={Boolean(error)}
            className="min-h-40 w-full resize-y bg-transparent px-3 py-2 text-sm leading-7 focus-visible:outline-none"
          />
        </div>
        {error && <p id="participant-error" role="alert" className="mt-3 text-sm text-red">{error}</p>}

        <button type="submit" className="mt-5 w-full rounded-md bg-ink px-4 py-3 text-sm font-semibold text-sheet hover:bg-ink-soft">
          Build tournament
        </button>
        <p className="mt-3 text-xs leading-5 text-muted">
          Building clears all results. Nothing leaves this browser tab, and refreshing starts over.
        </p>
      </form>

      <section aria-labelledby="bracket-heading" className="min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-4">
          <div>
            <h2 id="bracket-heading" className="stretch-wide text-2xl font-extrabold tracking-tight sm:text-3xl">
              {elimination ? "Single elimination" : "Swiss system"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {participants.length} archers{swiss ? `, round ${rounds.length} of ${swiss.totalRounds}` : ""}
            </p>
          </div>
          <button
            type="button" onClick={() => { setResults({}); setGeneration((current) => current + 1); }}
            className="rounded-md border border-rule bg-sheet px-3 py-2 text-sm font-medium hover:border-ink"
          >
            Reset results
          </button>
        </div>

        <details className="mt-4 text-sm text-muted">
          <summary className="w-fit font-medium text-ink">How this format works</summary>
          <div className="mt-3 max-w-prose space-y-2 leading-relaxed">
            {elimination ? (
              <p>Fixed bracket seeded from qualification. The highest seeds receive any byes, and winners advance without reseeding. Semifinal losers shoot for bronze.</p>
            ) : (
              <>
                <p>An alternative format, not the Olympic medal format. {swiss?.totalRounds} fixed rounds pair archers with similar match points, never as a rematch. With an odd field, one archer per round gets a pairing bye worth one match point, at most once each.</p>
                <p>The next round appears when every match in the current round has a result. Changing or clearing an earlier winner discards all later pairings and results. The field is fixed: no late entries, withdrawals or forfeits.</p>
              </>
            )}
            <p>Enter final set points only: 6–0, 6–2, 6–4, 7–1, 7–3, or 6–5 after a shoot-off, in either order.</p>
          </div>
        </details>

        {swiss?.error && <p role="alert" className="mt-4 rounded-md border border-red/40 bg-red/5 p-3 text-sm text-red">{swiss.error}</p>}

        <div className="mt-6 overflow-x-auto pb-4">
          <div className={elimination ? "bracket min-w-max" : "flex min-w-max gap-6"}>
            {rounds.map((round, index) => {
              const name = elimination ? eliminationRoundName(index, rounds.length, round.length) : `Round ${index + 1}`;
              const last = index === rounds.length - 1;
              return (
                <section key={index} aria-label={name} className="flex w-60 shrink-0 flex-col">
                  <h3 className="mb-2 flex items-baseline justify-between gap-2 text-sm font-semibold">
                    <span>{name}</span>
                    <span className="text-xs font-normal text-muted tabular-nums">
                      {round.filter(settled).length} of {round.length} done
                    </span>
                  </h3>
                  <div className={elimination ? "flex flex-1 flex-col" : "flex flex-col gap-3"}>
                    {round.map((match, matchIndex) => {
                      const content = card(match, `${name}, match ${matchIndex + 1}`, `Match ${matchIndex + 1}`);
                      if (!elimination) return content;
                      return (
                        <div key={match.id} className="relative flex flex-1 items-center py-2">
                          {index > 0 && <span className="link link-in" data-on={match.participants.every(Boolean) ? "" : undefined} />}
                          {!last && (
                            <>
                              <span className="link link-out" data-on={match.winner ? "" : undefined} />
                              <span className={`link ${matchIndex % 2 ? "link-up" : "link-down"}`} data-on={match.winner ? "" : undefined} />
                            </>
                          )}
                          <div className="w-full">{content}</div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        {elimination && (
          <div className="mt-6 grid gap-6 sm:grid-cols-[15rem_minmax(0,24rem)] sm:gap-10">
            {elimination.bronze && (
              <section aria-label="Bronze medal match">
                <h3 className="mb-2 text-sm font-semibold">Bronze medal match</h3>
                {card(elimination.bronze, "Bronze medal match", "Semifinal losers")}
              </section>
            )}
            <section aria-labelledby="medals-heading" className={elimination.bronze ? "" : "sm:col-span-2 sm:max-w-sm"}>
              <h3 id="medals-heading" className="mb-2 text-sm font-semibold">Medals</h3>
              <ul aria-live="polite" className="divide-y divide-rule rounded-md border border-rule bg-sheet">
                {medals.map((medal) => (
                  <li key={medal.name} className="flex items-center gap-3 px-4 py-3">
                    <span aria-hidden="true" className={`size-3.5 shrink-0 rounded-full ring-1 ring-ink/15 ${medal.color}`} />
                    <span className="w-14 shrink-0 text-sm text-muted">{medal.name}</span>
                    {medal.archer
                      ? <span className="min-w-0 truncate font-semibold">{medal.archer}</span>
                      : <span className="text-sm text-muted italic">{medal.pending}</span>}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}

        {swiss && (
          <section aria-labelledby="standings-heading" className="mt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 id="standings-heading" className="stretch-wide text-xl font-bold tracking-tight">Standings</h3>
              <p aria-live="polite" className="text-sm">
                {!complete ? <span className="text-muted">Provisional until round {swiss.totalRounds} finishes</span>
                  : leaders.length === 1 ? <>Champion: <strong>{leaders[0].name}</strong></>
                  : <>Shared first place: <strong>{leaders.map((row) => row.name).join(", ")}</strong></>}
              </p>
            </div>
            <div className="mt-3 overflow-x-auto rounded-md border border-rule bg-sheet">
              <table className="w-full text-sm tabular-nums">
                <thead className="border-b border-rule text-xs text-muted">
                  <tr>
                    <th scope="col" className="w-14 px-3 py-2.5 text-left font-medium">Rank</th>
                    <th scope="col" className="px-3 py-2.5 text-left font-medium">Archer</th>
                    {[["Played"], ["Wins"], ["Losses"], ["Byes"], ["Points"], ["BH", "Buchholz"], ["SB", "Sonneborn-Berger"]].map(([heading, title]) => (
                      <th key={heading} scope="col" className="px-3 py-2.5 text-right font-medium">
                        {title ? <abbr title={title} className="no-underline">{heading}</abbr> : heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.name} className="border-t border-rule first:border-t-0">
                      <td className="px-3 py-2">
                        <span className={`stretch-narrow inline-grid size-6 place-items-center rounded-full text-sm font-bold ${row.rank === 1 && complete ? "bg-gold" : ""}`}>{row.rank}</span>
                      </td>
                      <th scope="row" className="px-3 py-2 text-left font-normal">
                        <span className="stretch-narrow mr-2 text-xs text-muted">{row.seed}</span>{row.name}
                      </th>
                      <td className="px-3 py-2 text-right">{row.played}</td>
                      <td className="px-3 py-2 text-right">{row.wins}</td>
                      <td className="px-3 py-2 text-right">{row.losses}</td>
                      <td className="px-3 py-2 text-right">{row.byes}</td>
                      <td className="px-3 py-2 text-right font-bold">{row.points}</td>
                      <td className="px-3 py-2 text-right">{row.buchholz}</td>
                      <td className="px-3 py-2 text-right">{row.sonnebornBerger}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 max-w-prose text-xs leading-5 text-muted">
              Ranked by match points (wins plus byes), then Buchholz (opponents&apos; points), then Sonneborn–Berger
              (defeated opponents&apos; points). A bye adds your own points to both. Remaining ties share a rank;
              the small number is qualification seed, for reference only.
            </p>
          </section>
        )}
      </section>
    </div>
  );
}
