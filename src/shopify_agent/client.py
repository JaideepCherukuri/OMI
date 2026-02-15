"""
Shopify Admin REST API client.

Handles all authenticated HTTP communication with a Shopify store.
Uses SHOPIFY_STORE_URL and SHOPIFY_ACCESS_TOKEN from environment.
"""

from __future__ import annotations

import os
import time
from typing import Any

import httpx


class ShopifyClient:
    """Low-level Shopify Admin REST API client with automatic rate-limit retry."""

    API_VERSION = "2024-01"
    MAX_RETRIES = 3
    RETRY_BACKOFF = 2.0  # seconds, doubles each retry

    def __init__(
        self,
        store_url: str | None = None,
        access_token: str | None = None,
    ) -> None:
        self.store_url = (store_url or os.environ["SHOPIFY_STORE_URL"]).rstrip("/")
        if not self.store_url.startswith("https://"):
            self.store_url = f"https://{self.store_url}"

        self.access_token = access_token or os.environ["SHOPIFY_ACCESS_TOKEN"]
        self.base_url = f"{self.store_url}/admin/api/{self.API_VERSION}"
        self._client = httpx.Client(
            timeout=30,
            headers={
                "X-Shopify-Access-Token": self.access_token,
                "Content-Type": "application/json",
            },
        )

    # ── Core HTTP with retry ───────────────────────────────────

    def _request(self, method: str, url: str, **kwargs) -> httpx.Response:
        """Make an HTTP request with automatic retry on 429 rate limits."""
        for attempt in range(self.MAX_RETRIES + 1):
            resp = self._client.request(method, url, **kwargs)
            if resp.status_code == 429:
                if attempt < self.MAX_RETRIES:
                    retry_after = float(resp.headers.get("Retry-After", self.RETRY_BACKOFF * (2 ** attempt)))
                    time.sleep(retry_after)
                    continue
            resp.raise_for_status()
            return resp
        resp.raise_for_status()  # Will raise if last attempt was also 429
        return resp

    def _get(self, path: str, params: dict | None = None) -> dict:
        resp = self._request("GET", f"{self.base_url}{path}", params=params)
        return resp.json()

    def _post(self, path: str, json_body: dict) -> dict:
        resp = self._request("POST", f"{self.base_url}{path}", json=json_body)
        return resp.json()

    def _put(self, path: str, json_body: dict) -> dict:
        resp = self._request("PUT", f"{self.base_url}{path}", json=json_body)
        return resp.json()

    def _delete(self, path: str) -> bool:
        self._request("DELETE", f"{self.base_url}{path}")
        return True

    # ── Products ───────────────────────────────────────────────

    def get_products(
        self,
        limit: int = 250,
        fields: str | None = None,
        status: str | None = None,
    ) -> list[dict]:
        """Fetch all products (handles pagination)."""
        params: dict[str, Any] = {"limit": min(limit, 250)}
        if fields:
            params["fields"] = fields
        if status:
            params["status"] = status

        all_products: list[dict] = []
        path = "/products.json"

        while path:
            resp = self._request(
                "GET",
                f"{self.base_url}{path}" if "?" not in path else path,
                params=params if "?" not in path else None,
            )
            data = resp.json()
            all_products.extend(data.get("products", []))

            # Handle Shopify's link-header pagination
            link = resp.headers.get("link", "")
            path = None
            if 'rel="next"' in link:
                for part in link.split(","):
                    if 'rel="next"' in part:
                        path = part.split("<")[1].split(">")[0]
                        break
        return all_products

    def get_product(self, product_id: int) -> dict:
        """Fetch a single product by ID."""
        return self._get(f"/products/{product_id}.json")["product"]

    def create_product(self, product_data: dict) -> dict:
        """Create a new product. Returns the created product."""
        return self._post("/products.json", {"product": product_data})["product"]

    def update_product(self, product_id: int, updates: dict) -> dict:
        """Update an existing product."""
        updates["id"] = product_id
        return self._put(f"/products/{product_id}.json", {"product": updates})["product"]

    def delete_product(self, product_id: int) -> bool:
        """Delete a product by ID."""
        return self._delete(f"/products/{product_id}.json")

    def product_count(self) -> int:
        """Get total product count."""
        return self._get("/products/count.json")["count"]

    # ── Variants ───────────────────────────────────────────────

    def get_variant(self, variant_id: int) -> dict:
        """Fetch a single variant."""
        return self._get(f"/variants/{variant_id}.json")["variant"]

    def update_variant(self, variant_id: int, updates: dict) -> dict:
        """Update a product variant."""
        updates["id"] = variant_id
        return self._put(f"/variants/{variant_id}.json", {"variant": updates})["variant"]

    # ── Inventory ──────────────────────────────────────────────

    def get_locations(self) -> list[dict]:
        """Get all inventory locations."""
        return self._get("/locations.json")["locations"]

    def get_primary_location_id(self) -> int:
        """Get the primary location ID."""
        locations = self.get_locations()
        return locations[0]["id"]

    def set_inventory_level(
        self, inventory_item_id: int, location_id: int, available: int
    ) -> dict:
        """Set inventory level for an item at a location."""
        return self._post(
            "/inventory_levels/set.json",
            {
                "inventory_item_id": inventory_item_id,
                "location_id": location_id,
                "available": available,
            },
        )

    # ── Metafields ─────────────────────────────────────────────

    def get_variant_metafields(self, variant_id: int) -> list[dict]:
        """Get all metafields for a variant."""
        return self._get(f"/variants/{variant_id}/metafields.json")["metafields"]

    def set_variant_metafield(
        self,
        variant_id: int,
        namespace: str,
        key: str,
        value: str,
        value_type: str = "single_line_text_field",
    ) -> dict:
        """Create or update a metafield on a variant."""
        # Check if metafield exists
        existing = self.get_variant_metafields(variant_id)
        for mf in existing:
            if mf["namespace"] == namespace and mf["key"] == key:
                return self._put(
                    f"/variants/{variant_id}/metafields/{mf['id']}.json",
                    {"metafield": {"id": mf["id"], "value": value}},
                )["metafield"]

        return self._post(
            f"/variants/{variant_id}/metafields.json",
            {
                "metafield": {
                    "namespace": namespace,
                    "key": key,
                    "value": value,
                    "type": value_type,
                }
            },
        )["metafield"]

    def get_product_metafields(self, product_id: int) -> list[dict]:
        """Get all metafields for a product."""
        return self._get(f"/products/{product_id}/metafields.json")["metafields"]

    # ── Collections ────────────────────────────────────────────

    def create_custom_collection(self, title: str, product_ids: list[int] | None = None) -> dict:
        """Create a custom collection, optionally with products."""
        body: dict[str, Any] = {"title": title}
        if product_ids:
            body["collects"] = [{"product_id": pid} for pid in product_ids]
        return self._post("/custom_collections.json", {"custom_collection": body})[
            "custom_collection"
        ]

    # ── Shop Info ──────────────────────────────────────────────

    def get_shop(self) -> dict:
        """Get shop details."""
        return self._get("/shop.json")["shop"]

    def close(self) -> None:
        """Close the HTTP client."""
        self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
