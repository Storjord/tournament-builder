"use client";

import { useState, type FormEvent } from "react";
import { validateScores, type Match, type Scores } from "@/lib/bracket";

export function MatchCard({ match, participants, label, caption, onSave, byePoints = false }: {
  match: Match;
  participants: string[];
  /** Full accessible name, e.g. "Round 1, match 2". */
  label: string;
  /** Short visible caption, e.g. "Match 2". */
  caption: string;
  onSave: (scores: Scores | null) => void;
  byePoints?: boolean;
}) {
  const saved: [string, string] = match.scores ? [String(match.scores[0]), String(match.scores[1])] : ["", ""];
  const [values, setValues] = useState<[string, string]>(saved);
  const [error, setError] = useState("");
  const playable = match.status === "ready" || match.status === "complete";
  const dirty = values[0] !== saved[0] || values[1] !== saved[1];
  const shootOff = match.scores?.includes(5) ?? false;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (values.some((value) => value.trim() === "")) throw new Error("Enter both final set-point scores.");
      const scores: Scores = [Number(values[0]), Number(values[1])];
      validateScores(scores);
      onSave(scores);
      setError("");
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      setError(error.message);
    }
  }

  return (
    <form
      onSubmit={submit}
      aria-label={label}
      className={`rounded-md border bg-sheet ${match.status === "ready" ? "border-ink/45" : "border-rule"}`}
    >
      <div className="flex items-center justify-between px-3 pt-2 text-xs text-muted">
        <span>{caption}</span>
        {shootOff && <span>Shoot-off</span>}
      </div>
      <div className="py-1">
        {match.participants.map((participant, slot) => {
          const won = participant !== null && participant === match.winner;
          const lost = match.status === "complete" && participant === match.loser;
          return (
            <div key={slot} className={`relative flex items-center gap-2 py-1 pr-2 pl-3 ${lost ? "text-muted" : ""}`}>
              <span
                aria-hidden="true"
                className={`absolute inset-y-1 left-0 w-1 rounded-r-sm transition-colors duration-300 ${won ? "bg-gold" : "bg-transparent"}`}
              />
              <span className="stretch-narrow w-5 shrink-0 text-right text-xs text-muted tabular-nums">
                {participant ? participants.indexOf(participant) + 1 : ""}
              </span>
              <span
                title={participant ?? undefined}
                className={`min-w-0 flex-1 truncate text-sm ${won ? "font-semibold" : ""} ${participant ? "" : "text-muted italic"}`}
              >
                {participant ?? (match.status === "bye" ? "Bye" : "To be decided")}
                {won && <span className="sr-only"> (winner)</span>}
              </span>
              {playable && (
                <input
                  type="number" inputMode="numeric" min={0} max={7} step={1} required
                  aria-label={`Final set points for ${participant}`}
                  aria-describedby={error ? `error-${match.id}` : undefined}
                  aria-invalid={Boolean(error)}
                  value={values[slot]}
                  onChange={(event) => setValues((current) => slot === 0 ? [event.target.value, current[1]] : [current[0], event.target.value])}
                  className={`stretch-narrow h-8 w-10 shrink-0 rounded border text-center text-base font-bold tabular-nums ${error ? "border-red" : "border-rule"} ${won ? "bg-gold/15" : "bg-range/50"}`}
                />
              )}
            </div>
          );
        })}
      </div>
      {playable && (
        <div className="flex items-center gap-3 border-t border-rule px-3 py-2">
          {(dirty || !match.scores) && (
            <button type="submit" className="rounded bg-ink px-3 py-1.5 text-xs font-semibold text-sheet hover:bg-ink-soft">
              {match.scores ? "Save correction" : "Save result"}
            </button>
          )}
          {match.scores && (
            <button type="button" onClick={() => onSave(null)} className="text-xs text-muted underline-offset-2 hover:text-ink hover:underline">
              Clear result
            </button>
          )}
        </div>
      )}
      {match.status === "bye" && (
        <p className="px-3 pb-2 text-xs text-muted">{byePoints ? "Pairing bye: +1 match point" : "Advances without a match"}</p>
      )}
      {error && <p id={`error-${match.id}`} role="alert" className="px-3 pb-2 text-xs text-red">{error}</p>}
    </form>
  );
}
