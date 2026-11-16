import assert from "node:assert/strict";
import { initialCriteria, initialPreview } from "../lib/initial-preview";
import type { InitialRow } from "../lib/types";

const row = (code: string, values: Partial<InitialRow> = {}): InitialRow => ({
  code, name: code, resolution: null, collection: null, gpr: null, timeliness: null,
  resolutionMonths: 0, collectionMonths: 0, gprMonths: 0, timelinessMonths: 0,
  total: null, rank: null, tieBreakRank: null, status: "Missing", ...values,
});
const weights = [.35, .30, .20, .15];
const partial = row("partial", { resolution: .9, collection: .8, timeliness: 1 });
const complete = row("complete", { resolution: .6, collection: .6, gpr: 60, timeliness: .6, total: .6, rank: 1 });
const empty = row("empty");
const original = JSON.stringify([partial, complete, empty]);
const preview = initialPreview([complete, empty, partial], weights);
assert.equal(preview[0].code, "partial");
assert.ok(Math.abs(preview[0].displayTotal! - .705) < 1e-12);
assert.equal(preview[0].entered, 3);
assert.equal(preview[0].provisional, true);
assert.equal(preview[0].total, null, "A preview must never create an official qualifying total");
assert.equal(preview[0].rank, null, "A preview must never create an official rank");
assert.equal(preview[0].displayRank, 1);
assert.equal(preview[1].rank, 1);
assert.equal(preview[1].displayRank, 2);
assert.equal(preview[2].displayTotal, null);
assert.equal(preview[2].displayRank, null);
assert.equal(initialCriteria(partial, weights)[2].actual, null);
assert.equal(initialCriteria(complete, weights)[2].actual, .6);
assert.equal(initialCriteria(complete, weights)[2].weighted, .12);
assert.equal(JSON.stringify([partial, complete, empty]), original);
const ties = initialPreview(Array.from({length: 7}, (_,i) => row(String(i), {collection:.5})), weights);
assert.equal(ties.filter(r=>r.previewTop5).length, 5);
assert.deepEqual(ties.filter(r=>r.previewTop5).map(r=>r.code), ["0","1","2","3","4"]);
assert.ok(ties.every(r=>r.displayRank===1 && r.total===null));
console.log("Initial previews: weighted partial totals, actual percentages, provisional ranks, stable Top 5, and unchanged official eligibility verified.");
