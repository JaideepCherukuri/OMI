"""
Store inventory manager.

High-level operations for populating, updating, and cleaning a
Shopify gift store.  Designed so an LLM agent can call these
methods directly with structured product data.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

from shopify_agent.client import ShopifyClient


@dataclass
class VariantInput:
    """Input for creating a product variant."""

    option_value: str
    price: str
    sku: str
    inventory_quantity: int = 0
    compare_at_price: str | None = None
    delivery_time: str | None = None
    available_regions: str | None = None


@dataclass
class ProductInput:
    """Input for creating a product."""

    title: str
    description_html: str
    vendor: str
    product_type: str
    tags: list[str]
    variants: list[VariantInput]
    option_name: str = "Style"
    image_urls: list[str] = field(default_factory=list)
    status: str = "active"


@dataclass
class OperationResult:
    """Result of a store operation."""

    success: bool
    product_id: int | None = None
    title: str = ""
    message: str = ""
    variant_count: int = 0


class StoreManager:
    """High-level store management operations."""

    def __init__(self, client: ShopifyClient) -> None:
        self.client = client
        self._location_id: int | None = None

    @property
    def location_id(self) -> int:
        if self._location_id is None:
            self._location_id = self.client.get_primary_location_id()
        return self._location_id

    # ── Product Creation ───────────────────────────────────────

    def create_product(self, product: ProductInput) -> OperationResult:
        """
        Create a single product with variants, images, inventory, and metafields.

        Args:
            product: A ProductInput dataclass with all product details.

        Returns:
            OperationResult with success status and created product ID.
        """
        try:
            # Build Shopify product payload
            payload: dict[str, Any] = {
                "title": product.title,
                "body_html": product.description_html,
                "vendor": product.vendor,
                "product_type": product.product_type,
                "tags": ", ".join(product.tags),
                "status": product.status,
                "options": [{"name": product.option_name}],
                "variants": [],
            }

            for v in product.variants:
                variant: dict[str, Any] = {
                    "option1": v.option_value,
                    "price": v.price,
                    "sku": v.sku,
                    "inventory_management": "shopify",
                    "inventory_policy": "deny",
                }
                if v.compare_at_price:
                    variant["compare_at_price"] = v.compare_at_price
                payload["variants"].append(variant)

            if product.image_urls:
                payload["images"] = [
                    {"src": url, "position": i + 1}
                    for i, url in enumerate(product.image_urls)
                ]

            # Create the product
            created = self.client.create_product(payload)
            product_id = created["id"]

            # Set inventory levels and metafields per variant
            for i, created_variant in enumerate(created.get("variants", [])):
                input_variant = product.variants[i]
                vid = created_variant["id"]

                # Set inventory
                inv_item_id = self.client.get_variant(vid)["inventory_item_id"]
                self.client.set_inventory_level(
                    inventory_item_id=inv_item_id,
                    location_id=self.location_id,
                    available=input_variant.inventory_quantity,
                )

                # Set delivery time metafield
                if input_variant.delivery_time:
                    self.client.set_variant_metafield(
                        variant_id=vid,
                        namespace="shipping",
                        key="delivery_time",
                        value=input_variant.delivery_time,
                    )

                # Set available regions metafield
                if input_variant.available_regions:
                    self.client.set_variant_metafield(
                        variant_id=vid,
                        namespace="shipping",
                        key="available_regions",
                        value=input_variant.available_regions,
                    )

            return OperationResult(
                success=True,
                product_id=product_id,
                title=product.title,
                message=f"Created with {len(created.get('variants', []))} variants",
                variant_count=len(created.get("variants", [])),
            )

        except Exception as e:
            return OperationResult(
                success=False,
                title=product.title,
                message=str(e),
            )

    def bulk_create_products(
        self, products: list[ProductInput], delay: float = 0.5
    ) -> list[OperationResult]:
        """
        Create multiple products with a delay between each to respect rate limits.

        Args:
            products: List of ProductInput objects.
            delay:    Seconds to wait between API calls (Shopify rate limit safety).

        Returns:
            List of OperationResult for each product.
        """
        results: list[OperationResult] = []
        for i, product in enumerate(products, 1):
            print(f"[{i}/{len(products)}] Creating: {product.title}...")
            result = self.create_product(product)
            status = "✅" if result.success else "❌"
            print(f"  {status} {result.message}")
            results.append(result)
            if delay > 0 and i < len(products):
                time.sleep(delay)
        return results

    # ── Product Deletion ───────────────────────────────────────

    def delete_products(self, product_ids: list[int]) -> list[OperationResult]:
        """
        Delete products by ID.

        Args:
            product_ids: List of Shopify product IDs to delete.

        Returns:
            List of OperationResult for each deletion.
        """
        results: list[OperationResult] = []
        for pid in product_ids:
            try:
                self.client.delete_product(pid)
                results.append(
                    OperationResult(success=True, product_id=pid, message="Deleted")
                )
            except Exception as e:
                results.append(
                    OperationResult(
                        success=False, product_id=pid, message=str(e)
                    )
                )
        return results

    def delete_all_products(self) -> list[OperationResult]:
        """Delete every product in the store. Use with caution!"""
        products = self.client.get_products(fields="id")
        ids = [p["id"] for p in products]
        return self.delete_products(ids)

    # ── Product Updates ────────────────────────────────────────

    def update_product_images(
        self, product_id: int, image_urls: list[str]
    ) -> OperationResult:
        """Replace all images on a product."""
        try:
            images = [{"src": url, "position": i + 1} for i, url in enumerate(image_urls)]
            self.client.update_product(product_id, {"images": images})
            return OperationResult(
                success=True,
                product_id=product_id,
                message=f"Updated {len(image_urls)} images",
            )
        except Exception as e:
            return OperationResult(
                success=False, product_id=product_id, message=str(e)
            )

    def update_variant_metadata(
        self,
        variant_id: int,
        delivery_time: str | None = None,
        available_regions: str | None = None,
    ) -> OperationResult:
        """Update shipping metafields on a variant."""
        try:
            if delivery_time:
                self.client.set_variant_metafield(
                    variant_id, "shipping", "delivery_time", delivery_time
                )
            if available_regions:
                self.client.set_variant_metafield(
                    variant_id, "shipping", "available_regions", available_regions
                )
            return OperationResult(
                success=True, message="Metafields updated"
            )
        except Exception as e:
            return OperationResult(success=False, message=str(e))

    # ── Store Summary ──────────────────────────────────────────

    def get_store_summary(self) -> dict[str, Any]:
        """
        Get a complete store summary — useful as context for an LLM agent.

        Returns a dict with product count, total inventory, price range,
        and per-product summaries.
        """
        products = self.client.get_products()
        total_inventory = 0
        all_prices: list[float] = []
        product_summaries: list[dict] = []

        for p in products:
            variants = p.get("variants", [])
            images = [img["src"] for img in p.get("images", [])]
            prices = [float(v.get("price", 0)) for v in variants]
            stock = sum(v.get("inventory_quantity", 0) for v in variants)
            total_inventory += stock
            all_prices.extend(prices)

            product_summaries.append(
                {
                    "id": p["id"],
                    "title": p["title"],
                    "vendor": p.get("vendor", ""),
                    "type": p.get("product_type", ""),
                    "status": p.get("status", ""),
                    "tags": p.get("tags", ""),
                    "price_range": (
                        f"${min(prices):,.2f}–${max(prices):,.2f}"
                        if prices
                        else "N/A"
                    ),
                    "total_stock": stock,
                    "variants": len(variants),
                    "images": images,
                }
            )

        return {
            "total_products": len(products),
            "total_inventory": total_inventory,
            "price_range": (
                f"${min(all_prices):,.2f}–${max(all_prices):,.2f}"
                if all_prices
                else "N/A"
            ),
            "products": product_summaries,
        }
