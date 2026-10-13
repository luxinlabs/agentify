// ANP v0.1 builder + validator.
// Mirrors anp/schema/anp-0.1.json and argosy's server-side validation so
// anything agentify emits is ingestible by Argosy ("portable for argosy").

export const ANP_VERSION = "0.1";

const REQUIRED_TOP = ["anpVersion", "product", "offers", "policies", "provenance"];
const REQUIRED_PRODUCT = ["id", "name"];
const RECOMMENDED_TOP = ["identifiers", "fulfillment", "checkout", "trust"];

const num = (v, dflt = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
};
const bool = (v) => v === true || v === "true" || v === "1" || v === "yes";

function parseSpecs(v) {
  if (!v) return {};
  if (typeof v === "object") return v;
  try { return JSON.parse(v); } catch { return {}; }
}

/** Map a normalized catalog row to an ANP v0.1 document. */
export function buildAnp(row, source = "agentify") {
  const now = new Date().toISOString();
  const shippingDays = num(row.shipping_days, 5);
  const returnsAllowed = row.returns_allowed === undefined ? true : bool(row.returns_allowed);
  return {
    anpVersion: ANP_VERSION,
    product: {
      id: String(row.id ?? ""),
      name: String(row.name ?? ""),
      brand: String(row.brand ?? ""),
      description: String(row.description ?? ""),
      category: String(row.category ?? ""),
      ...(row.image_url ? { imageUrls: [String(row.image_url)] } : {}),
      specifications: parseSpecs(row.specs),
    },
    identifiers: {
      ...(row.sku ? { sku: String(row.sku) } : {}),
      ...(row.gtin ? { gtin: String(row.gtin) } : {}),
    },
    offers: {
      price: num(row.price),
      currency: String(row.currency || "USD").toUpperCase(),
      availability: num(row.stock, 0) > 0 ? "in_stock" : "out_of_stock",
      inventoryQuantity: Math.max(0, Math.floor(num(row.stock, 0))),
    },
    fulfillment: {
      shippingOptions: [
        { name: "standard", cost: 0, currency: String(row.currency || "USD").toUpperCase(), maxDeliveryDays: shippingDays },
      ],
    },
    policies: {
      returns: {
        allowed: returnsAllowed,
        windowDays: returnsAllowed ? 30 : 0,
        conditions: returnsAllowed ? "unopened" : "final sale",
      },
      ...(row.warranty ? { warranty: String(row.warranty) } : {}),
      authenticityGuarantee: true,
    },
    ...(row.checkout_url ? { checkout: { ucpEndpoint: String(row.checkout_url) } } : {}),
    trust: {},
    provenance: { source: String(source), lastVerified: now, verifiedBy: "agentify" },
  };
}

/** Structural validation. Returns string[] of problems (empty = valid). */
export function validateAnp(doc) {
  const problems = [];
  if (!doc || typeof doc !== "object") return ["document must be an object"];
  for (const f of REQUIRED_TOP) if (!(f in doc)) problems.push(`missing required field: ${f}`);
  const p = doc.product;
  if (p && typeof p === "object")
    for (const f of REQUIRED_PRODUCT) if (!p[f]) problems.push(`missing product.${f}`);
  const o = doc.offers;
  if (o && typeof o === "object") {
    if (o.price === undefined || o.price === null) problems.push("offers must include price");
    if (!o.currency) problems.push("offers must include currency");
  }
  return problems;
}

/** 0..1 completeness score (same formula as Argosy server). */
export function completeness(doc) {
  if (!doc || typeof doc !== "object") return 0;
  const req = REQUIRED_TOP.filter((f) => doc[f]).length;
  const rec = RECOMMENDED_TOP.filter((f) => doc[f]).length;
  const p = doc.product || {};
  const prod = REQUIRED_PRODUCT.filter((f) => p[f]).length;
  const total = REQUIRED_TOP.length + 0.5 * RECOMMENDED_TOP.length + REQUIRED_PRODUCT.length;
  return Math.round(((req + 0.5 * rec + prod) / total) * 1000) / 1000;
}
