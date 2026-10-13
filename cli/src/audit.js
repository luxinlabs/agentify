// Agent-readiness audit: grade a catalog 0-100 across five dimensions.

const WEIGHTS = {
  structured_data: 0.30,
  policy_completeness: 0.25,
  commercial_state: 0.20,
  discoverability: 0.15,
  checkout_readiness: 0.10,
};

function frac(rows, pred) {
  if (!rows.length) return 0;
  return rows.filter(pred).length / rows.length;
}

export function auditCatalog(rows) {
  const dims = {
    structured_data: frac(rows, (r) => r.id && r.name && r.price !== undefined && r.currency),
    policy_completeness: frac(rows, (r) => r.returns_allowed !== undefined && (r.warranty || r.returns_allowed !== false)),
    commercial_state: frac(rows, (r) => r.price !== undefined && r.currency && r.stock !== undefined),
    discoverability: frac(rows, (r) => r.category && r.description && r.image_url),
    checkout_readiness: frac(rows, (r) => !!r.checkout_url),
  };
  const score = Math.round(
    Object.entries(WEIGHTS).reduce((s, [k, w]) => s + dims[k] * w, 0) * 100
  );
  const recs = [];
  if (dims.structured_data < 1) recs.push("Add missing id/name/price/currency to every row.");
  if (dims.policy_completeness < 1) recs.push("Declare returns + warranty per product — agents can't buy what they can't verify.");
  if (dims.commercial_state < 1) recs.push("Include live price, currency, and stock counts.");
  if (dims.discoverability < 0.8) recs.push("Add category, description, and image_url for better matching.");
  if (dims.checkout_readiness < 1) recs.push("Add checkout_url (UCP endpoint) so agents can complete purchase.");
  return { score, rows: rows.length, dimensions: dims, recommendations: recs };
}

export function printAudit(a) {
  console.log(`\nagent-readiness: ${a.score}/100  (${a.rows} products)\n`);
  for (const [k, v] of Object.entries(a.dimensions)) {
    const bar = "█".repeat(Math.round(v * 20)).padEnd(20, "░");
    console.log(`  ${k.padEnd(20)} ${bar} ${Math.round(v * 100)}%`);
  }
  if (a.recommendations.length) {
    console.log("\nrecommendations:");
    for (const r of a.recommendations) console.log(`  - ${r}`);
  }
  console.log();
}
