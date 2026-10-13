// Publish ANP listings: validate locally, then ingest into Argosy.

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { validateAnp } from "./anp.js";

export async function publishDir({ dir, to, apiUrl, merchantId }) {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".anp.json"));
  let ok = 0, failed = 0;
  const errors = [];
  for (const f of files) {
    let doc;
    try {
      const raw = JSON.parse(await readFile(join(dir, f), "utf8"));
      doc = raw.anp || raw;
    } catch (e) {
      failed++; errors.push(`${f}: unreadable (${e.message})`); continue;
    }
    const problems = validateAnp(doc);
    if (problems.length) { failed++; errors.push(`${f}: ${problems.join("; ")}`); continue; }
    if (to === "argosy") {
      try {
        const res = await fetch(`${apiUrl.replace(/\/$/, "")}/listings/ingest`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ merchant_id: merchantId, anp: doc, source: "agentify" }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
        ok++;
      } catch (e) {
        failed++; errors.push(`${f}: ${e.message}`);
      }
    } else {
      ok++; // validate-only for unknown targets
    }
  }
  return { ok, failed, errors, total: files.length };
}
