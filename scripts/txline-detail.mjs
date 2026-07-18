import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { host, apiToken } = JSON.parse(fs.readFileSync(path.join(__dirname, ".txline-creds.json"), "utf8"));
const jwt = (await axios.post(`${host}/auth/guest/start`)).data.token;
const api = axios.create({ baseURL: host, timeout: 25000, headers: { Authorization: `Bearer ${jwt}`, "X-Api-Token": apiToken } });
const clip = (o, n = 400) => JSON.stringify(o).slice(0, n);

const scores = (await api.get(`/api/scores/snapshot/18241006`)).data;

// 1. Lineups — real player data?
const lu = scores.find((s) => s.Action === "lineups") || scores.find((s) => s.Lineups);
console.log("LINEUPS keys:", Object.keys(lu?.Lineups || lu || {}).join(","));
console.log("LINEUPS sample:", clip(lu?.Lineups ?? lu?.Data ?? {}, 500));

// 2. players_on_the_pitch
const pop = scores.find((s) => s.Action === "players_on_the_pitch");
console.log("\nplayers_on_the_pitch:", clip(pop?.Data ?? pop?.Lineups ?? {}, 500));

// 3. Possession event tagging
const poss = scores.find((s) => /possession/.test(s.Action || ""));
console.log("\nPOSSESSION fields:", clip({ Action: poss?.Action, Possession: poss?.Possession, PossessionType: poss?.PossessionType, Participant: poss?.Participant, Data: poss?.Data }));

// 4. Shot outcomes distinct
const shots = scores.filter((s) => s.Action === "shot");
console.log("\nSHOT count:", shots.length, "outcomes:", [...new Set(shots.map((s) => s.Data?.Outcome))].join(","), "teams:", [...new Set(shots.map((s) => s.Participant))].join(","));

// 5. red_card / foul presence + free_kick tagging
console.log("\nred_card present:", scores.some((s) => s.Action === "red_card"));
const fk = scores.find((s) => s.Action === "free_kick");
console.log("free_kick sample:", clip({ Participant: fk?.Participant, Data: fk?.Data }));

// 6. Do any events carry player NAMES?
const withName = scores.find((s) => JSON.stringify(s).match(/"(PlayerName|Name|Player)":/));
console.log("\nany player names?", withName ? clip(Object.fromEntries(Object.entries(withName).filter(([k]) => /Name|Player|Lineup/.test(k))), 400) : "NO — IDs only");

// 7. Full validation proof shape (sizes)
const val = (await api.get(`/api/fixtures/validation?fixtureId=18241006`)).data;
console.log("\nVALIDATION summary keys:", Object.keys(val.summary || {}).join(","));
console.log("subTreeProof len:", (val.subTreeProof || []).length, "mainTreeProof len:", (val.mainTreeProof || []).length);
console.log("proof node sample:", clip(val.subTreeProof?.[0] ?? {}, 200));

// 8. Meta events
for (const a of ["weather", "pitch", "venue", "coverage_update", "kickoff_team", "injury"]) {
  const e = scores.find((s) => s.Action === a);
  if (e) console.log(`meta[${a}]:`, clip(e.Data ?? {}, 150));
}
console.log("DONE");
