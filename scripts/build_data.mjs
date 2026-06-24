// build_data.mjs
// Converte i due CSV dei Key Concepts (Art. 7(4) Dir. 2009/147/CE) in un
// singolo JSON pre-processato, con le 36 decadi MD/RD tradotte in intervalli
// di date leggibili. Nessuna dipendenza nativa: usa solo il core di Node.
//
// Uso:  node scripts/build_data.mjs
// Input:  data/Data_Main_Species.csv , data/Data_References_Species.csv
// Output: data/key_concepts.json

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA = join(ROOT, "data");

// --- Parser CSV minimale ma corretto (gestisce campi quotati con virgole) ---
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\r") { /* skip */ }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function rowsToObjects(rows) {
  const header = rows[0];
  return rows.slice(1)
    .filter(r => r.length === header.length && r.some(v => v !== ""))
    .map(r => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

// --- Le 36 decadi -> etichette e date ---
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_IT = ["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];
// Ogni mese ha 3 decadi: I = giorni 1-10, II = 11-20, III = 21-fine mese
const DECADE_START_DAY = [1, 11, 21];
// Ultimo giorno reale di ciascun mese (anno non bisestile; feb=28) per la III decade
const MONTH_LAST_DAY = [31,28,31,30,31,30,31,31,30,31,30,31];
function decadeEndDay(month /*1..12*/, dec /*0,1,2*/) {
  return dec === 2 ? MONTH_LAST_DAY[month - 1] : [10, 20][dec];
}

function decadeToLabel(idx /*1..36*/) {
  const month = Math.floor((idx - 1) / 3);
  const dec = (idx - 1) % 3; // 0,1,2
  const roman = ["I","II","III"][dec];
  return `${MONTHS[month]} ${roman}`;
}
function decadeStartDate(idx) {
  const month = Math.floor((idx - 1) / 3);
  const dec = (idx - 1) % 3;
  return { month: month + 1, day: DECADE_START_DAY[dec] };
}
function decadeEndDate(idx) {
  const month = Math.floor((idx - 1) / 3);
  const dec = (idx - 1) % 3;
  return { month: month + 1, day: decadeEndDay(month + 1, dec) };
}
function fmtIT(d) { return `${d.day} ${MONTHS_IT[d.month - 1]}`; }

// Dato un array di 36 booleani, ritorna gli intervalli contigui di "true"
// come liste di {fromDecade,toDecade,fromLabel,toLabel,fromDateIT,toDateIT}.
function booleansToIntervals(flags) {
  const intervals = [];
  let start = null;
  for (let i = 0; i < 36; i++) {
    const on = flags[i];
    if (on && start === null) start = i;          // apre intervallo
    if ((!on || i === 35) && start !== null) {
      const end = on && i === 35 ? i : i - 1;     // chiude intervallo
      const fromIdx = start + 1, toIdx = end + 1; // 1-based
      intervals.push({
        fromDecade: fromIdx,
        toDecade: toIdx,
        fromLabel: decadeToLabel(fromIdx),
        toLabel: decadeToLabel(toIdx),
        fromDateIT: fmtIT(decadeStartDate(fromIdx)),
        toDateIT: fmtIT(decadeEndDate(toIdx)),
      });
      start = null;
    }
  }
  return intervals;
}

function readFlags(obj, prefix) {
  const flags = [];
  for (let i = 1; i <= 36; i++) flags.push(obj[`${prefix}_${i}`] === "true");
  return flags;
}

// --- MAIN ---
console.log("Lettura CSV...");
const mainRows = rowsToObjects(parseCSV(readFileSync(join(DATA, "Data_Main_Species.csv"), "utf8")));
const refRows  = rowsToObjects(parseCSV(readFileSync(join(DATA, "Data_References_Species.csv"), "utf8")));
console.log(`  Main: ${mainRows.length} righe | References: ${refRows.length} righe`);

// Indicizza i riferimenti per Casecode
const refsByCase = {};
for (const r of refRows) {
  const k = r.Casecode;
  if (!k) continue;
  (refsByCase[k] ||= []).push({
    period: r.Period,
    decade: r.Decade,
    type: r.Type,
    reference: r["Full reference"],
    studyArea: r["Study area"],
    studyPeriod: r["Study period"],
    surveyMethod: r["Survey method"],
    language: r.Language,
  });
}

const species = mainRows.map(o => {
  const md = readFlags(o, "MD");
  const rd = readFlags(o, "RD");
  return {
    scientificName: o.name,
    country: o.Country_name,
    euringCode: o.Species,
    caseCode: o.Casecode,
    status: {
      resident: o.Resident === "true",
      migrantBreeding: o["Migrant: breeding"] === "true",
      migrantPassage: o["Migrant: passage"] === "true",
      migrantWintering: o["Migrant: wintering"] === "true",
    },
    migration: {
      intervals: booleansToIntervals(md),
      comments: o.Comments_mig || "",
    },
    reproduction: {
      intervals: booleansToIntervals(rd),
      start: o.Start || "",
      end: o.M_end || "",
      comments: o.Comments_rep || "",
    },
    comments: o.Comments || "",
    referencesCount: (refsByCase[o.Casecode] || []).length,
  };
});

const out = {
  meta: {
    source: "Key Concepts of Article 7(4) of Directive 2009/147/EC",
    publisher: "European Commission, DG Environment",
    sourceUrl: "https://environment.ec.europa.eu/topics/nature-and-biodiversity/birds-directive/sustainable-hunting-under-birds-directive_en",
    circabcGroup: "3f466d71-92a7-49eb-9c63-6cb0fadf29dc",
    version: "2023-02-28",
    generatedAt: new Date().toISOString(),
    note: "Not a legally binding document. The year is divided into 36 decades (3 per month, ~10 days each).",
  },
  species,
  references: refsByCase,
};

writeFileSync(join(DATA, "key_concepts.json"), JSON.stringify(out));
console.log(`OK -> data/key_concepts.json  (${species.length} record specie/paese)`);

// --- Test rapido a video: tordo bottaccio in Italia ---
const test = species.find(s => s.scientificName === "Turdus philomelos" && s.country === "IT");
if (test) {
  console.log("\n--- TEST: Turdus philomelos / IT ---");
  console.log("Status:", JSON.stringify(test.status));
  console.log("Riproduzione:", test.reproduction.intervals.map(i => `${i.fromDateIT} - ${i.toDateIT}`).join("; "));
  console.log("Migrazione prenuziale:", test.migration.intervals.map(i => `${i.fromDateIT} - ${i.toDateIT}`).join("; "));
  console.log("Riferimenti:", test.referencesCount);
}
