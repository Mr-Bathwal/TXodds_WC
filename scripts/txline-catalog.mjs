import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { host, apiToken } = JSON.parse(fs.readFileSync(path.join(__dirname, ".txline-creds.json"), "utf8"));
const jwt = (await axios.post(`${host}/auth/guest/start`)).data.token;
const api = axios.create({ baseURL: host, timeout: 25000, headers: { Authorization: `Bearer ${jwt}`, "X-Api-Token": apiToken } });

const log = (...a) => console.log(...a);
const today = Math.floor(Date.now() / 86400000);

/* ---------- A. Competitions available ---------- */
log("===== COMPETITIONS (across a date window) =====");
const comps = new Map();
for (const comp of [72, 430]) {
  for (const d of [today - 3, today - 1, today, today + 2]) {
    try {
      const fx = (await api.get(`/api/fixtures/snapshot`, { params: { competitionId: comp, startEpochDay: d } })).data;
      for (const f of fx) comps.set(f.CompetitionId, f.Competition);
    } catch {}
  }
}
log([...comps.entries()].map(([id, n]) => `${id}=${n}`).join(", ") || "none");

/* ---------- B. Fixture fields ---------- */
const fixtures = (await api.get(`/api/fixtures/snapshot`, { params: { competitionId: 72, startEpochDay: today - 3 } })).data;
log("\n===== FIXTURE fields =====");
log(Object.keys(fixtures[0] || {}).join(", "));
// pick a finished match id (has full history)
const richId = 18241006;

/* ---------- C. Odds markets ---------- */
log("\n===== ODDS markets for a match =====");
let odds = [];
for (const f of fixtures.slice(0, 8)) {
  const o = (await api.get(`/api/odds/snapshot/${f.FixtureId}`)).data;
  if (Array.isArray(o) && o.length) { odds = o; log(`(using ${f.Participant1} v ${f.Participant2}, ${o.length} snaps)`); break; }
}
const marketTypes = new Set(odds.map((o) => o.SuperOddsType));
log("SuperOddsType values:", [...marketTypes].join(", ") || "none");
log("odds record fields:", Object.keys(odds[0] || {}).join(", "));
if (odds[0]) log("sample odds:", JSON.stringify(odds[0]).slice(0, 320));

/* ---------- D. Score event types + stats ---------- */
log("\n===== SCORES: event Actions + stats (finished match) =====");
const scores = (await api.get(`/api/scores/snapshot/${richId}`)).data;
log("total score items:", scores.length);
log("distinct Actions:", [...new Set(scores.map((s) => s.Action))].sort().join(", "));
log("score item fields:", [...new Set(scores.flatMap((s) => Object.keys(s)))].join(", "));
// Score.Total stat keys per participant
const totals = [...scores].reverse().find((s) => s.Score?.Participant1?.Total);
log("Score.Participant1.Total keys:", Object.keys(totals?.Score?.Participant1?.Total || {}).join(", "));
log("Score.Participant2.Total keys:", Object.keys(totals?.Score?.Participant2?.Total || {}).join(", "));
log("Score periods:", Object.keys(totals?.Score?.Participant1 || {}).join(", "));
// structure of a few key event types
for (const act of ["goal", "shot", "yellow_card", "red_card", "substitution", "penalty", "lineups", "var", "corner"]) {
  const ev = scores.find((s) => s.Action === act);
  if (ev) {
    const interesting = Object.fromEntries(Object.entries(ev).filter(([k]) => /Data|Participant$|Player|Score|Outcome|Clock/.test(k)));
    log(`  [${act}]`, JSON.stringify(interesting).slice(0, 260));
  }
}

/* ---------- E. Validation / proof endpoints ---------- */
log("\n===== VALIDATION / on-chain proof endpoints =====");
const endpoints = [
  ["GET /api/fixtures/validation", `/api/fixtures/validation?fixtureId=${richId}`],
  ["GET /api/odds/validation", `/api/odds/validation?fixtureId=${richId}`],
  ["GET /api/scores/stat-validation", `/api/scores/stat-validation?fixtureId=${richId}`],
  ["GET /api/fixtures/updates", `/api/fixtures/updates`],
  ["GET /api/odds/updates", `/api/odds/updates`],
  ["GET /api/scores/updates", `/api/scores/updates`],
  ["GET /api/scores/historical", `/api/scores/historical/${richId}`],
];
for (const [label, url] of endpoints) {
  try {
    const r = await api.get(url);
    const keys = Array.isArray(r.data) ? `array[${r.data.length}] of {${Object.keys(r.data[0] || {}).slice(0, 8).join(",")}}` : `{${Object.keys(r.data).join(", ")}}`;
    log(`  ${label} → 200 ${keys}`);
  } catch (e) {
    log(`  ${label} → ${e.response?.status || e.message}`);
  }
}
log("\nDONE");
