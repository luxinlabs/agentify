# Agentify

Turn any merchant catalog into **agent-native** listings.

Agentify is the open-source SDK + CLI for the [Argosy](https://github.com/luxinlabs/argosy) Agent-Native Product (ANP) schema. It takes your existing store — Shopify, WooCommerce, CSV, or a custom API — and produces machine-readable product listings that AI agents can discover, compare, trust, and buy from, with zero human UI.

## Why

AI agents are becoming shoppers: AI-referred retail traffic is up 1,219% since late 2024, and analysts size agentic commerce at $3–5T by 2030. But every product on the internet is still sold through interfaces designed for human eyeballs. Agentify closes that gap from the merchant side: five minutes from catalog to agent-readable.

## Quickstart

```bash
npx agentify init
```

This audits your catalog for agent-readiness, generates ANP listings, and publishes them to any UCP-compatible surface — and to the Argosy marketplace.

## The ANP schema

See [`anp/schema/anp-0.1.json`](anp/schema/anp-0.1.json). An agent-native listing carries:

- **Structured product data** — typed specs, not marketing copy
- **Machine-readable policies** — returns, shipping, warranty, authenticity as rules an agent can reason over
- **Live commercial state** — real-time price and inventory
- **Checkout endpoints** — UCP / ACP compatible
- **Trust attestation** — signed pointer to the merchant verification record
- **Provenance** — where the data came from, and when it was last verified

## CLI

| Command | What it does |
|---|---|
| `agentify init` | Connect a store and generate ANP listings |
| `agentify audit` | Grade your catalog’s agent-readiness |
| `agentify publish` | Push listings to UCP surfaces / Argosy |

See [`cli/`](cli/) for the implementation (v0.1 skeleton).

## License

Apache-2.0. See [LICENSE](LICENSE).
