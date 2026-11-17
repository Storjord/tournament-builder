import assert from "node:assert/strict";
import test from "node:test";
import {
  buildElimination, parseParticipants, saveResult, seedOrder, validateScores,
} from "../src/lib/bracket.ts";

const archers = (count) => Array.from({ length: count }, (_, index) => `Archer ${index + 1}`);

test("accepts all participant counts from 2 to 32, preserving qualification order", () => {
  assert.deepEqual(parseParticipants(" B \r\n\n A "), ["B", "A"]);
  for (let count = 2; count <= 32; count++) {
    assert.deepEqual(parseParticipants(archers(count).join("\n")), archers(count));
  }
  for (const input of ["", "A", "A\na", archers(33).join("\n")]) assert.throws(() => parseParticipants(input));
});

test("accepts exactly the reachable completed scores, including shoot-offs", () => {
  // Enumerate legal set outcomes, stopping immediately when someone reaches six.
  const reachable = new Set(["6,5", "5,6"]);
  function play(a, b, sets) {
    if (a >= 6 || b >= 6) { reachable.add(`${a},${b}`); return; }
    if (sets === 5) return;
    for (const [x, y] of [[2, 0], [1, 1], [0, 2]]) play(a + x, b + y, sets + 1);
  }
  play(0, 0, 0);
  for (let a = 0; a <= 8; a++) {
    for (let b = 0; b <= 8; b++) {
      if (reachable.has(`${a},${b}`)) validateScores([a, b]);
      else assert.throws(() => validateScores([a, b]));
    }
  }
  for (const scores of [[6.5, 0], [NaN, 0], [Infinity, 0], [6, -1]]) assert.throws(() => validateScores(scores));
});

test("seed order separates top seeds until their intended rounds", () => {
  assert.deepEqual(seedOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]);
  for (const size of [2, 4, 8, 16, 32]) {
    const order = seedOrder(size);
    assert.equal(new Set(order).size, size);
    for (let top = 2; top <= size; top *= 2) {
      const blocks = order.reduce((found, seed, index) => {
        if (seed <= top) found.add(Math.floor(index / (size / top)));
        return found;
      }, new Set());
      assert.equal(blocks.size, top);
    }
  }
  for (const size of [0, 1, 3, 64]) assert.throws(() => seedOrder(size));
});

test("all field sizes grant byes to highest seeds and play N-1 elimination matches", () => {
  for (let count = 2; count <= 32; count++) {
    const participants = archers(count);
    let results = {};
    let tournament = buildElimination(participants, results);
    const byeCount = 2 ** Math.ceil(Math.log2(count)) - count;
    assert.deepEqual(
      tournament.rounds[0].filter((match) => match.status === "bye").map((match) => match.winner).sort(),
      participants.slice(0, byeCount).sort(),
    );
    assert.equal(tournament.rounds.at(-1)[0].winner, null);
    let played = 0;
    for (let round = 0; round < tournament.rounds.length; round++) {
      tournament = buildElimination(participants, results);
      for (const match of tournament.rounds[round]) {
        if (match.status === "bye") continue;
        assert.equal(match.status, "ready");
        results = saveResult(participants, "elimination", results, match.id, [6, 0]);
        played++;
      }
    }
    tournament = buildElimination(participants, results);
    assert.equal(played, count - 1);
    assert.ok(tournament.rounds.at(-1)[0].winner);
    if (count === 2) assert.equal(tournament.bronze, null);
    else if (count === 3) {
      assert.equal(tournament.bronze.status, "bye");
      assert.ok(tournament.bronze.winner);
    } else assert.equal(tournament.bronze.status, "ready");
  }
});

test("pending matches never auto-advance and cannot receive results", () => {
  const participants = archers(4);
  const results = saveResult(participants, "elimination", {}, "0-0", [6, 0]);
  assert.equal(buildElimination(participants, results).rounds[1][0].status, "pending");
  assert.throws(() => saveResult(participants, "elimination", results, "1-0", [6, 0]));
  assert.throws(() => saveResult(participants, "elimination", {}, "missing", [6, 0]));
  assert.throws(() => saveResult(archers(3), "elimination", {}, "0-0", [6, 0]));
});

test("bronze uses semifinal losers; score corrections preserve or clear the correct results", () => {
  const participants = archers(8);
  let results = {};
  for (const [id, scores] of [
    ["0-0", [6, 0]], ["0-1", [6, 0]], ["0-2", [6, 0]], ["0-3", [6, 0]],
    ["1-0", [6, 0]], ["1-1", [6, 0]], ["2-0", [6, 5]], ["bronze", [7, 3]],
  ]) results = saveResult(participants, "elimination", results, id, scores);
  const tournament = buildElimination(participants, results);
  assert.deepEqual(tournament.bronze.participants, ["Archer 4", "Archer 3"]);
  assert.equal(tournament.rounds[2][0].loser, "Archer 2");
  const correction = saveResult(participants, "elimination", results, "0-0", [6, 2]);
  assert.deepEqual(correction["2-0"], [6, 5]);
  assert.deepEqual(correction.bronze, [7, 3]);
  const changed = saveResult(participants, "elimination", results, "0-0", [0, 6]);
  for (const id of ["1-0", "2-0", "bronze"]) assert.equal(changed[id], undefined);
  assert.deepEqual(changed["1-1"], [6, 0]);
  assert.equal(buildElimination(participants, changed).bronze.status, "pending");
  const cleared = saveResult(participants, "elimination", results, "1-0", null);
  assert.equal(cleared["2-0"], undefined);
  assert.equal(cleared.bronze, undefined);
  const finalChange = saveResult(participants, "elimination", results, "2-0", [0, 6]);
  assert.deepEqual(finalChange.bronze, [7, 3]);
  assert.deepEqual(results["2-0"], [6, 5]);
});
