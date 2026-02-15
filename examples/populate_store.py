#!/usr/bin/env python3
"""
Example: Populate the store with the luxury gift catalog.

Set environment variables before running:
    export SHOPIFY_STORE_URL="your-store.myshopify.com"
    export SHOPIFY_ACCESS_TOKEN="shpat_..."
"""

from shopify_agent import ShopifyClient, StoreManager
from shopify_agent.catalogs.luxury_gifts import LUXURY_GIFT_CATALOG


def main():
    with ShopifyClient() as client:
        manager = StoreManager(client)

        print(f"Creating {len(LUXURY_GIFT_CATALOG)} luxury gift products...\n")
        results = manager.bulk_create_products(LUXURY_GIFT_CATALOG)

        ok = sum(1 for r in results if r.success)
        print(f"\n{'=' * 40}")
        print(f"Created: {ok}/{len(results)}")
        print(f"Total products in store: {client.product_count()}")

        for r in results:
            status = "✅" if r.success else "❌"
            print(f"  {status} {r.title} — {r.message}")


if __name__ == "__main__":
    main()
