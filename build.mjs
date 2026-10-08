// Joins the CSV tables into occasions.json, the one file the app reads. Run: node build.mjs
//
//   meta.csv       المفتاح, القيمة                               version / updated
//   countries.csv  المعرّف, الاسم, العلم
//   sets.csv       المعرّف, الاسم, البلد, الأيقونة, اللون, الوصف, بلا مفتاح   the groups, in display order
//   yearly.csv     المجموعة, التقويم, الشهر, اليوم, الاسم        every year (هجري | ميلادي)
//   nth.csv        المجموعة, الشهر, يوم الأسبوع, الترتيب, الاسم  e.g. the 2nd Monday of October
//   monthly.csv    المجموعة, اليوم, الجمعة, السبت                monthly payments and their weekend shifts
//   fixed.csv      المجموعة, الشهر, اليوم                        announced exceptions (YYYY-MM)
//   dated.csv      المجموعة, من, إلى, الاسم                      one-off dates or ranges
//
// Entries are written one per line, so a diff shows exactly which date changed.
import { readFileSync, writeFileSync } from 'node:fs';

const here = (p) => new URL(p, import.meta.url);
const fail = (file, line, msg) => { console.error(`✗ ${file} سطر ${line}: ${msg}`); process.exit(1); };

// A small CSV reader: UTF-8 with or without BOM, CRLF or LF, quotes doubled inside quotes.
function csv(file) {
  const text = readFileSync(here(file), 'utf8').replace(/^﻿/, '');
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim() !== ''));
  const keys = head.map((h) => h.trim());
  return body.map((r, i) => ({ ...Object.fromEntries(keys.map((k, j) => [k, (r[j] ?? '').trim()])), _line: i + 2 }));
}

// Column names: Arabic as in the files; the English names are accepted too.
const col = (row, ...names) => { for (const n of names) if (n in row) return row[n]; return ''; };
const must = (file, row, ...names) => { const v = col(row, ...names); if (v === '') fail(file, row._line, `العمود «${names[0]}» فارغ`); return v; };
const int = (file, row, ...names) => { const v = col(row, ...names); if (v === '') return null; if (!/^-?\d+$/.test(v)) fail(file, row._line, `«${v}» ليس رقمًا`); return +v; };
const isoDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const date = (file, row, ...names) => { const v = col(row, ...names); if (v === '') return null; if (!isoDay(v)) fail(file, row._line, `التاريخ «${v}» يجب أن يكون بصيغة YYYY-MM-DD`); return v; };

const meta = Object.fromEntries(csv('meta.csv').map((r) => [col(r, 'المفتاح', 'key'), col(r, 'القيمة', 'value')]));
const countries = csv('countries.csv').map((r) => {
  const c = { id: must('countries.csv', r, 'المعرّف', 'id'), name: must('countries.csv', r, 'الاسم', 'name') };
  const flag = col(r, 'العلم', 'flag'); if (flag) c.flag = flag;
  return c;
});
const sets = csv('sets.csv').map((r) => {
  const set = { id: must('sets.csv', r, 'المعرّف', 'id') };
  const country = col(r, 'البلد', 'country'); if (country) set.country = country;
  if (/^(نعم|yes|true|1)$/i.test(col(r, 'بلا مفتاح', 'fixed'))) set.fixed = true;
  set.name = must('sets.csv', r, 'الاسم', 'name');
  const hint = col(r, 'الوصف', 'hint'); if (hint) set.hint = hint;
  set.icon = must('sets.csv', r, 'الأيقونة', 'icon');
  set.color = must('sets.csv', r, 'اللون', 'color');
  return set;
});
const byId = new Map(sets.map((s) => [s.id, s]));
const setOf = (file, r) => { const id = must(file, r, 'المجموعة', 'set'); const s = byId.get(id); if (!s) fail(file, r._line, `المجموعة «${id}» ليست في sets.csv`); return s; };

for (const r of csv('yearly.csv')) {
  const s = setOf('yearly.csv', r), cal = must('yearly.csv', r, 'التقويم', 'calendar');
  const key = /^(هجري|hijri)$/i.test(cal) ? 'hijri' : /^(ميلادي|gregorian)$/i.test(cal) ? 'yearly' : null;
  if (!key) fail('yearly.csv', r._line, `التقويم «${cal}» يجب أن يكون هجري أو ميلادي`);
  (s[key] ??= []).push([int('yearly.csv', r, 'الشهر', 'month'), int('yearly.csv', r, 'اليوم', 'day'), must('yearly.csv', r, 'الاسم', 'name')]);
}
for (const r of csv('nth.csv')) {
  const s = setOf('nth.csv', r);
  (s.nth ??= []).push([int('nth.csv', r, 'الشهر', 'month'), int('nth.csv', r, 'يوم الأسبوع', 'weekday'), int('nth.csv', r, 'الترتيب', 'nth'), must('nth.csv', r, 'الاسم', 'name')]);
}
for (const r of csv('monthly.csv')) {
  const s = setOf('monthly.csv', r);
  if (s.monthly) fail('monthly.csv', r._line, `المجموعة «${s.id}» لها قاعدة شهرية واحدة فقط`);
  s.monthly = { day: int('monthly.csv', r, 'اليوم', 'day'), fri: int('monthly.csv', r, 'الجمعة', 'fri') ?? 0, sat: int('monthly.csv', r, 'السبت', 'sat') ?? 0 };
}
for (const r of csv('fixed.csv')) {
  const s = setOf('fixed.csv', r), ym = must('fixed.csv', r, 'الشهر', 'month');
  if (!s.monthly) fail('fixed.csv', r._line, `المجموعة «${s.id}» ليس لها قاعدة شهرية في monthly.csv`);
  if (!/^\d{4}-\d{2}$/.test(ym)) fail('fixed.csv', r._line, `الشهر «${ym}» يجب أن يكون بصيغة YYYY-MM`);
  (s.monthly.fixed ??= {})[ym] = int('fixed.csv', r, 'اليوم', 'day');
}
for (const r of csv('dated.csv')) {
  const s = setOf('dated.csv', r);
  const from = date('dated.csv', r, 'من', 'from');
  if (!from) fail('dated.csv', r._line, 'العمود «من» فارغ');
  (s.dated ??= []).push([from, date('dated.csv', r, 'إلى', 'to'), must('dated.csv', r, 'الاسم', 'name')]);
}

const version = +meta.version;
if (!Number.isInteger(version)) fail('meta.csv', 2, 'version يجب أن يكون رقمًا صحيحًا');
if (!isoDay(meta.updated)) fail('meta.csv', 3, 'updated يجب أن يكون بصيغة YYYY-MM-DD');
const data = { app: 'taqwimi-occasions', version, updated: meta.updated, countries, sets };

// Pretty JSON, but every entry ([month, day, name] and the like) stays on one line.
function format(value, indent = '') {
  if (Array.isArray(value)) {
    if (value.every((x) => !Array.isArray(x) && (typeof x !== 'object' || x === null))) return JSON.stringify(value);
    return `[\n${value.map((x) => `${indent}  ${format(x, indent + '  ')}`).join(',\n')}\n${indent}]`;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.every((k) => typeof value[k] !== 'object' || value[k] === null) && keys.length <= 4) return JSON.stringify(value);
    return `{\n${keys.map((k) => `${indent}  ${JSON.stringify(k)}: ${format(value[k], indent + '  ')}`).join(',\n')}\n${indent}}`;
  }
  return JSON.stringify(value);
}
writeFileSync(here('./occasions.json'), format(data) + '\n');
console.log(`occasions.json: version ${data.version} (${data.updated}), ${sets.length} sets`);
