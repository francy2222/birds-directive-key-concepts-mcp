// api/mcp.js — MCP server (Key Concepts Art. 7(4) Dir. 2009/147/CE)
// Serverless HTTP endpoint per Vercel. Espone 4 tool via protocollo MCP.
// I dati provengono da data/key_concepts.json (generato da scripts/build_data.mjs).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB = JSON.parse(readFileSync(join(__dirname, "..", "data", "key_concepts.json"), "utf8"));

// ---- Utilità date / decadi ----
const MONTHS_IT = ["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];
// Converte (giorno, mese) -> indice decade 1..36
function dateToDecade(day, month) {
  const dec = day <= 10 ? 0 : day <= 20 ? 1 : 2;
  return (month - 1) * 3 + dec + 1;
}
function decadeInIntervals(decade, intervals) {
  return intervals.some(iv => decade >= iv.fromDecade && decade <= iv.toDecade);
}

// ---- Ricerca specie ----
function findSpecies({ name, country }) {
  const c = (country || "IT").toUpperCase();
  const q = (name || "").trim().toLowerCase();
  return DB.species.filter(s => {
    if (s.country !== c) return false;
    return (
      s.scientificName.toLowerCase() === q ||
      s.scientificName.toLowerCase().includes(q) ||
      s.euringCode.toLowerCase() === q ||
      s.caseCode.toLowerCase() === q
    );
  });
}

function fmtIntervals(intervals) {
  if (!intervals.length) return "nessun periodo registrato";
  return intervals.map(i => `${i.fromDateIT} – ${i.toDateIT}`).join("; ");
}

// ---- Implementazione dei tool ----
const TOOLS = {
  kc_list_species: {
    description: "Elenca le specie cacciabili (Allegato II) disponibili per un dato Stato membro, con nome scientifico e codice EURING. Parametro: country (default IT).",
    inputSchema: {
      type: "object",
      properties: { country: { type: "string", description: "Codice Stato membro, es. IT, FR, ES (default IT)" } },
    },
    handler: ({ country }) => {
      const c = (country || "IT").toUpperCase();
      const list = DB.species.filter(s => s.country === c)
        .map(s => `${s.scientificName} (${s.euringCode})`).sort();
      return { country: c, count: list.length, species: list };
    },
  },

  kc_get_species: {
    description: "Restituisce i periodi di riproduzione e migrazione prenuziale (in date) per una specie in uno Stato membro, secondo i Key Concepts ufficiali. Parametri: name (nome scientifico o codice EURING), country (default IT).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome scientifico (es. Turdus philomelos) o codice EURING (es. A285)" },
        country: { type: "string", description: "Codice Stato membro (default IT)" },
      },
      required: ["name"],
    },
    handler: ({ name, country }) => {
      const matches = findSpecies({ name, country });
      if (!matches.length) return { error: `Nessuna corrispondenza per "${name}" in ${country || "IT"}.` };
      return matches.map(s => ({
        scientificName: s.scientificName,
        country: s.country,
        euringCode: s.euringCode,
        status: s.status,
        reproduction: {
          periods: fmtIntervals(s.reproduction.intervals),
          intervals: s.reproduction.intervals,
          start: s.reproduction.start,
          end: s.reproduction.end,
          comments: s.reproduction.comments,
        },
        prenuptialMigration: {
          periods: fmtIntervals(s.migration.intervals),
          intervals: s.migration.intervals,
          comments: s.migration.comments,
        },
        referencesCount: s.referencesCount,
        sourceNote: "Key Concepts Art. 7(4) Dir. 2009/147/CE — documento non giuridicamente vincolante.",
      }));
    },
  },

  kc_check_date: {
    description: "Verifica se una data cade in periodo protetto (riproduzione o migrazione prenuziale) per una specie in uno Stato membro. Utile per controllare la legittimità di date di apertura/chiusura della caccia. Parametri: name, date (formato GG/MM, es. 31/01), country (default IT).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome scientifico o codice EURING" },
        date: { type: "string", description: "Data in formato GG/MM, es. 31/01" },
        country: { type: "string", description: "Codice Stato membro (default IT)" },
      },
      required: ["name", "date"],
    },
    handler: ({ name, date, country }) => {
      const m = /^(\d{1,2})[\/\-.](\d{1,2})$/.exec((date || "").trim());
      if (!m) return { error: "Formato data non valido. Usa GG/MM, es. 31/01." };
      const day = parseInt(m[1], 10), month = parseInt(m[2], 10);
      if (day < 1 || day > 31 || month < 1 || month > 12) return { error: "Data fuori intervallo." };
      const matches = findSpecies({ name, country });
      if (!matches.length) return { error: `Nessuna corrispondenza per "${name}" in ${country || "IT"}.` };
      const decade = dateToDecade(day, month);
      return matches.map(s => {
        const inRepro = decadeInIntervals(decade, s.reproduction.intervals);
        const inMigr = decadeInIntervals(decade, s.migration.intervals);
        const protectedPeriod = inRepro || inMigr;
        const reasons = [];
        if (inRepro) reasons.push("periodo di riproduzione");
        if (inMigr) reasons.push("periodo di migrazione prenuziale");
        return {
          scientificName: s.scientificName,
          country: s.country,
          date: `${day} ${MONTHS_IT[month - 1]}`,
          decade,
          protected: protectedPeriod,
          verdict: protectedPeriod
            ? `Il ${day}/${month} cade in ${reasons.join(" e ")}: la caccia in questa data è in tensione con l'art. 7(4) della Direttiva Uccelli.`
            : `Il ${day}/${month} non risulta in periodo di riproduzione né di migrazione prenuziale secondo i Key Concepts.`,
          reproductionPeriods: fmtIntervals(s.reproduction.intervals),
          migrationPeriods: fmtIntervals(s.migration.intervals),
          sourceNote: "Key Concepts Art. 7(4) Dir. 2009/147/CE — documento non giuridicamente vincolante.",
        };
      });
    },
  },

  kc_get_references: {
    description: "Restituisce i riferimenti bibliografici ufficiali a supporto dei dati di una specie in uno Stato membro. Parametri: name, country (default IT).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome scientifico o codice EURING" },
        country: { type: "string", description: "Codice Stato membro (default IT)" },
      },
      required: ["name"],
    },
    handler: ({ name, country }) => {
      const matches = findSpecies({ name, country });
      if (!matches.length) return { error: `Nessuna corrispondenza per "${name}" in ${country || "IT"}.` };
      return matches.map(s => ({
        scientificName: s.scientificName,
        country: s.country,
        references: DB.references[s.caseCode] || [],
      }));
    },
  },
};

// ---- Handler MCP (JSON-RPC 2.0 su HTTP POST) ----
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const { id, method, params } = body || {};
  const reply = (result) => res.status(200).json({ jsonrpc: "2.0", id, result });
  const fail = (code, message) => res.status(200).json({ jsonrpc: "2.0", id, error: { code, message } });

  try {
    if (method === "initialize") {
      return reply({
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "birds-directive-key-concepts", version: "1.0.0" },
      });
    }
    if (method === "tools/list") {
      return reply({
        tools: Object.entries(TOOLS).map(([name, t]) => ({
          name, description: t.description, inputSchema: t.inputSchema,
        })),
      });
    }
    if (method === "tools/call") {
      const { name, arguments: args } = params || {};
      const tool = TOOLS[name];
      if (!tool) return fail(-32601, `Tool sconosciuto: ${name}`);
      const result = tool.handler(args || {});
      return reply({ content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
    }
    if (method === "notifications/initialized") return res.status(200).end();
    return fail(-32601, `Metodo non supportato: ${method}`);
  } catch (e) {
    return fail(-32603, `Errore interno: ${e.message}`);
  }
}
