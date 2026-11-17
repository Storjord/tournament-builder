import assert from "node:assert/strict";
import test from "node:test";
import { buildSwiss, saveResult, swissRoundCount, swissStandings } from "../src/lib/bracket.ts";

const archers = (count) => Array.from({ length: count }, (_, index) => `Archer ${index + 1}`);

test("round count uses the agreed extra-round policy and rejects invalid sizes", () => {
  for (let count = 2; count <= 32; count++) {
    assert.equal(swissRoundCount(count), Math.min(Math.ceil(Math.log2(count)) + 1, count % 2 ? count : count - 1));
  }
  assert.deepEqual([2, 3, 4, 5, 8, 9, 16, 17, 32].map(swissRoundCount), [1, 3, 3, 4, 4, 5, 5, 6, 6]);
  for (const count of [0, 1, 33, 2.5, NaN]) assert.throws(() => swissRoundCount(count));
});

test("first round uses qualification top-half versus bottom-half, with lowest-seed bye", () => {
  const even = buildSwiss(archers(8), {});
  assert.deepEqual(even.rounds[0].map((match) => match.participants), [
    ["Archer 1", "Archer 5"], ["Archer 2", "Archer 6"],
    ["Archer 3", "Archer 7"], ["Archer 4", "Archer 8"],
  ]);
  const odd = buildSwiss(archers(7), {});
  assert.deepEqual(odd.rounds[0].at(-1).participants, ["Archer 7", null]);
  assert.equal(odd.rounds[0].at(-1).status, "bye");
});

test("next round is gated on all results, and same-score groups pair when feasible", () => {
  const participants = archers(8);
  const initial = buildSwiss(participants, {});
  const results = {};
  for (const match of initial.rounds[0].slice(0, -1)) results[match.id] = [6, 0];
  assert.equal(buildSwiss(participants, results).rounds.length, 1);
  assert.throws(() => saveResult(participants, "swiss", results, "sw-1-0", [6, 0]));
  results[initial.rounds[0].at(-1).id] = [6, 0];
  const next = buildSwiss(participants, results);
  assert.equal(next.rounds.length, 2);
  const points = new Map(swissStandings(participants, initial.rounds.map((round) =>
    round.map((match) => ({ ...match, status: "complete", winner: match.participants[0] })))).map((row) => [row.name, row.points]));
  for (const match of next.rounds[1]) assert.equal(points.get(match.participants[0]), points.get(match.participants[1]));
});

test("every field completes with no rematches/repeated byes under varied results", (context) => {
  let slowestBuild = 0;
  for (let count = 2; count <= 32; count++) {
    for (let trial = 0; trial < 20; trial++) {
      const participants = archers(count);
      let random = count * 100 + trial + 1;
      const results = {};
      const pairs = new Set();
      const byes = new Set();
      for (let round = 0; round < swissRoundCount(count); round++) {
        const start = performance.now();
        const tournament = buildSwiss(participants, results);
        slowestBuild = Math.max(slowestBuild, performance.now() - start);
        assert.equal(tournament.error, null, `field ${count}, trial ${trial}, round ${round}`);
        assert.equal(tournament.rounds.length, round + 1);
        assert.deepEqual(buildSwiss(participants, results), tournament, "pairing must be deterministic");
        const seen = new Set();
        const priorRows = swissStandings(participants, tournament.rounds.slice(0, -1));
        const bye = tournament.rounds[round].find((match) => match.status === "bye");
        if (bye) {
          const eligible = priorRows.filter((row) => !byes.has(row.name));
          assert.equal(priorRows.find((row) => row.name === bye.winner).points, Math.min(...eligible.map((row) => row.points)));
        }
        for (const match of tournament.rounds[round]) {
          for (const name of match.participants.filter(Boolean)) {
            assert.equal(seen.has(name), false);
            seen.add(name);
          }
          if (match.status === "bye") {
            assert.equal(byes.has(match.winner), false);
            byes.add(match.winner);
            assert.equal(match.scores, null);
            assert.throws(() => saveResult(participants, "swiss", results, match.id, [6, 0]));
          } else {
            const pair = [...match.participants].sort().join("|");
            assert.equal(pairs.has(pair), false);
            pairs.add(pair);
            random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
            const firstWins = trial === 0 || (trial !== 1 && random > 0x7fffffff);
            results[match.id] = firstWins ? [6, 0] : [0, 6];
          }
        }
        assert.equal(seen.size, count);
      }
      const final = buildSwiss(participants, results);
      assert.equal(final.error, null);
      assert.ok(final.rounds.flat().every((match) => match.status === "complete" || match.status === "bye"));
      assert.equal(pairs.size, Math.floor(count / 2) * final.totalRounds);
      assert.equal(byes.size, count % 2 ? final.totalRounds : 0);
      const rows = swissStandings(participants, final.rounds);
      assert.equal(rows.reduce((sum, row) => sum + row.points, 0), pairs.size + byes.size);
    }
  }
  context.diagnostic(`Slowest complete-history rebuild across 620 simulated events: ${slowestBuild.toFixed(1)} ms`);
  assert.ok(slowestBuild < 1000, "Swiss rebuilding must not block the UI for a second");
});

test("all possible outcomes for small near-round-robin fields remain pairable", () => {
  for (const count of [3, 4, 5, 6]) {
    const participants = archers(count);
    function explore(results) {
      const tournament = buildSwiss(participants, results);
      assert.equal(tournament.error, null);
      const ready = tournament.rounds.at(-1).find((match) => match.status === "ready");
      if (!ready) {
        assert.equal(tournament.rounds.length, swissRoundCount(count));
        return;
      }
      explore({ ...results, [ready.id]: [6, 0] });
      explore({ ...results, [ready.id]: [0, 6] });
    }
    explore({});
  }
});

test("Buchholz and Sonneborn-Berger use full-point same-score dummy for byes", () => {
  const participants = ["A", "B", "C"];
  let tournament = buildSwiss(participants, {});
  assert.deepEqual(swissStandings(participants, tournament.rounds).find((row) => row.name === "C"), {
    name: "C", seed: 3, played: 0, wins: 0, byes: 1, points: 1,
    losses: 0, buchholz: 1, sonnebornBerger: 1, rank: 1,
  });
  const results = {};
  // Each archer wins one actual match and receives one bye.
  for (let round = 0; round < 3; round++) {
    tournament = buildSwiss(participants, results);
    const match = tournament.rounds[round].find((match) => match.status === "ready");
    const winner = match.participants.includes("A") && match.participants.includes("B") ? "A"
      : match.participants.includes("B") ? "B" : "C";
    results[match.id] = match.participants[0] === winner ? [6, 0] : [0, 6];
  }
  const rows = swissStandings(participants, buildSwiss(participants, results).rounds);
  assert.deepEqual(rows.map((row) => [row.name, row.points, row.buchholz, row.sonnebornBerger, row.rank]),
    [["A", 2, 6, 4, 1], ["B", 2, 6, 4, 1], ["C", 2, 6, 4, 1]]);
  assert.ok(rows.every((row) => row.played === 2 && row.wins === 1 && row.byes === 1));
});

test("ranking prioritizes points, then BH, then SB, and never qualification seed", () => {
  const participants = archers(8);
  const results = {};
  for (let round = 0; round < 4; round++) {
    for (const match of buildSwiss(participants, results).rounds[round]) {
      results[match.id] = Number(match.id.split("-")[2]) % 2 ? [0, 6] : [6, 0];
    }
  }
  const rows = swissStandings(participants, buildSwiss(participants, results).rounds);
  for (let index = 1; index < rows.length; index++) {
    const a = rows[index - 1], b = rows[index];
    assert.ok(a.points > b.points || (a.points === b.points &&
      (a.buchholz > b.buchholz || (a.buchholz === b.buchholz && a.sonnebornBerger >= b.sonnebornBerger))));
    if (a.points === b.points && a.buchholz === b.buchholz && a.sonnebornBerger === b.sonnebornBerger) assert.equal(a.rank, b.rank);
    else assert.equal(b.rank, index + 1);
  }
});

test("independently calculated standings separate ties by BH before SB", () => {
  const participants = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const pairings = [
    [["A", "B"], ["C", "D"], ["E", "F"], ["G", "H"]],
    [["A", "C"], ["B", "D"], ["G", "E"], ["F", "H"]],
    [["A", "E"], ["B", "F"], ["C", "G"], ["D", "H"]],
  ];
  const rounds = pairings.map((round, index) => round.map(([winner, loser], match) => ({
    id: `sw-${index}-${match}`, participants: [winner, loser], scores: [6, 0],
    winner, loser, status: "complete",
  })));
  assert.deepEqual(swissStandings(participants, rounds).map((row) =>
    [row.name, row.points, row.buchholz, row.sonnebornBerger, row.rank]), [
    ["A", 3, 5, 5, 1], ["C", 2, 6, 3, 2], ["B", 2, 5, 2, 3], ["G", 2, 3, 1, 4],
    ["E", 1, 6, 1, 5], ["D", 1, 4, 0, 6], ["F", 1, 3, 0, 7], ["H", 0, 4, 0, 8],
  ]);
});

test("SB breaks equal-points equal-BH ties ahead of qualification order", () => {
  const pairings = [
    [["A", "B"], ["C", "D"]],
    [["A", "C"], ["B", "D"]],
    [["D", "A"], ["B", "C"]],
  ];
  const rounds = pairings.map((round, index) => round.map(([winner, loser], match) => ({
    id: `sw-${index}-${match}`, participants: [winner, loser], scores: [6, 0],
    winner, loser, status: "complete",
  })));
  assert.deepEqual(swissStandings(["B", "C", "D", "A"], rounds).map((row) =>
    [row.name, row.points, row.buchholz, row.sonnebornBerger, row.rank]), [
    ["A", 2, 4, 3, 1], ["B", 2, 4, 2, 2], ["D", 1, 5, 2, 3], ["C", 1, 5, 1, 4],
  ]);
});

test("winner corrections clear all later results; score-only corrections preserve pairings", () => {
  const participants = archers(8);
  const results = {};
  for (let round = 0; round < 4; round++) {
    for (const match of buildSwiss(participants, results).rounds[round]) results[match.id] = [6, 0];
  }
  const original = buildSwiss(participants, results);
  const correction = saveResult(participants, "swiss", results, "sw-0-0", [6, 2]);
  assert.equal(Object.keys(correction).length, 16);
  assert.deepEqual(buildSwiss(participants, correction).rounds.map((round) => round.map((match) => match.participants)),
    original.rounds.map((round) => round.map((match) => match.participants)));
  const changed = saveResult(participants, "swiss", results, "sw-0-0", [0, 6]);
  assert.deepEqual(Object.keys(changed), ["sw-0-0", "sw-0-1", "sw-0-2", "sw-0-3"]);
  assert.equal(buildSwiss(participants, changed).rounds.length, 2);
  const cleared = saveResult(participants, "swiss", results, "sw-0-0", null);
  assert.equal(buildSwiss(participants, cleared).rounds.length, 1);
  assert.equal(Object.keys(cleared).length, 3);
  assert.deepEqual(results["sw-0-0"], [6, 0]);
});
