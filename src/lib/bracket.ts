export type TournamentStyle = "elimination" | "swiss";
export type Scores = [number, number];
export type Results = Record<string, Scores>;
export type Match = {
  id: string;
  participants: [string | null, string | null];
  scores: Scores | null;
  winner: string | null;
  loser: string | null;
  status: "pending" | "ready" | "bye" | "complete";
};

export function parseParticipants(input: string): string[] {
  const participants = input.split(/\r?\n/).map((name) => name.trim()).filter(Boolean);
  if (participants.length < 2 || participants.length > 32) {
    throw new Error("Enter between 2 and 32 archers, one per line.");
  }
  if (new Set(participants.map((name) => name.toLowerCase())).size !== participants.length) {
    throw new Error("Each archer must have a unique name.");
  }
  return participants;
}

export function validateScores(scores: Scores): void {
  const high = Math.max(...scores);
  const low = Math.min(...scores);
  if (!scores.every(Number.isInteger) ||
      !((high === 6 && [0, 2, 4, 5].includes(low)) ||
        (high === 7 && [1, 3].includes(low)))) {
    throw new Error("Enter a completed result: 6–0, 6–2, 6–4, 7–1, 7–3, or 6–5 (shoot-off), in either order.");
  }
}

export function seedOrder(size: number): number[] {
  if (size < 2 || size > 32 || !Number.isInteger(Math.log2(size))) {
    throw new Error("Bracket size must be a power of two between 2 and 32.");
  }
  let seeds = [1, 2];
  for (let width = 4; width <= size; width *= 2) {
    seeds = seeds.flatMap((seed) => [seed, width + 1 - seed]);
  }
  return seeds;
}

function makeMatch(
  id: string,
  participants: Match["participants"],
  results: Results,
  allowBye = false,
): Match {
  const [first, second] = participants;
  const ready = first !== null && second !== null;
  const bye = allowBye && (first !== null || second !== null) && !ready;
  const scores = ready ? results[id] ?? null : null;
  if (scores) validateScores(scores);
  const winner = scores ? participants[scores[0] > scores[1] ? 0 : 1] : bye ? first ?? second : null;
  return {
    id, participants, scores, winner,
    loser: scores ? participants[scores[0] > scores[1] ? 1 : 0] : null,
    status: scores ? "complete" : bye ? "bye" : ready ? "ready" : "pending",
  };
}

export function buildElimination(participants: string[], results: Results) {
  const size = 2 ** Math.ceil(Math.log2(participants.length));
  let entrants: (string | null)[] = seedOrder(size).map((seed) => participants[seed - 1] ?? null);
  const rounds: Match[][] = [];
  while (entrants.length > 1) {
    const round: Match[] = [];
    for (let index = 0; index < entrants.length; index += 2) {
      round.push(makeMatch(
        `${rounds.length}-${index / 2}`,
        [entrants[index], entrants[index + 1]],
        results,
        rounds.length === 0,
      ));
    }
    rounds.push(round);
    entrants = round.map((match) => match.winner);
  }
  const semifinals = rounds.at(-2);
  const bronze = semifinals
    ? makeMatch(
        "bronze",
        [semifinals[0].loser, semifinals[1].loser],
        results,
        semifinals.every((match) => match.status === "complete" || match.status === "bye"),
      )
    : null;
  return { rounds, bronze };
}

export function swissRoundCount(count: number): number {
  if (!Number.isInteger(count) || count < 2 || count > 32) {
    throw new Error("Swiss tournaments require between 2 and 32 archers.");
  }
  return Math.min(Math.ceil(Math.log2(count)) + 1, count % 2 ? count : count - 1);
}

export function swissStandings(participants: string[], rounds: Match[][]) {
  const matches = rounds.flat();
  const rows = participants.map((name, index) => {
    const played = matches.filter((match) => match.status === "complete" && match.participants.includes(name));
    const wins = played.filter((match) => match.winner === name).length;
    const byes = matches.filter((match) => match.status === "bye" && match.winner === name).length;
    return { name, seed: index + 1, played: played.length, wins, byes, points: wins + byes };
  });
  const points = new Map(rows.map((row) => [row.name, row.points]));
  const ranked = rows.map((row) => {
    let buchholz = 0;
    let sonnebornBerger = 0;
    for (const match of matches) {
      if (!match.participants.includes(row.name)) continue;
      if (match.status === "bye") {
        // FIDE 2023 art. 16.4: a full-point bye is a win against a same-score dummy.
        buchholz += row.points;
        sonnebornBerger += row.points;
      } else if (match.status === "complete") {
        const opponent = match.participants.find((name) => name !== row.name);
        const opponentPoints = opponent ? points.get(opponent) ?? 0 : 0;
        buchholz += opponentPoints;
        if (match.winner === row.name) sonnebornBerger += opponentPoints;
      }
    }
    return { ...row, losses: row.played - row.wins, buchholz, sonnebornBerger };
  }).sort((a, b) => b.points - a.points || b.buchholz - a.buchholz ||
    b.sonnebornBerger - a.sonnebornBerger || a.seed - b.seed);
  return ranked.map((row) => ({
    ...row,
    rank: ranked.findIndex((other) => other.points === row.points &&
      other.buchholz === row.buchholz && other.sonnebornBerger === row.sonnebornBerger) + 1,
  }));
}

type Pair = [number, number];

function pairSwiss(participants: string[], rounds: Match[][], roundsRemaining: number): Pair[] | null {
  const count = participants.length;
  const dummy = count;
  const size = count + count % 2;
  const played = Array.from({ length: size }, () => new Set<number>());
  const rows = swissStandings(participants, rounds).sort((a, b) => b.points - a.points || a.seed - b.seed);
  const order = rows.map((row) => row.seed - 1);
  const points = new Map(rows.map((row) => [row.seed - 1, row.points]));
  for (const match of rounds.flat()) {
    const first = participants.indexOf(match.participants[0] ?? "");
    const second = match.status === "bye" ? dummy : participants.indexOf(match.participants[1] ?? "");
    if (first >= 0 && second >= 0) {
      played[first].add(second);
      played[second].add(first);
    }
  }

  function canFinishSmallField(left: number): boolean {
    if (left === 0) return true;
    function find(remaining: number[]): boolean {
      if (remaining.length === 0) return canFinishSmallField(left - 1);
      const [first, ...others] = remaining;
      for (const second of others) {
        if (played[first].has(second)) continue;
        played[first].add(second);
        played[second].add(first);
        const possible = find(others.filter((index) => index !== second));
        played[first].delete(second);
        played[second].delete(first);
        if (possible) return true;
      }
      return false;
    }
    return find(Array.from({ length: size }, (_, index) => index));
  }

  const byeCandidates = count % 2
    ? [...order].reverse().filter((index) => !played[index].has(dummy))
    : [null];
  for (const bye of byeCandidates) {
    const entrants = order.filter((index) => index !== bye);
    if (bye !== null) {
      played[bye].add(dummy);
      played[dummy].add(bye);
    }
    for (let gap = 0; gap <= rounds.length; gap += 1) {
      const failed = new Set<string>();
      function find(remaining: number[], pairs: Pair[]): Pair[] | null {
        if (remaining.length === 0) {
          // Small, nearly round-robin fields can otherwise strand two odd cycles.
          if (size <= 6 && !canFinishSmallField(roundsRemaining - 1)) return null;
          return pairs;
        }
        const key = remaining.join(",");
        if (size > 6 && failed.has(key)) return null;
        const candidates = new Map(remaining.map((first) => [first, remaining.filter((second) =>
          first !== second && !played[first].has(second) &&
          Math.abs((points.get(first) ?? 0) - (points.get(second) ?? 0)) <= gap)]));
        // An odd connected component cannot be perfectly paired. Prune it before
        // exploring permutations of disconnected score groups.
        const unseen = new Set(remaining);
        for (const start of remaining) {
          if (!unseen.has(start)) continue;
          const stack = [start];
          unseen.delete(start);
          let componentSize = 0;
          while (stack.length) {
            const current = stack.pop();
            if (current === undefined) break;
            componentSize += 1;
            for (const neighbor of candidates.get(current) ?? []) {
              if (unseen.delete(neighbor)) stack.push(neighbor);
            }
          }
          if (componentSize % 2 !== 0) {
            failed.add(key);
            return null;
          }
        }
        const first = [...remaining].sort((a, b) =>
          (candidates.get(a)?.length ?? 0) - (candidates.get(b)?.length ?? 0))[0];
        const group = entrants.filter((index) => points.get(index) === points.get(first));
        const position = group.indexOf(first);
        const half = Math.ceil(group.length / 2);
        const preferred = group[position < half ? position + half : position - half];
        const opponents = (candidates.get(first) ?? []).sort((a, b) =>
          Math.abs((points.get(first) ?? 0) - (points.get(a) ?? 0)) -
          Math.abs((points.get(first) ?? 0) - (points.get(b) ?? 0)) ||
          Number(b === preferred) - Number(a === preferred) || a - b);
        for (const second of opponents) {
          played[first].add(second);
          played[second].add(first);
          const found = find(remaining.filter((index) => index !== first && index !== second), [...pairs, [first, second]]);
          played[first].delete(second);
          played[second].delete(first);
          if (found) return found;
        }
        failed.add(key);
        return null;
      }
      const found = find(entrants, []);
      if (found) {
        const pairs = found.map(([a, b]): Pair => order.indexOf(a) < order.indexOf(b) ? [a, b] : [b, a])
          .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
        if (bye !== null) pairs.push([bye, dummy]);
        return pairs;
      }
    }
    if (bye !== null) {
      played[bye].delete(dummy);
      played[dummy].delete(bye);
    }
  }
  return null;
}

export function buildSwiss(participants: string[], results: Results) {
  const totalRounds = swissRoundCount(participants.length);
  const rounds: Match[][] = [];
  for (let round = 0; round < totalRounds; round += 1) {
    const pairs = pairSwiss(participants, rounds, totalRounds - round);
    if (!pairs) return { rounds, totalRounds, error: `Cannot pair round ${round + 1} without rematches or a repeated bye. No results were discarded.` };
    const matches = pairs.map(([first, second], index) =>
      makeMatch(`sw-${round}-${index}`, [participants[first], participants[second] ?? null], results, true));
    rounds.push(matches);
    if (matches.some((match) => match.status !== "complete" && match.status !== "bye")) break;
  }
  return { rounds, totalRounds, error: null };
}

export function saveResult(
  participants: string[],
  style: TournamentStyle,
  results: Results,
  id: string,
  scores: Scores | null,
): Results {
  if (scores) validateScores(scores);
  const tournament = style === "elimination" ? buildElimination(participants, results) : null;
  const matches = tournament
    ? [...tournament.rounds.flat(), ...(tournament.bronze ? [tournament.bronze] : [])]
    : buildSwiss(participants, results).rounds.flat();
  const match = matches.find((match) => match.id === id);
  if (!match || (match.status !== "ready" && match.status !== "complete")) {
    throw new Error("This match is not ready for a result.");
  }
  const next = { ...results };
  if (scores) next[id] = scores;
  else delete next[id];
  const winner = scores ? match.participants[scores[0] > scores[1] ? 0 : 1] : null;
  if (tournament && id !== "bronze" && winner !== match.winner) {
    const [roundIndex, initialIndex] = id.split("-").map(Number);
    let matchIndex = initialIndex;
    // Only the changed path and its dependent bronze result become invalid.
    for (let round = roundIndex + 1; round < tournament.rounds.length; round += 1) {
      matchIndex = Math.floor(matchIndex / 2);
      delete next[`${round}-${matchIndex}`];
    }
    if (roundIndex < tournament.rounds.length - 1) delete next.bronze;
  }
  if (style === "swiss" && winner !== match.winner) {
    const roundIndex = Number(id.split("-")[1]);
    for (const key of Object.keys(next)) {
      if (key.startsWith("sw-") && Number(key.split("-")[1]) > roundIndex) delete next[key];
    }
  }
  return next;
}
