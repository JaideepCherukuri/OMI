# 🎁 Shopify Gift Store Agent SDK

A Python SDK for managing a Shopify gift store — fetch products, generate smart recommendations, and manage inventory programmatically. Built so any LLM/agent can plug in and operate a gift store autonomously.

## Features

- **Product Fetching** — Full product details including images, variants, prices, stock, delivery times, and shipping regions
- **Smart Recommendations** — Filter by occasion, region, and budget with scoring-based ranking
- **Store Management** — Create, update, and delete products with variants, images, inventory, and metafields
- **Pre-built Catalog** — 12 curated luxury gift products across 5 occasion categories
- **CLI Tool** — Command-line interface for all operations
- **Agent-Friendly** — JSON output mode, structured dataclasses, designed for LLM tool-use

## Quick Start

### 1. Install

```bash
pip install -e .
```

### 2. Configure

```bash
export SHOPIFY_STORE_URL="your-store.myshopify.com"
export SHOPIFY_ACCESS_TOKEN="shpat_your_token_here"
```

### 3. Use

```python
from shopify_agent import ShopifyClient, GiftRecommender, StoreManager

with ShopifyClient() as client:
    recommender = GiftRecommender(client)

    # Get top 5 Valentine's gifts under $300, shipping to India
    recs = recommender.recommend(
        occasion="Valentine's Day",
        region="India",
        budget_max=300,
        top_n=5,
    )

    for r in recs:
        print(f"{r['title']} — {r['price_range']}")
        print(f"  Images: {r['images']}")
        for v in r['variants']:
            print(f"  • {v['name']}: ${v['price']} | {v['delivery_time']} | {v['available_regions']}")
```

## CLI Usage

```bash
# Get recommendations
shopify-agent recommend --occasion "Valentine's Day" --region India --budget 300 --top 5

# Get recommendations as JSON (for agent consumption)
shopify-agent recommend --occasion Birthday --json

# List all products with shipping metadata
shopify-agent list-products --with-metafields

# Get store summary
shopify-agent store-summary

# Populate with luxury gift catalog
shopify-agent populate --catalog luxury_gifts

# Delete all products (interactive confirmation)
shopify-agent delete-all
```

## Architecture

```
src/shopify_agent/
├── __init__.py           # Package exports
├── client.py             # Low-level Shopify Admin REST API client
├── recommender.py        # Product fetching + recommendation engine
├── store_manager.py      # High-level store operations (CRUD + metafields)
├── cli.py                # Command-line interface
└── catalogs/
    └── luxury_gifts.py   # Pre-built luxury gift product catalog
```

### For LLM Agents

The SDK is designed so an agent can:

1. **Read** the store with `GiftRecommender.fetch_all_products()` → returns structured `ProductInfo` objects with images, variants, metafields
2. **Recommend** with `GiftRecommender.recommend()` → returns JSON-serializable dicts filtered by occasion/region/budget
3. **Write** with `StoreManager.create_product()` or `StoreManager.bulk_create_products()` → accepts `ProductInput` dataclasses
4. **Summarize** with `StoreManager.get_store_summary()` → full store state as a dict

All outputs are JSON-serializable. Use `--json` flag in CLI for machine-readable output.

## Product Catalog

The included luxury gift catalog covers:

| Occasion | Products |
|----------|----------|
| 💝 Valentine's Day | Eternal Rose Crystal Box, Couple's Spa Set |
| 🎂 Brother's Birthday | Italian Leather Duffel, Whiskey Tasting Collection |
| 💍 Wedding Anniversary | Bespoke Star Map, Silk Robe Set for Two |
| 🎉 Friend's Birthday | Chocolate & Wine Box, Adventure Experiences |
| 🎁 Any Occasion | Candle Trio, Cashmere Set, Journal & Pen, Tea Collection |

Each product includes:
- Multiple variants with individual pricing
- SKU codes for inventory tracking
- Stock levels per variant
- Delivery time per variant (stored as Shopify metafield)
- Available shipping regions per variant (stored as Shopify metafield)
- Product images from Unsplash

## Data Model

### Product → Variant Metafields

Each variant stores shipping metadata as Shopify metafields:

| Namespace | Key | Example Value |
|-----------|-----|---------------|
| `shipping` | `delivery_time` | `3-5 business days` |
| `shipping` | `available_regions` | `India, USA, UK, EU, Australia` |

These are fetched automatically when `include_metafields=True` (default).

## Testing

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests (requires store credentials in env)
export SHOPIFY_STORE_URL="your-store.myshopify.com"
export SHOPIFY_ACCESS_TOKEN="shpat_..."
pytest -v
```

Tests run against a real Shopify store and cover:
- Client HTTP operations (shop info, products, variants, metafields)
- Recommender (fetch, filter, score, format)
- Store manager (create → verify → delete lifecycle)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SHOPIFY_STORE_URL` | ✅ | Your store's myshopify.com domain |
| `SHOPIFY_ACCESS_TOKEN` | ✅ | Admin API access token (`shpat_...`) |

## License

MIT
