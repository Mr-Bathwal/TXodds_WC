/**
 * Maps national-team names (as TxLINE returns them) to a flagcdn ISO code and a
 * short 3-letter code, so live fixtures render with real flags. Falls back to a
 * derived code (and no flag) for anything not listed.
 */

interface Country {
  iso: string; // flagcdn code (e.g. "br", "gb-eng")
  code: string; // 3-letter display code
}

const MAP: Record<string, Country> = {
  argentina: { iso: "ar", code: "ARG" },
  australia: { iso: "au", code: "AUS" },
  austria: { iso: "at", code: "AUT" },
  belgium: { iso: "be", code: "BEL" },
  brazil: { iso: "br", code: "BRA" },
  cameroon: { iso: "cm", code: "CMR" },
  canada: { iso: "ca", code: "CAN" },
  chile: { iso: "cl", code: "CHI" },
  colombia: { iso: "co", code: "COL" },
  "costa rica": { iso: "cr", code: "CRC" },
  croatia: { iso: "hr", code: "CRO" },
  denmark: { iso: "dk", code: "DEN" },
  ecuador: { iso: "ec", code: "ECU" },
  egypt: { iso: "eg", code: "EGY" },
  england: { iso: "gb-eng", code: "ENG" },
  france: { iso: "fr", code: "FRA" },
  germany: { iso: "de", code: "GER" },
  ghana: { iso: "gh", code: "GHA" },
  greece: { iso: "gr", code: "GRE" },
  iran: { iso: "ir", code: "IRN" },
  italy: { iso: "it", code: "ITA" },
  "ivory coast": { iso: "ci", code: "CIV" },
  japan: { iso: "jp", code: "JPN" },
  mexico: { iso: "mx", code: "MEX" },
  morocco: { iso: "ma", code: "MAR" },
  myanmar: { iso: "mm", code: "MYA" },
  netherlands: { iso: "nl", code: "NED" },
  nigeria: { iso: "ng", code: "NGA" },
  norway: { iso: "no", code: "NOR" },
  panama: { iso: "pa", code: "PAN" },
  paraguay: { iso: "py", code: "PAR" },
  peru: { iso: "pe", code: "PER" },
  poland: { iso: "pl", code: "POL" },
  portugal: { iso: "pt", code: "POR" },
  qatar: { iso: "qa", code: "QAT" },
  "saudi arabia": { iso: "sa", code: "KSA" },
  scotland: { iso: "gb-sct", code: "SCO" },
  senegal: { iso: "sn", code: "SEN" },
  serbia: { iso: "rs", code: "SRB" },
  "south korea": { iso: "kr", code: "KOR" },
  "korea republic": { iso: "kr", code: "KOR" },
  spain: { iso: "es", code: "ESP" },
  sweden: { iso: "se", code: "SWE" },
  switzerland: { iso: "ch", code: "SUI" },
  tunisia: { iso: "tn", code: "TUN" },
  turkey: { iso: "tr", code: "TUR" },
  "united states": { iso: "us", code: "USA" },
  usa: { iso: "us", code: "USA" },
  uruguay: { iso: "uy", code: "URU" },
  vietnam: { iso: "vn", code: "VIE" },
  wales: { iso: "gb-wls", code: "WAL" },
};

export function resolveCountry(name: string): Country {
  const hit = MAP[name.trim().toLowerCase()];
  if (hit) return hit;
  // Fallback: derive a 3-letter code, no flag (Flag component shows the code).
  const code = name.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() || "UNK";
  return { iso: "", code };
}
