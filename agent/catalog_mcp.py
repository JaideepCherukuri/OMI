"""
Shopify Catalog MCP Client — Global Product Search.

This module provides:
1. JWT token management (auto-refresh when expired)
2. search_products — search ALL Shopify merchants by query
3. get_product_details — get full product detail by UPID
4. Storefront MCP — single-store search (no auth needed)

Catalog MCP endpoint: https://catalog.shopify.com/api/mcp
Storefront MCP endpoint: https://{store}.myshopify.com/api/mcp

Protocol: JSON-RPC 2.0 via HTTP POST

Auth: Bearer JWT token from https://api.shopify.com/auth/access_token
  - Token scope: read_global_api_catalog_search
  - Expires after ~1 hour, auto-refreshed
"""

import httpx
import json
import time
import logging
from typing import Optional, Any

logger = logging.getLogger(__name__)


class CatalogMCPClient:
    """Client for Shopify's global Catalog MCP server."""

    TOKEN_URL = "https://api.shopify.com/auth/access_token"
    CATALOG_URL = "https://catalog.shopify.com/api/mcp"

    def __init__(self, client_id: str, client_secret: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self._token: Optional[str] = None
        self._token_expiry: float = 0
        self._request_id = 0

    async def _ensure_token(self):
        """Get or refresh the JWT bearer token."""
        if self._token and time.time() < self._token_expiry - 60:
            return  # Token still valid (with 60s buffer)

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                self.TOKEN_URL,
                json={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "grant_type": "client_credentials",
                },
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()
            self._token = data["access_token"]
            # JWT tokens from Shopify expire in ~3600s
            self._token_expiry = time.time() + 3500
            logger.info("Catalog MCP: JWT token refreshed")

    async def _call(self, method: str, params: dict) -> dict:
        """Make a JSON-RPC 2.0 call to the Catalog MCP."""
        await self._ensure_token()
        self._request_id += 1

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                self.CATALOG_URL,
                json={
                    "jsonrpc": "2.0",
                    "method": method,
                    "id": self._request_id,
                    "params": params,
                },
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self._token}",
                },
            )
            resp.raise_for_status()
            data = resp.json()

            if "error" in data:
                raise Exception(f"Catalog MCP error: {data['error']}")

            return data.get("result", {})

    async def search_products(
        self,
        query: str,
        context: str = "",
        limit: int = 10,
        max_price: float = None,
        min_price: float = None,
        ships_to: str = None,
    ) -> list:
        """
        Search across ALL Shopify merchants.

        Returns a list of offer objects with:
          - id (UPID), title, description, images, options
          - priceRange, products (per-shop with checkoutUrl)
        """
        args: dict[str, Any] = {
            "query": query,
            "context": context or f"Customer is looking for: {query}",
            "limit": min(limit, 100),
        }
        if max_price is not None:
            args["max_price"] = max_price
        if min_price is not None:
            args["min_price"] = min_price
        if ships_to:
            args["ships_to"] = ships_to

        result = await self._call("tools/call", {
            "name": "search_products",
            "arguments": args,
        })

        content = result.get("content", [])
        if not content:
            return []

        try:
            data = json.loads(content[0].get("text", "{}"))
            return data.get("offers", [])
        except json.JSONDecodeError:
            return []

    async def get_product_details(
        self,
        upid: str,
        context: str = "",
        ships_to: str = None,
    ) -> Optional[dict]:
        """
        Get full product details by Universal Product ID (UPID).

        Returns product dict with images, options, variants, descriptions,
        and per-shop checkout URLs.
        """
        args: dict[str, Any] = {
            "upid": upid,
            "context": context or "Customer wants product details",
        }
        if ships_to:
            args["ships_to"] = ships_to

        result = await self._call("tools/call", {
            "name": "get_product_details",
            "arguments": args,
        })

        content = result.get("content", [])
        if not content:
            return None

        try:
            data = json.loads(content[0].get("text", "{}"))
            return data.get("product")
        except json.JSONDecodeError:
            return None


class StorefrontMCPClient:
    """Client for a single Shopify store's Storefront MCP server (no auth needed)."""

    def __init__(self, store_domain: str):
        """
        Args:
            store_domain: e.g. "jaguar-9969.myshopify.com"
        """
        if not store_domain.startswith("http"):
            store_domain = f"https://{store_domain}"
        self.mcp_url = f"{store_domain.rstrip('/')}/api/mcp"
        self._request_id = 0

    async def _call(self, tool_name: str, arguments: dict) -> dict:
        """Make a JSON-RPC 2.0 tool call."""
        self._request_id += 1

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                self.mcp_url,
                json={
                    "jsonrpc": "2.0",
                    "method": "tools/call",
                    "id": self._request_id,
                    "params": {
                        "name": tool_name,
                        "arguments": arguments,
                    },
                },
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()

            if "error" in data:
                raise Exception(f"Storefront MCP error: {data['error']}")

            content = data.get("result", {}).get("content", [])
            if content:
                try:
                    return json.loads(content[0].get("text", "{}"))
                except json.JSONDecodeError:
                    return {"raw": content[0].get("text", "")}
            return {}

    async def search_catalog(self, query: str, context: str = "") -> list:
        """Search the store's product catalog."""
        data = await self._call("search_shop_catalog", {
            "query": query,
            "context": context or f"Customer searching for: {query}",
        })
        return data.get("products", [])

    async def get_product_details(self, product_id: str) -> Optional[dict]:
        """Get product details by Shopify product GID."""
        data = await self._call("get_product_details", {
            "product_id": product_id,
        })
        return data.get("product")

    async def search_policies(self, query: str) -> list:
        """Search store policies and FAQs."""
        data = await self._call("search_shop_policies_and_faqs", {
            "query": query,
        })
        return data if isinstance(data, list) else [data]

    async def get_cart(self, cart_id: str) -> Optional[dict]:
        """Get cart contents."""
        data = await self._call("get_cart", {"cart_id": cart_id})
        return data.get("cart")

    async def update_cart(
        self,
        lines: list,
        cart_id: str = None,
    ) -> Optional[dict]:
        """Add/update cart items. Creates a new cart if no cart_id."""
        args: dict[str, Any] = {"lines": lines}
        if cart_id:
            args["cart_id"] = cart_id
        data = await self._call("update_cart", args)
        return data.get("cart")
