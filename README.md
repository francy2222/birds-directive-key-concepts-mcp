# Birds Directive – Key Concepts MCP

An MCP server exposing the EU Birds Directive Art. 7(4) **"Key Concepts"** data:
the periods of **reproduction** and **pre-nuptial migration** for each huntable
bird species (Annex II of Directive 2009/147/EC) in each Member State.

It lets you check whether a given hunting-season date falls within a protected
period (reproduction / pre-nuptial migration) for a given species and country,
on the basis of the official EU reference data.

> ⚠️ **Disclaimer.** This is a technical support tool. The Key Concepts document
> provides the best available scientific information but, as the Commission itself
> states, it is **not a legally binding document**. Any use in legal proceedings
> requires the assessment of a qualified lawyer.

---

## Tools

- **`kc_list_species`** — list huntable species available for a Member State (default IT).
- **`kc_get_species`** — reproduction and pre-nuptial migration periods (as dates) for a species in a country.
- **`kc_check_date`** — given a species, a country and a date (DD/MM), says whether that date falls in a protected period. The key tool for checking hunting-calendar legality.
- **`kc_get_references`** — official bibliographic references backing the data for a species.

---

## Data source and provenance

Official **"Key Concepts of Article 7(4) of Directive 2009/147/EC"** dataset,
published by the European Commission (DG Environment) on the CIRCABC repository.

- Landing page: <https://environment.ec.europa.eu/topics/nature-and-biodiversity/birds-directive/sustainable-hunting-under-birds-directive_en>
- CIRCABC group: `3f466d71-92a7-49eb-9c63-6cb0fadf29dc`
- "Full database" library: `d71c596a-d00c-431a-800e-d8b5024a3156`
- File: *"The full database with all the data and references used"* (MS Access `.accdb`, ~3.7 MB, version dated 2023-02-28)

Downloaded via the CIRCABC REST endpoint (public / guest access):

```
https://circabc.europa.eu/rest/download/26e134ef-8180-436c-a473-4335bd6430ef?ticket=
```

The original `.accdb` is kept in `source/` for reproducibility. Its two tables
were exported to CSV (`data/`) and pre-processed into `data/key_concepts.json`.

EU public information, reusable under the Commission's reuse policy.
Attribution: © European Union, DG Environment.

---

## Data model

The Access database has two tables, exported to CSV:

**`Data Main Species`** — one row per *species × Member State*. The year is split
into **36 decades** (3 per month, ~10 days each). Columns `MD_1…MD_36` flag the
pre-nuptial migration period, `RD_1…RD_36` the reproduction period. Plus status
booleans (Resident, Migrant: breeding/passage/wintering) and notes.

**`Data References Species`** — bibliographic references supporting each datum.

The build script translates the 36-decade flags into readable date ranges and
merges everything into a single JSON the server loads in memory.

---

## Repository layout

```
birds-directive-key-concepts-mcp/
├── api/mcp.js                    MCP server (Vercel entry point)
├── data/
│   ├── key_concepts.json         generated dataset served by the MCP
│   ├── Data_Main_Species.csv     source CSV
│   └── Data_References_Species.csv
├── source/key_concepts.accdb     original official file (archive)
├── scripts/build_data.mjs        CSV → JSON converter (decades → dates)
├── test_local.mjs                local tool tests (no network)
├── package.json
├── vercel.json
└── README.md
```

---

## Build & test locally

```bash
node scripts/build_data.mjs   # regenerates data/key_concepts.json from the CSVs
node test_local.mjs           # runs the four tools against the real data
```

## Updating the data

The Key Concepts document is updated rarely (2001, 2009, 2014, current 2023-02-28).
To refresh: download the latest `.accdb` from the CIRCABC library above, export the
two tables to CSV into `data/`, then run `node scripts/build_data.mjs`.

---

## License

Code: MIT. Data: © European Union, reused under the Commission's reuse policy.
