// Catalog adapters: csv | json | shopify -> normalized rows.
// Normalized row keys: id,name,brand,description,category,price,currency,
// stock,sku,gtin,image_url,shipping_days,returns_allowed,warranty,specs,checkout_url

import { readFile } from "node:fs/promises";

/** Minimal RFC-4180-ish CSV parser (handles quoted fields + escaped quotes). */
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.length > 1 || row[0] !== "") rows.push(row);
  return rows;
}

export async function readCsv(path) {
  const text = await readFile(path, "utf8");
  const rows = parseCsv(text).filter((r) => r.some((c) => c.trim() !== ""));
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

export async function readJson(path) {
  const data = JSON.parse(await readFile(path, "utf8"));
  const arr = Array.isArray(data) ? data : data.products || data.items || [];
  return arr;
}

/** Shopify public product feed (/products.json) — no auth needed on most stores. */
export async function readShopify(domain) {
  const host = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const res = await fetch(`https://${host}/products.json?limit=250`);
  if (!res.ok) throw new Error(`shopify fetch failed: HTTP ${res.status} (is "${host}" a Shopify store?)`);
  const data = await res.json();
  return (data.products || []).map((p) => {
    const v = (p.variants || [])[0] || {};
    return {
      id: String(p.id),
      name: p.title,
      brand: p.vendor,
      description: (p.body_html || "").replace(/<[^>]+>/g, " ").slice(0, 500).trim(),
      category: p.product_type,
      price: v.price,
      currency: "USD",
      stock: v.inventory_quantity,
      sku: v.sku,
      image_url: p.images?.[0]?.src,
      specs: { tags: p.tags },
    };
  });
}

/** Fill defaults + drop rows without the bare minimum (id/name/price). */
export function normalizeRows(rows) {
  return rows
    .map((r, i) => ({
      id: r.id ?? r.sku ?? `row-${i}`,
      name: r.name ?? r.title ?? "",
      brand: r.brand ?? r.vendor ?? "",
      description: r.description ?? "",
      category: r.category ?? r.product_type ?? "",
      price: r.price,
      currency: r.currency ?? "USD",
      stock: r.stock ?? r.inventory_quantity ?? 0,
      sku: r.sku ?? "",
      gtin: r.gtin ?? "",
      image_url: r.image_url ?? "",
      shipping_days: r.shipping_days ?? 5,
      returns_allowed: r.returns_allowed ?? true,
      warranty: r.warranty ?? "",
      specs: r.specs ?? r.specifications ?? {},
      checkout_url: r.checkout_url ?? "",
    }))
    .filter((r) => String(r.name).trim() !== "" && r.price !== undefined && r.price !== "");
}
