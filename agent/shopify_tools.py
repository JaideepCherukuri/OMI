"""
Shopify API tools for the GiftAI voice agent.

This module provides:
1. @llm.function_tool decorated methods for LiveKit Agents SDK
2. Shopify Admin API for product search (with synonym expansion)
3. Shopify Storefront GraphQL API for cart operations
4. Data channel publishing to send structured events to the frontend

The data channel events match the PRD protocol:
  products_found → Frontend renders ProductCarousel
  cart_updated   → Frontend updates CartPanel + badge
  checkout_ready → Frontend opens checkout URL
  product_detail → Frontend shows product detail view
"""

import httpx
import json
import re
import base64
import asyncio
import logging
from typing import Optional

from livekit.agents import llm

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════
# Synonym expansion for gift search
# ═══════════════════════════════════════════
SYNONYMS = {
    "valentine": ["romance", "love", "couple", "her", "romantic"],
    "birthday": ["celebration", "party", "gift"],
    "wedding": ["couple", "anniversary", "bride", "groom", "marriage"],
    "anniversary": ["couple", "wedding", "romance"],
    "explore": ["adventure", "travel", "duffel", "outdoor", "journey"],
    "cooking": ["gourmet", "artisan", "chef", "kitchen", "culinary"],
    "luxury": ["premium", "elegant", "exquisite", "upscale"],
    "man": ["men", "him", "husband", "boyfriend", "masculine"],
    "men": ["man", "him", "husband", "boyfriend"],
    "him": ["man", "men", "husband", "boyfriend"],
    "woman": ["women", "her", "wife", "girlfriend", "feminine"],
    "women": ["woman", "her", "wife", "girlfriend"],
    "her": ["woman", "women", "wife", "girlfriend"],
    "spa": ["wellness", "relaxation", "self-care", "bath"],
    "watch": ["timepiece", "accessories"],
    "perfume": ["fragrance", "scent", "cologne"],
    "chocolate": ["sweet", "dessert", "confection"],
    "wine": ["drink", "beverage"],
    "tea": ["beverage", "drink", "wellness"],
    "journal": ["writing", "stationery", "notebook"],
    "leather": ["bag", "travel", "accessories"],
    "brother": ["him", "men", "man", "masculine"],
    "sister": ["her", "women", "woman", "feminine"],
    "father": ["him", "men", "man", "dad"],
    "mother": ["her", "women", "woman", "mom"],
    "friend": ["friendship", "bestie"],
}


class ShopifyClient:
    """Low-level Shopify API client (Admin REST + Storefront GraphQL)."""

    API_VERSION = "2024-01"

    def __init__(self, store_url: str, access_token: str):
        self.store_url = store_url.rstrip("/")
        if not self.store_url.startswith("https://"):
            self.store_url = f"https://{self.store_url}"
        self.access_token = access_token
        self.base_url = f"{self.store_url}/admin/api/{self.API_VERSION}"
        self.storefront_url = f"{self.store_url}/api/{self.API_VERSION}/graphql.json"
        self.headers = {
            "X-Shopify-Access-Token": access_token,
            "Content-Type": "application/json",
        }
        self.cart_id: Optional[str] = None
        self.cart_lines: list = []
        self._products_cache: Optional[list] = None
        self._formatted_cache: Optional[list] = None

    # ─── Admin API ────────────────────────────

    async def _admin_get(self, path: str) -> dict:
        url = f"{self.base_url}{path}"
        async with httpx.AsyncClient(timeout=30) as client:
            for attempt in range(3):
                resp = await client.get(url, headers=self.headers)
                if resp.status_code == 429:
                    retry_after = float(resp.headers.get("Retry-After", "2"))
                    await asyncio.sleep(retry_after)
                    continue
                resp.raise_for_status()
                return resp.json()
        raise Exception(f"Admin API failed after retries: {path}")

    async def get_all_products(self) -> list:
        if self._products_cache is not None:
            return self._products_cache
        data = await self._admin_get("/products.json?limit=250&status=active")
        self._products_cache = data.get("products", [])
        return self._products_cache

    # ─── Product formatting ───────────────────

    def _format_product(self, p: dict) -> dict:
        variants = []
        for v in p.get("variants", []):
            price = float(v.get("price", "0"))
            cap = v.get("compare_at_price")
            variants.append({
                "variantId": v["id"],
                "gid": f"gid://shopify/ProductVariant/{v['id']}",
                "name": v.get("title", "Default"),
                "sku": v.get("sku", ""),
                "price": price,
                "compareAtPrice": float(cap) if cap else None,
                "inventoryQuantity": v.get("inventory_quantity", 0),
                "deliveryTime": None,
                "availableRegions": None,
            })

        images = [img["src"] for img in p.get("images", [])]
        prices = [v["price"] for v in variants if v["price"] > 0]
        if prices:
            mn, mx = min(prices), max(prices)
            price_range = f"${mn:.2f}" if mn == mx else f"${mn:.2f}–${mx:.2f}"
        else:
            price_range = "N/A"

        total_stock = sum(v["inventoryQuantity"] for v in variants)
        has_discount = any(
            v["compareAtPrice"] and v["compareAtPrice"] > v["price"]
            for v in variants
        )
        tags_str = p.get("tags", "")
        tags = [t.strip() for t in tags_str.split(",") if t.strip()] if tags_str else []

        return {
            "productId": p["id"],
            "title": p.get("title", ""),
            "descriptionHtml": p.get("body_html", ""),
            "vendor": p.get("vendor", ""),
            "productType": p.get("product_type", ""),
            "tags": tags,
            "status": p.get("status", "active"),
            "handle": p.get("handle", ""),
            "images": images,
            "variants": variants,
            "priceRange": price_range,
            "totalStock": total_stock,
            "hasDiscount": has_discount,
        }

    async def get_formatted_products(self) -> list:
        if self._formatted_cache is not None:
            return self._formatted_cache
        raw = await self.get_all_products()
        self._formatted_cache = [self._format_product(p) for p in raw]
        return self._formatted_cache

    # ─── Search ───────────────────────────────

    def _expand_query(self, query: str) -> list:
        words = re.findall(r'\w+', query.lower())
        expanded = set(words)
        for w in words:
            if w in SYNONYMS:
                expanded.update(SYNONYMS[w])
        return list(expanded)

    def _score_product(self, product: dict, terms: list, max_price: float = None) -> float:
        tags = product.get("tags", [])
        if not tags:
            return 0  # CRITICAL: empty tags = no match (prevents false positives)

        title_l = product.get("title", "").lower()
        desc_l = (product.get("descriptionHtml", "") or "").lower()
        tags_l = [t.lower() for t in tags]
        type_l = (product.get("productType", "") or "").lower()

        score = 0
        for term in terms:
            if any(term in tag for tag in tags_l):
                score += 3
            if term in title_l:
                score += 2
            if term in desc_l:
                score += 1
            if term in type_l:
                score += 2

        if max_price is not None:
            min_v = min(
                (v["price"] for v in product.get("variants", []) if v["price"] > 0),
                default=999999,
            )
            if min_v > max_price:
                return 0

        return score

    async def search_products(
        self, query: str, max_price: float = None, occasion: str = None
    ) -> list:
        products = await self.get_formatted_products()
        search_q = f"{query} {occasion}" if occasion else query
        terms = self._expand_query(search_q)

        scored = [(self._score_product(p, terms, max_price), p) for p in products]
        scored = [(s, p) for s, p in scored if s > 0]
        scored.sort(key=lambda x: x[0], reverse=True)
        results = [p for _, p in scored[:6]]

        # Supplement with title matches if too few results
        if len(results) < 3:
            seen = {p["productId"] for p in results}
            for p in products:
                if p["productId"] not in seen:
                    if any(term in p.get("title", "").lower() for term in terms):
                        results.append(p)
                        if len(results) >= 5:
                            break

        return results

    async def find_product(self, title: str) -> Optional[dict]:
        """Fuzzy find a product by title."""
        products = await self.get_formatted_products()
        tl = title.lower()

        # Exact match
        for p in products:
            if p["title"].lower() == tl:
                return p

        # Substring match
        for p in products:
            if tl in p["title"].lower() or p["title"].lower() in tl:
                return p

        # Word overlap match
        words = tl.split()
        best, best_score = None, 0
        for p in products:
            pt = p["title"].lower()
            sc = sum(1 for w in words if w in pt)
            if sc > best_score:
                best_score, best = sc, p
        if best and best_score >= 1:
            return best

        return None

    # ─── Storefront GraphQL (Cart) ────────────

    async def _storefront_graphql(self, query: str, variables: dict = None) -> dict:
        async with httpx.AsyncClient(timeout=30) as client:
            body = {"query": query}
            if variables:
                body["variables"] = variables
            resp = await client.post(
                self.storefront_url,
                json=body,
                headers={
                    "X-Shopify-Access-Token": self.access_token,
                    "Content-Type": "application/json",
                },
            )
            resp.raise_for_status()
            return resp.json()

    def _parse_cart(self, cart_data: dict) -> dict:
        lines = []
        total_qty = 0
        for edge in cart_data.get("lines", {}).get("edges", []):
            node = edge["node"]
            merch = node.get("merchandise", {})
            qty = node.get("quantity", 1)
            total_qty += qty
            lines.append({
                "lineId": node["id"],
                "variantId": merch.get("id", ""),
                "productTitle": merch.get("product", {}).get("title", ""),
                "variantTitle": merch.get("title", ""),
                "quantity": qty,
                "price": merch.get("price", {}).get("amount", "0"),
                "currency": merch.get("price", {}).get("currencyCode", "INR"),
            })

        cost = cart_data.get("cost", {}).get("totalAmount", {})
        checkout_url = cart_data.get("checkoutUrl", "")
        self.cart_lines = lines

        return {
            "cartId": cart_data.get("id", self.cart_id or ""),
            "checkoutUrl": checkout_url,
            "lines": lines,
            "totalAmount": cost.get("amount", "0"),
            "currency": cost.get("currencyCode", "INR"),
            "totalQuantity": total_qty,
        }

    CART_FIELDS = """
        id checkoutUrl
        lines(first: 10) {
            edges { node { id quantity merchandise {
                ... on ProductVariant { id title
                    price { amount currencyCode }
                    product { title }
                }
            }}}
        }
        cost { totalAmount { amount currencyCode } }
    """

    async def create_cart(self, variant_gid: str) -> Optional[dict]:
        q = f"""mutation cartCreate($input: CartInput!) {{
            cartCreate(input: $input) {{
                cart {{ {self.CART_FIELDS} }}
                userErrors {{ field message }}
            }}
        }}"""
        try:
            data = await self._storefront_graphql(
                q, {"input": {"lines": [{"merchandiseId": variant_gid, "quantity": 1}]}}
            )
            cart = data.get("data", {}).get("cartCreate", {}).get("cart")
            if not cart:
                return None
            self.cart_id = cart["id"]
            return self._parse_cart(cart)
        except Exception as e:
            logger.error(f"Cart create failed: {e}")
            return None

    async def add_to_existing_cart(self, variant_gid: str) -> Optional[dict]:
        q = f"""mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {{
            cartLinesAdd(cartId: $cartId, lines: $lines) {{
                cart {{ {self.CART_FIELDS} }}
                userErrors {{ field message }}
            }}
        }}"""
        try:
            data = await self._storefront_graphql(
                q, {"cartId": self.cart_id, "lines": [{"merchandiseId": variant_gid, "quantity": 1}]}
            )
            cart = data.get("data", {}).get("cartLinesAdd", {}).get("cart")
            if not cart:
                self.cart_id = None
                return await self.create_cart(variant_gid)
            return self._parse_cart(cart)
        except Exception:
            self.cart_id = None
            return await self.create_cart(variant_gid)

    async def get_cart(self) -> Optional[dict]:
        if not self.cart_id:
            return None
        q = f"""query cart($cartId: ID!) {{
            cart(id: $cartId) {{ {self.CART_FIELDS} }}
        }}"""
        try:
            data = await self._storefront_graphql(q, {"cartId": self.cart_id})
            cart = data.get("data", {}).get("cart")
            if not cart:
                return None
            return self._parse_cart(cart)
        except Exception:
            return None

    def gen_checkout_url(self, variant_id: int, qty: int = 1) -> str:
        encoded = base64.b64encode(f"{variant_id}:{qty}".encode()).decode()
        domain = self.store_url.replace("https://", "")
        return f"https://{domain}/cart/c/{encoded}"


# ═══════════════════════════════════════════
# Tool class — discovered by llm.find_function_tools()
# ═══════════════════════════════════════════

class ShopifyTools:
    """
    Shopify tool functions for the LiveKit voice agent.

    Each @llm.function_tool method is auto-discovered by the Agents SDK and
    registered as a callable tool for Gemini. When the model decides to call
    a tool, the SDK executes it and feeds the result back to Gemini.

    We also publish structured events to the frontend via LiveKit data channel
    so the UI can render product cards, cart updates, etc. in real-time.
    """

    def __init__(self, store_url: str, access_token: str, room=None):
        self._client = ShopifyClient(store_url, access_token)
        self._room = room
        self._last_search_results: list = []

    async def _publish(self, data: dict):
        """Send structured event to the frontend via LiveKit data channel."""
        if self._room:
            try:
                payload = json.dumps(data).encode()
                await self._room.local_participant.publish_data(payload, reliable=True)
                logger.info(f"Published data channel event: {data.get('type', 'unknown')}")
            except Exception as e:
                logger.error(f"Data channel publish failed: {e}")

    @llm.function_tool(description="Search for gift products by query, occasion, or budget. Always call this for recommendations.")
    async def search_products(
        self,
        query: str,
        max_price: float | None = None,
        occasion: str | None = None,
    ) -> str:
        """Search the gift catalog. Returns product summaries for the voice response."""
        results = await self._client.search_products(query, max_price, occasion)
        self._last_search_results = results

        # Publish full product data to frontend via data channel
        if results:
            await self._publish({
                "type": "products_found",
                "products": results,
                "query": query,
            })

        if not results:
            return f"No products found matching '{query}'. Try a different search."

        # Return concise summary for voice response (Gemini shouldn't recite all details)
        summaries = []
        for i, p in enumerate(results[:6], 1):
            summaries.append(f"{i}. {p['title']} — {p['priceRange']}")
        return f"Found {len(results)} products:\n" + "\n".join(summaries)

    @llm.function_tool(description="Add a product to the shopping cart by title. Optionally specify a variant.")
    async def add_to_cart(
        self,
        product_title: str,
        variant_title: str | None = None,
    ) -> str:
        """Add a product to the user's cart."""
        product = await self._client.find_product(product_title)
        if not product:
            return f"Could not find product '{product_title}'. Please try a different name."

        variants = product.get("variants", [])
        if not variants:
            return f"No variants available for {product['title']}."

        # Select variant
        variant = variants[0]
        if variant_title:
            vt_l = variant_title.lower()
            for v in variants:
                if vt_l in v["name"].lower():
                    variant = v
                    break

        vgid = variant.get("gid") or f"gid://shopify/ProductVariant/{variant['variantId']}"

        # Add to cart via Storefront API
        if self._client.cart_id:
            cart = await self._client.add_to_existing_cart(vgid)
        else:
            cart = await self._client.create_cart(vgid)

        if cart:
            await self._publish({"type": "cart_updated", "cart": cart})
            return (
                f"Added {product['title']} ({variant['name']}) to cart! "
                f"Cart total: {cart['totalAmount']} {cart['currency']} "
                f"({cart['totalQuantity']} item{'s' if cart['totalQuantity'] != 1 else ''})"
            )

        # Fallback: generate direct checkout URL
        checkout_url = self._client.gen_checkout_url(variant["variantId"])
        fallback_cart = {
            "cartId": "direct",
            "checkoutUrl": checkout_url,
            "lines": [{
                "lineId": "1",
                "variantId": str(variant["variantId"]),
                "productTitle": product["title"],
                "variantTitle": variant["name"],
                "quantity": 1,
                "price": str(variant["price"]),
                "currency": "INR",
            }],
            "totalAmount": str(variant["price"]),
            "currency": "INR",
            "totalQuantity": 1,
        }
        await self._publish({"type": "cart_updated", "cart": fallback_cart})
        return f"Added {product['title']} to cart!"

    @llm.function_tool(description="Get detailed information about a specific product by title.")
    async def get_product_details(self, product_title: str) -> str:
        """Get full details about a product."""
        product = await self._client.find_product(product_title)
        if not product:
            return f"Product '{product_title}' not found."

        await self._publish({"type": "product_detail", "product": product})

        # Build voice-friendly summary
        desc = (product.get("descriptionHtml", "") or "")
        desc_clean = re.sub(r'<[^>]+>', ' ', desc).strip()[:200]
        variants_summary = ", ".join(
            f"{v['name']} at ${v['price']:.2f}"
            for v in product.get("variants", [])[:3]
        )
        return (
            f"{product['title']} — {product['priceRange']}. "
            f"{desc_clean}. "
            f"Available variants: {variants_summary}. "
            f"Stock: {product['totalStock']} units."
        )

    @llm.function_tool(description="View the current shopping cart contents and total.")
    async def view_cart(self) -> str:
        """Show what's in the cart."""
        cart = await self._client.get_cart()
        if not cart or not cart.get("lines"):
            return "Your cart is empty. Add some gifts to get started!"

        await self._publish({"type": "cart_updated", "cart": cart})

        items = []
        for line in cart["lines"]:
            items.append(f"- {line['productTitle']} ({line['variantTitle']}) × {line['quantity']}")
        return (
            f"Your cart has {cart['totalQuantity']} item{'s' if cart['totalQuantity'] != 1 else ''}:\n"
            + "\n".join(items)
            + f"\nTotal: {cart['totalAmount']} {cart['currency']}"
        )

    @llm.function_tool(description="Generate a checkout URL for the current cart.")
    async def checkout(self) -> str:
        """Open Shopify checkout for the current cart."""
        cart = await self._client.get_cart()
        if cart and cart.get("checkoutUrl"):
            await self._publish({"type": "checkout_ready", "url": cart["checkoutUrl"]})
            return (
                f"Your checkout is ready! Total: {cart['totalAmount']} {cart['currency']}. "
                "I'm opening the Shopify checkout page for you."
            )

        # Fallback with cart lines
        if self._client.cart_lines:
            parts = []
            for line in self._client.cart_lines:
                vid = line["variantId"].split("/")[-1] if "/" in line["variantId"] else line["variantId"]
                parts.append(f"{vid}:{line['quantity']}")
            encoded = base64.b64encode(",".join(parts).encode()).decode()
            domain = self._client.store_url.replace("https://", "")
            url = f"https://{domain}/cart/c/{encoded}"
            await self._publish({"type": "checkout_ready", "url": url})
            return "Opening checkout now!"

        return "Your cart is empty. Add some gifts first!"

    @llm.function_tool(description="Get store policies like shipping, returns, or refunds.")
    async def get_store_policies(self, policy_type: str) -> str:
        """Look up store policies."""
        # Try Admin API policies endpoint
        try:
            data = await self._client._admin_get("/policies.json")
            policies = data.get("policies", [])
            for p in policies:
                if policy_type.lower() in (p.get("title", "") or "").lower():
                    body = re.sub(r'<[^>]+>', ' ', p.get("body", "")).strip()
                    if body:
                        return f"{p['title']}: {body[:500]}"
        except Exception:
            pass

        return (
            f"This store hasn't published detailed {policy_type} information yet. "
            "I'd recommend contacting the store directly for specific policy details."
        )
