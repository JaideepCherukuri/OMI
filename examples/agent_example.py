#!/usr/bin/env python3
"""
Example: How an LLM agent would use this SDK.

This script demonstrates the full workflow:
  1. Connect to the store
  2. Fetch all products (with images + metadata)
  3. Generate recommendations based on occasion/region/budget
  4. Populate the store with a curated catalog
  5. Get a store summary

Set environment variables before running:
    export SHOPIFY_STORE_URL="your-store.myshopify.com"
    export SHOPIFY_ACCESS_TOKEN="shpat_..."
"""

import json

from shopify_agent import ShopifyClient, GiftRecommender, StoreManager


def main():
    with ShopifyClient() as client:
        recommender = GiftRecommender(client)
        manager = StoreManager(client)

        # ── 1. List all products with images ──────────────────
        print("=" * 60)
        print("STEP 1: Fetching all products (with images & metafields)")
        print("=" * 60)

        products = recommender.fetch_all_products(include_metafields=True)
        for p in products:
            print(f"\n{p.title} — {p.price_range}")
            print(f"  Images: {p.images}")
            for v in p.variants:
                print(f"  • {v.name}: ${v.price} | Ships: {v.delivery_time} | Regions: {v.available_regions}")

        # ── 2. Get recommendations ────────────────────────────
        print("\n" + "=" * 60)
        print("STEP 2: Valentine's Day gifts under $300, shipping to India")
        print("=" * 60)

        recs = recommender.recommend(
            occasion="Valentine's Day",
            region="India",
            budget_max=300,
            top_n=3,
        )
        print(json.dumps(recs, indent=2))

        # ── 3. Human-readable recommendations ─────────────────
        print("\n" + "=" * 60)
        print("STEP 3: Formatted output for any birthday gift")
        print("=" * 60)

        print(recommender.recommend_formatted(occasion="Birthday", top_n=5))

        # ── 4. Store summary (agent context) ──────────────────
        print("\n" + "=" * 60)
        print("STEP 4: Full store summary (for agent context)")
        print("=" * 60)

        summary = manager.get_store_summary()
        print(f"Products: {summary['total_products']}")
        print(f"Total inventory: {summary['total_inventory']} units")
        print(f"Price range: {summary['price_range']}")


if __name__ == "__main__":
    main()
