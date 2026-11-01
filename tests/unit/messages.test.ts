// S1-14 · en.json and fr.json must hold exactly the same keys: a text added in one language only
// would show its key instead of a sentence for half of the visitors.
import { test } from "node:test";
import assert from "node:assert/strict";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

function keys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

test("en.json and fr.json have the same keys", () => {
  const enKeys = new Set(keys(en));
  const frKeys = new Set(keys(fr));
  assert.deepEqual([...enKeys].filter((k) => !frKeys.has(k)), [], "missing in fr.json");
  assert.deepEqual([...frKeys].filter((k) => !enKeys.has(k)), [], "missing in en.json");
});

test("no empty text", () => {
  for (const [name, file] of [["en", en], ["fr", fr]] as const) {
    const empty = keys(file).filter((k) => k.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], file) === "");
    assert.deepEqual(empty, [], `empty texts in ${name}.json`);
  }
});
