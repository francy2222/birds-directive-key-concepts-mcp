// test_local.mjs — prova i tool MCP in locale senza rete
import handler from "./api/mcp.js";

function call(rpcMethod, params) {
  return new Promise((resolve) => {
    let payload;
    const res = {
      setHeader() { return res; },
      status() { return res; },
      json(x) { payload = x; resolve(payload); return res; },
      end() { resolve(payload || {}); return res; },
    };
    // method = metodo HTTP (POST); il metodo JSON-RPC va nel body
    handler({ method: "POST", body: { jsonrpc: "2.0", id: 1, method: rpcMethod, params }, headers: {} }, res);
  });
}

const r = (x) => JSON.parse(x.result.content[0].text);

const list = await call("tools/list");
console.log("TOOLS:", list.result.tools.map(t => t.name).join(", "));

console.log("\n=== kc_get_species: Turdus philomelos / IT ===");
const sp = r(await call("tools/call", { name: "kc_get_species", arguments: { name: "Turdus philomelos", country: "IT" } }))[0];
console.log("Riproduzione:", sp.reproduction.periods);
console.log("Migrazione prenuziale:", sp.prenuptialMigration.periods);

console.log("\n=== kc_check_date: tordo bottaccio, 31/01 ===");
console.log(r(await call("tools/call", { name: "kc_check_date", arguments: { name: "Turdus philomelos", date: "31/01", country: "IT" } }))[0].verdict);

console.log("\n=== kc_check_date: tordo bottaccio, 25/08 ===");
console.log(r(await call("tools/call", { name: "kc_check_date", arguments: { name: "Turdus philomelos", date: "25/08", country: "IT" } }))[0].verdict);

console.log("\n=== kc_check_date: beccaccia / Scolopax rusticola, 31/01 ===");
const bec = r(await call("tools/call", { name: "kc_check_date", arguments: { name: "Scolopax rusticola", date: "31/01", country: "IT" } }));
console.log(bec[0] ? bec[0].verdict : bec.error);

console.log("\n=== kc_get_references: tordo bottaccio (conteggio) ===");
const refs = r(await call("tools/call", { name: "kc_get_references", arguments: { name: "Turdus philomelos", country: "IT" } }));
console.log("Riferimenti trovati:", refs[0] ? refs[0].references.length : refs.error);

console.log("\n=== kc_list_species: IT (conteggio) ===");
const li = r(await call("tools/call", { name: "kc_list_species", arguments: { country: "IT" } }));
console.log("Specie IT:", li.count);
