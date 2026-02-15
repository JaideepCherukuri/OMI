"""
Gift product recommender.

Fetches products from the Shopify store and provides structured
recommendations — suitable for LLM agents or direct consumption.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from shopify_agent.client import ShopifyClient


@dataclass
class VariantInfo:
    """A single product variant with full details."""

    variant_id: int
    name: str
    sku: str
    price: float
    compare_at_price: float | None
    inventory_quantity: int
    delivery_time: str | None = None
    available_regions: str | None = None


@dataclass
class ProductInfo:
    """A product with all its variants, images, and metadata."""

    product_id: int
    title: str
    description: str
    vendor: str
    product_type: str
    tags: list[str]
    status: str
    handle: str
    images: list[str]
    variants: list[VariantInfo] = field(default_factory=list)

    @property
    def price_range(self) -> str:
        prices = [v.price for v in self.variants]
        if not prices:
            return "N/A"
        lo, hi = min(prices), max(prices)
        return f"${lo:,.2f}" if lo == hi else f"${lo:,.2f}–${hi:,.2f}"

    @property
    def total_stock(self) -> int:
        return sum(v.inventory_quantity for v in self.variants)

    @property
    def has_discount(self) -> bool:
        return any(v.compare_at_price and v.compare_at_price > v.price for v in self.variants)

    def to_dict(self) -> dict[str, Any]:
        """Serialize to a dict (for JSON output / LLM consumption)."""
        return {
            "product_id": self.product_id,
            "title": self.title,
            "description_html": self.description,
            "vendor": self.vendor,
            "product_type": self.product_type,
            "tags": self.tags,
            "status": self.status,
            "handle": self.handle,
            "price_range": self.price_range,
            "total_stock": self.total_stock,
            "has_discount": self.has_discount,
            "images": self.images,
            "variants": [
                {
                    "variant_id": v.variant_id,
                    "name": v.name,
                    "sku": v.sku,
                    "price": v.price,
                    "compare_at_price": v.compare_at_price,
                    "inventory_quantity": v.inventory_quantity,
                    "delivery_time": v.delivery_time,
                    "available_regions": v.available_regions,
                }
                for v in self.variants
            ],
        }


class GiftRecommender:
    """Fetch and recommend gift products from a Shopify store."""

    def __init__(self, client: ShopifyClient) -> None:
        self.client = client

    def fetch_all_products(self, include_metafields: bool = True) -> list[ProductInfo]:
        """
        Fetch every product from the store with full details including images.

        Args:
            include_metafields: If True, fetch variant-level metafields
                                (delivery_time, available_regions). Slower but complete.

        Returns:
            List of ProductInfo objects with all details.
        """
        raw_products = self.client.get_products()
        products: list[ProductInfo] = []

        for p in raw_products:
            images = [img["src"] for img in p.get("images", [])]

            variants: list[VariantInfo] = []
            for v in p.get("variants", []):
                vi = VariantInfo(
                    variant_id=v["id"],
                    name=v.get("option1") or v.get("title", "Default"),
                    sku=v.get("sku", ""),
                    price=float(v.get("price", 0)),
                    compare_at_price=(
                        float(v["compare_at_price"])
                        if v.get("compare_at_price")
                        else None
                    ),
                    inventory_quantity=v.get("inventory_quantity", 0),
                )

                if include_metafields:
                    try:
                        mfs = self.client.get_variant_metafields(v["id"])
                        for mf in mfs:
                            if mf["key"] == "delivery_time":
                                vi.delivery_time = mf["value"]
                            elif mf["key"] == "available_regions":
                                vi.available_regions = mf["value"]
                    except Exception:
                        pass  # Metafields are optional

                variants.append(vi)

            tags = [t.strip() for t in p.get("tags", "").split(",") if t.strip()]

            products.append(
                ProductInfo(
                    product_id=p["id"],
                    title=p["title"],
                    description=p.get("body_html", ""),
                    vendor=p.get("vendor", ""),
                    product_type=p.get("product_type", ""),
                    tags=tags,
                    status=p.get("status", "active"),
                    handle=p.get("handle", ""),
                    images=images,
                    variants=variants,
                )
            )

        return products

    def recommend(
        self,
        products: list[ProductInfo] | None = None,
        occasion: str | None = None,
        region: str | None = None,
        budget_max: float | None = None,
        top_n: int = 5,
        include_metafields: bool = True,
    ) -> list[dict]:
        """
        Return the top N product recommendations as dicts.

        Filtering & ranking logic:
          1. Only active, in-stock products
          2. Filter by occasion tag if provided
          3. Filter by region availability if provided
          4. Filter by budget if provided
          5. Score: discount bonus + stock depth + variant variety
          6. Return top_n sorted by score descending

        Args:
            products:           Pre-fetched products (or None to fetch fresh).
            occasion:           Filter tag, e.g. "Valentine's Day", "Birthday".
            region:             Filter region, e.g. "India", "USA".
            budget_max:         Max price filter (any variant must be ≤ this).
            top_n:              Number of recommendations to return.
            include_metafields: Fetch delivery/region metafields (if products=None).

        Returns:
            List of product dicts ready for JSON serialization / LLM consumption.
        """
        if products is None:
            products = self.fetch_all_products(include_metafields=include_metafields)

        candidates: list[tuple[float, ProductInfo]] = []

        for p in products:
            # Must be active
            if p.status != "active":
                continue
            # Must have stock
            if p.total_stock <= 0:
                continue

            # Occasion filter
            if occasion:
                tag_match = any(occasion.lower() in t.lower() for t in p.tags)
                if not tag_match:
                    continue

            # Region filter
            if region:
                region_match = any(
                    v.available_regions and region.lower() in v.available_regions.lower()
                    for v in p.variants
                )
                if not region_match:
                    continue

            # Budget filter
            if budget_max is not None:
                cheapest = min(v.price for v in p.variants) if p.variants else 0
                if cheapest > budget_max:
                    continue

            # Scoring
            score = 0.0
            score += 20.0 if p.has_discount else 0.0        # Discount bonus
            score += min(p.total_stock / 10, 10.0)           # Stock depth (cap 10)
            score += len(p.variants) * 3.0                    # Variant variety
            score += len(p.images) * 2.0                      # Image richness
            if occasion:
                exact_match = any(occasion.lower() == t.lower() for t in p.tags)
                score += 15.0 if exact_match else 5.0

            candidates.append((score, p))

        # Sort descending by score
        candidates.sort(key=lambda x: x[0], reverse=True)

        return [p.to_dict() for _, p in candidates[:top_n]]

    def recommend_formatted(
        self,
        occasion: str | None = None,
        region: str | None = None,
        budget_max: float | None = None,
        top_n: int = 5,
    ) -> str:
        """
        Return a human-readable formatted recommendation string.

        Useful for CLI output or direct agent responses.
        """
        recs = self.recommend(
            occasion=occasion,
            region=region,
            budget_max=budget_max,
            top_n=top_n,
        )

        if not recs:
            return "No products matched your criteria."

        lines: list[str] = []
        lines.append(f"Top {len(recs)} Gift Recommendations")
        if occasion:
            lines.append(f"Occasion: {occasion}")
        if region:
            lines.append(f"Region: {region}")
        if budget_max:
            lines.append(f"Budget: up to ${budget_max:,.2f}")
        lines.append("=" * 60)

        for i, rec in enumerate(recs, 1):
            lines.append(f"\n#{i}  {rec['title']}")
            lines.append(f"    Vendor: {rec['vendor']}  |  Type: {rec['product_type']}")
            lines.append(f"    Price: {rec['price_range']}  |  Stock: {rec['total_stock']} units")
            lines.append(f"    Tags: {', '.join(rec['tags'])}")

            if rec["images"]:
                lines.append(f"    Image: {rec['images'][0]}")

            lines.append(f"    Variants:")
            for v in rec["variants"]:
                line = f"      • {v['name']} — ${v['price']:,.2f} (SKU: {v['sku']}, Stock: {v['inventory_quantity']})"
                if v.get("delivery_time"):
                    line += f" | Ships: {v['delivery_time']}"
                if v.get("available_regions"):
                    line += f" | Regions: {v['available_regions']}"
                lines.append(line)

        return "\n".join(lines)
