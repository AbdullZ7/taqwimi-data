// Checks occasions.json before it is published: node validate.mjs
import { readFileSync } from 'node:fs';
const data = JSON.parse(readFileSync(new URL('./occasions.json', import.meta.url), 'utf8'));
const fail = (msg) => { console.error('✗', msg); process.exit(1); };
const str = (x) => typeof x === 'string' && x.length > 0;
const isoDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
if (data.app !== 'taqwimi-occasions' || !Number.isInteger(data.version)) fail('app/version');
if (!isoDay(data.updated)) fail('updated must be YYYY-MM-DD');
if (!Array.isArray(data.sets) || !Array.isArray(data.countries)) fail('sets/countries');
for (const c of data.countries) if (!str(c.id) || !str(c.name)) fail('country');
const ids = new Set();
for (const s of data.sets) {
  if (!str(s.id) || !str(s.name) || ids.has(s.id)) fail(`set ${s.id}`);
  ids.add(s.id);
  if (s.country && !data.countries.some((c) => c.id === s.country)) fail(`${s.id}: country`);
  for (const [m, d, n] of s.hijri ?? []) if (!(m >= 1 && m <= 12 && d >= 1 && d <= 30 && str(n))) fail(`${s.id}: hijri ${n}`);
  for (const [m, d, n] of s.yearly ?? []) if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31 && str(n))) fail(`${s.id}: yearly ${n}`);
  for (const [m, wd, k, n] of s.nth ?? []) if (!(m >= 1 && m <= 12 && wd >= 0 && wd <= 6 && Number.isInteger(k) && k !== 0 && k <= 5 && str(n))) fail(`${s.id}: nth ${n}`);
  for (const [a, b, n] of s.dated ?? []) if (!(isoDay(a) && (b == null || (isoDay(b) && b >= a)) && str(n))) fail(`${s.id}: dated ${n}`);
  if (s.monthly) {
    const { day, fri, sat, fixed } = s.monthly;
    if (!(day >= 1 && day <= 28 && Number.isInteger(fri) && Number.isInteger(sat))) fail(`${s.id}: monthly`);
    for (const [ym, d] of Object.entries(fixed ?? {})) if (!(/^\d{4}-\d{2}$/.test(ym) && d >= 1 && d <= 31)) fail(`${s.id}: fixed ${ym}`);
  }
}
console.log(`✓ occasions.json: version ${data.version} (${data.updated}), ${data.sets.length} sets`);
