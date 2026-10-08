// Joins the small files into occasions.json, the one the app reads:
//   index.json      version, updated, countries, and the order of the sets
//   sets/<id>.json  one set each
// Run: node build.mjs  (then node validate.mjs). Entries are written one per line so a diff
// shows exactly which date changed.
import { readFileSync, writeFileSync } from 'node:fs';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const index = read('./index.json');
const sets = index.sets.map((id) => {
  const set = read(`./sets/${id}.json`);
  if (set.id !== id) throw new Error(`sets/${id}.json says id "${set.id}"`);
  delete set.note; // free text for the editor, not for the app
  return set;
});
const data = { app: 'taqwimi-occasions', version: index.version, updated: index.updated, countries: index.countries, sets };

// Pretty JSON, but every entry ([month, day, name] and the like) stays on one line.
function format(value, indent = '') {
  if (Array.isArray(value)) {
    if (value.every((x) => !Array.isArray(x) && (typeof x !== 'object' || x === null))) return JSON.stringify(value);
    return `[\n${value.map((x) => `${indent}  ${format(x, indent + '  ')}`).join(',\n')}\n${indent}]`;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return '{}';
    if (keys.every((k) => typeof value[k] !== 'object' || value[k] === null) && keys.length <= 4) return JSON.stringify(value);
    return `{\n${keys.map((k) => `${indent}  ${JSON.stringify(k)}: ${format(value[k], indent + '  ')}`).join(',\n')}\n${indent}}`;
  }
  return JSON.stringify(value);
}

writeFileSync(new URL('./occasions.json', import.meta.url), format(data) + '\n');
console.log(`occasions.json: version ${data.version} (${data.updated}), ${sets.length} sets`);
