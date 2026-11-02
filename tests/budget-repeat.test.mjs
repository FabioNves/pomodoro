import test from "node:test";
import assert from "node:assert/strict";
import {
  applyPreset,
  dayBefore,
  describeRepeat,
  occurrencesIn,
  presetOf,
} from "../src/lib/budget/repeat.js";

const rule = (over) => ({ interval: 1, days: [], startDate: "2026-11-01", endDate: null, ...over });

test("monthly on one day, and undated once a month", () => {
  assert.deepEqual(occurrencesIn(rule({ days: [5] }), "2026-12"), [{ occ: "2026-12-05", day: 5 }]);
  assert.deepEqual(occurrencesIn(rule(), "2026-12"), [{ occ: "2026-12", day: null }]);
  assert.deepEqual(occurrencesIn(rule({ days: [5] }), "2026-10"), []);
});

test("twice a month gives two occurrences, and a short month clamps the day", () => {
  assert.deepEqual(
    occurrencesIn(rule({ days: [15, 1] }), "2027-01").map((o) => o.occ),
    ["2027-01-01", "2027-01-15"],
  );
  assert.deepEqual(occurrencesIn(rule({ days: [31] }), "2027-02"), [{ occ: "2027-02-28", day: 28 }]);
  assert.deepEqual(occurrencesIn(rule({ days: [30, 31] }), "2027-02"), [{ occ: "2027-02-28", day: 28 }]);
});

test("every 3 months counts from the start month", () => {
  const quarterly = rule({ interval: 3, days: [10] });
  const months = ["2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-05"];
  assert.deepEqual(
    months.filter((m) => occurrencesIn(quarterly, m).length),
    ["2026-11", "2027-02", "2027-05"],
  );
});

test("start and end dates cut occurrences inside a month", () => {
  const r = rule({ days: [1, 15], startDate: "2026-11-10", endDate: "2027-01-05" });
  assert.deepEqual(occurrencesIn(r, "2026-11").map((o) => o.day), [15]);
  assert.deepEqual(occurrencesIn(r, "2027-01").map((o) => o.day), [1]);
  assert.deepEqual(occurrencesIn(r, "2027-02"), []);
});

test("rules read as words and presets round-trip", () => {
  assert.equal(describeRepeat(rule({ days: [1, 15] })), "Every month on the 1st and 15th");
  assert.equal(describeRepeat(rule({ interval: 3, days: [22], endDate: "2027-12-31" })), "Every 3 months on the 22nd, until 31 Dec 2027");
  assert.equal(describeRepeat(rule({ interval: 12 })), "Every year");
  assert.equal(presetOf(applyPreset(rule({ days: [20] }), "twice")), "twice");
  assert.deepEqual(applyPreset(rule({ days: [20] }), "twice").days, [5, 20]);
  assert.equal(presetOf(rule({ interval: 5, days: [3] })), null);
  assert.equal(dayBefore("2027-03-01"), "2027-02-28");
});
