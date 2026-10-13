#!/usr/bin/env node
// agentify v0.1 — turn any merchant catalog into agent-native (ANP) listings.
//
//   agentify init --from csv --input products.csv --out ./anp
//   agentify audit --from csv --input products.csv
//   agentify publish --dir ./anp --to argosy --api-url http://localhost:8000 --merchant-id 1

import { readCsv, readJson, readShopify, normalizeRows } from "./adapters.js";
import { buildAnp, validateAnp, completeness } from "./anp.js";
import { auditCatalog, printAudit } from "./audit.js";
import { publishDir } from "./publish.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";

const HELP = `
agentify — turn any merchant catalog into agent-native listings.

Usage:
  agentify init --from <csv|json|shopify> --input <path> --out <dir> [--source <name>]
      Shopify: --input <store-domain>  (uses the public /products.json feed)
  agentify audit --from <csv|json|shopify> --input <path>
  agentify publish --dir <anp-dir> --to argosy --api-url <url> --merchant-id <id>

Examples:
  agentify init --from csv --input products.csv --out ./anp
  agentify audit --from csv --input products.csv
  agentify publish --dir ./anp --to argosy --api-url http://localhost:8000 --merchant-id 1
`;

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) out[a.slice(2)] = argv[i + 1] ?? true;
    else if (!out._cmd) out._cmd = a;
  }
  return out;
}

async function loadRows(from, input) {
  if (from === "csv") return readCsv(input);
  if (from === "json") return readJson(input);
  if (from === "shopify") return readShopify(input);
  throw new Error(`unknown --from "${from}" (csv|json|shopify)`);
}

async function cmdInit(a) {
  const { from, input, out, source } = a;
  if (!from || !input || !out) throw new Error("init needs --from, --input, --out");
  const rows = normalizeRows(await loadRows(from, input));
  mkdirSync(out, { recursive: true });
  const index = [];
  let ok = 0, bad = 0;
  for (const row of rows) {
    const doc = buildAnp(row, source || from);
    const problems = validateAnp(doc);
    const file = join(out, `${String(row.id || `row-${ok + bad}`).replace(/[^a-zA-Z0-9_-]/g, "_")}.anp.json`);
    const meta = {
      source: source || from,
      last_verified: new Date().toISOString(),
      verified_by: "agentify",
      completeness_score: completeness(doc),
    };
    writeFileSync(file, JSON.stringify({ anp: doc, metadata: meta }, null, 2));
    index.push({ file: basename(file), id: row.id, name: row.name, valid: problems.length === 0, problems });
    problems.length ? bad++ : ok++;
  }
  writeFileSync(join(out, "index.json"), JSON.stringify(index, null, 2));
  console.log(`init: ${ok} valid, ${bad} invalid ANP listings -> ${out}`);
  for (const e of index.filter((i) => !i.valid).slice(0, 5))
    console.log(`  ! ${e.file}: ${e.problems.join("; ")}`);
}

async function cmdAudit(a) {
  const { from = "csv", input } = a;
  if (!input) throw new Error("audit needs --input");
  const rows = normalizeRows(await loadRows(from, input));
  printAudit(auditCatalog(rows));
}

async function cmdPublish(a) {
  const { dir, to = "argosy", "api-url": apiUrl, "merchant-id": merchantId } = a;
  if (!dir) throw new Error("publish needs --dir");
  if (to === "argosy" && (!apiUrl || !merchantId))
    throw new Error("publish --to argosy needs --api-url and --merchant-id");
  const res = await publishDir({ dir, to, apiUrl, merchantId: Number(merchantId) });
  console.log(`publish: ${res.ok} ingested, ${res.failed} failed -> ${apiUrl}`);
  for (const f of res.errors.slice(0, 5)) console.log(`  ! ${f}`);
}

async function main() {
  const a = args(process.argv.slice(2));
  try {
    if (a._cmd === "init") await cmdInit(a);
    else if (a._cmd === "audit") await cmdAudit(a);
    else if (a._cmd === "publish") await cmdPublish(a);
    else console.log(HELP);
  } catch (e) {
    console.error("error:", e.message);
    process.exit(1);
  }
}

main();
