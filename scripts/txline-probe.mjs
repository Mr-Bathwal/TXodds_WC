// Probe what real data the free World Cup tier serves: competitions, and
// odds + scores for an actual fixture.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cred = JSON.parse(fs.readFileSync(path.join(__dirname, ".txline-creds.json"), "utf8"));
const { host, apiToken } = cred;

const jwt = (await axios.post(`${host}/auth/guest/start`)).data.token;
const api = axios.create({ baseURL: host, timeout: 25000, headers: { Authorization: `Bearer ${jwt}`, "X-Api-Token": apiToken } });

const all = (await api.get("/api/fixtures/snapshot")).data;
console.log("Total fixtures:", all.length);
const byComp = {};
for (const f of all) byComp[`${f.Competition} (id ${f.CompetitionId})`] = (byComp[`${f.Competition} (id ${f.CompetitionId})`] || 0) + 1;
console.log("Competitions:", JSON.stringify(byComp, null, 1));

// Find a World Cup fixture if present, else any soccer fixture.
const wc = all.find((f) => /world cup/i.test(f.Competition)) || all[0];
console.log("\nProbe fixture:", wc.Participant1, "vs", wc.Participant2, "| comp:", wc.Competition, "| id:", wc.FixtureId, "| start:", new Date(wc.StartTime).toISOString());

for (const ep of [`/api/odds/snapshot/${wc.FixtureId}`, `/api/scores/snapshot/${wc.FixtureId}`]) {
  try {
    const r = await api.get(ep);
    console.log(`\n${ep} → OK`);
    console.log(JSON.stringify(r.data, null, 1).slice(0, 1100));
  } catch (e) {
    console.log(`\n${ep} → ERROR ${e.response?.status || ""} ${JSON.stringify(e.response?.data || e.message).slice(0, 160)}`);
  }
}
console.log("\nDONE");
