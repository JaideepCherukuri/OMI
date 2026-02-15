"""
CLI entry point for the Shopify Gift Store Agent.

Usage:
    shopify-agent recommend [--occasion=...] [--region=...] [--budget=...] [--top=5]
    shopify-agent list-products [--with-metafields]
    shopify-agent store-summary
    shopify-agent populate --catalog=luxury_gifts
    shopify-agent delete-all  (interactive confirmation)
"""

from __future__ import annotations

import argparse
import json
import sys

from shopify_agent.client import ShopifyClient
from shopify_agent.recommender import GiftRecommender
from shopify_agent.store_manager import StoreManager
from shopify_agent.catalogs.luxury_gifts import LUXURY_GIFT_CATALOG


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="shopify-agent",
        description="Shopify Gift Store Agent — manage inventory and recommend products",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # ── recommend ──
    rec = sub.add_parser("recommend", help="Get top gift recommendations")
    rec.add_argument("--occasion", type=str, default=None, help="Filter by occasion tag")
    rec.add_argument("--region", type=str, default=None, help="Filter by shipping region")
    rec.add_argument("--budget", type=float, default=None, help="Max budget in dollars")
    rec.add_argument("--top", type=int, default=5, help="Number of recommendations")
    rec.add_argument("--json", action="store_true", help="Output as JSON")

    # ── list-products ──
    lp = sub.add_parser("list-products", help="List all products")
    lp.add_argument("--with-metafields", action="store_true", help="Include variant metafields")
    lp.add_argument("--json", action="store_true", help="Output as JSON")

    # ── store-summary ──
    sub.add_parser("store-summary", help="Get store summary")

    # ── populate ──
    pop = sub.add_parser("populate", help="Populate store with a product catalog")
    pop.add_argument(
        "--catalog",
        type=str,
        default="luxury_gifts",
        choices=["luxury_gifts"],
        help="Catalog to populate from",
    )

    # ── delete-all ──
    sub.add_parser("delete-all", help="Delete all products (requires confirmation)")

    args = parser.parse_args()

    with ShopifyClient() as client:
        if args.command == "recommend":
            recommender = GiftRecommender(client)
            if args.json:
                recs = recommender.recommend(
                    occasion=args.occasion,
                    region=args.region,
                    budget_max=args.budget,
                    top_n=args.top,
                )
                print(json.dumps(recs, indent=2))
            else:
                print(
                    recommender.recommend_formatted(
                        occasion=args.occasion,
                        region=args.region,
                        budget_max=args.budget,
                        top_n=args.top,
                    )
                )

        elif args.command == "list-products":
            recommender = GiftRecommender(client)
            products = recommender.fetch_all_products(
                include_metafields=args.with_metafields
            )
            if args.json:
                print(json.dumps([p.to_dict() for p in products], indent=2))
            else:
                for p in products:
                    print(f"\n{'─' * 50}")
                    print(f"{p.title}  ({p.price_range})")
                    print(f"  Vendor: {p.vendor} | Type: {p.product_type} | Stock: {p.total_stock}")
                    print(f"  Tags: {', '.join(p.tags)}")
                    if p.images:
                        print(f"  Image: {p.images[0]}")
                    for v in p.variants:
                        line = f"    • {v.name} — ${v.price:,.2f} (SKU: {v.sku}, Qty: {v.inventory_quantity})"
                        if v.delivery_time:
                            line += f" | Ships: {v.delivery_time}"
                        if v.available_regions:
                            line += f" | Regions: {v.available_regions}"
                        print(line)

        elif args.command == "store-summary":
            manager = StoreManager(client)
            summary = manager.get_store_summary()
            print(json.dumps(summary, indent=2))

        elif args.command == "populate":
            manager = StoreManager(client)
            if args.catalog == "luxury_gifts":
                results = manager.bulk_create_products(LUXURY_GIFT_CATALOG)
                ok = sum(1 for r in results if r.success)
                print(f"\n{'=' * 40}")
                print(f"Created {ok}/{len(results)} products")

        elif args.command == "delete-all":
            confirm = input("⚠️  Delete ALL products? Type 'yes' to confirm: ")
            if confirm.strip().lower() == "yes":
                manager = StoreManager(client)
                results = manager.delete_all_products()
                ok = sum(1 for r in results if r.success)
                print(f"Deleted {ok}/{len(results)} products")
            else:
                print("Aborted.")
                sys.exit(0)


if __name__ == "__main__":
    main()
