"""
Shopify API client for the GiftAI voice agent.
"""

import httpx
import json
import re
import base64
import asyncio
from typing import Optional
import logging

logger = logging.getLogger(__name__)

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
    "brother": ["him", "men", "man"],
    "sister": ["her", "women", "woman"],
    "friend": ["friendship"],
}


class ShopifyStore:
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

    async def _get_all_products(self) -> list:
        if self._products_cache is not None:
            return self._products_cache
        data = await self._admin_get("/products.json?limit=250&status=active")
        self._products_cache = data.get("products", [])
        return self._products_cache

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
        has_discount = any(v["compareAtPrice"] and v["compareAtPrice"] > v["price"] for v in variants)
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

    async def _get_formatted(self) -> list:
        if self._formatted_cache is not None:
            return self._formatted_cache
        raw = await self._get_all_products()
        self._formatted_cache = [self._format_product(p) for p in raw]
        return self._formatted_cache

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
            return 0
        title_l = product.get("title", "").lower()
        desc_l = (product.get("descriptionHtml", "") or "").lower()
        tags_l = [t.lower() for t in tags]
        type_l = (product.get("productType", "") or "").lower()
        score = 0
        for term in terms:
            if any(term in tag for tag in tags_l): score += 3
            if term in title_l: score += 2
            if term in desc_l: score += 1
            if term in type_l: score += 2
        if max_price is not None:
            min_v = min((v["price"] for v in product.get("variants", []) if v["price"] > 0), default=999999)
            if min_v > max_price:
                return 0
        return score

    async def search_products(self, query: str, max_price: float = None, occasion: str = None) -> dict:
        try:
            products = await self._get_formatted()
            search_q = f"{query} {occasion}" if occasion else query
            terms = self._expand_query(search_q)
            scored = [(self._score_product(p, terms, max_price), p) for p in products]
            scored = [(s, p) for s, p in scored if s > 0]
            scored.sort(key=lambda x: x[0], reverse=True)
            results = [p for _, p in scored[:6]]
            if len(results) < 3:
                seen = {p["productId"] for p in results}
                for p in products:
                    if p["productId"] not in seen:
                        if any(term in p.get("title", "").lower() for term in terms):
                            results.append(p)
                            if len(results) >= 5:
                                break
            if not results:
                return {"message": f"No products matching '{query}'.", "products": []}
            return {"message": f"Found {len(results)} products", "products": results}
        except Exception as e:
            logger.error(f"Search error: {e}")
            return {"message": f"Error: {e}", "products": []}

    async def get_product_details(self, product_title: str) -> dict:
        try:
            products = await self._get_formatted()
            tl = product_title.lower()
            for p in products:
                if p["title"].lower() == tl:
                    return {"product": p}
            for p in products:
                if tl in p["title"].lower() or p["title"].lower() in tl:
                    return {"product": p}
            words = tl.split()
            best, best_score = None, 0
            for p in products:
                pt = p["title"].lower()
                sc = sum(1 for w in words if w in pt)
                if sc > best_score:
                    best_score, best = sc, p
            if best and best_score >= 1:
                return {"product": best}
            return {"message": f"Product '{product_title}' not found"}
        except Exception as e:
            return {"message": f"Error: {e}"}

    async def add_to_cart(self, product_title: str, variant_title: str = None) -> dict:
        try:
            result = await self.get_product_details(product_title)
            product = result.get("product")
            if not product:
                return {"message": f"Could not find '{product_title}'"}
            variants = product.get("variants", [])
            if not variants:
                return {"message": f"No variants for {product['title']}"}
            variant = variants[0]
            if variant_title:
                vt_l = variant_title.lower()
                for v in variants:
                    if vt_l in v["name"].lower():
                        variant = v
                        break
            vgid = variant.get("gid") or f"gid://shopify/ProductVariant/{variant['variantId']}"
            if self.cart_id:
                cart = await self._add_to_existing_cart(vgid)
            else:
                cart = await self._create_cart(vgid)
            if cart:
                return {
                    "message": f"Added {product['title']} ({variant['name']}) to cart! Total: {cart['totalAmount']} {cart['currency']}",
                    "cart": cart,
                }
            checkout_url = self._gen_checkout_url(variant["variantId"])
            return {
                "message": f"Added {product['title']} to cart!",
                "cart": {
                    "cartId": "direct", "checkoutUrl": checkout_url,
                    "lines": [{"lineId": "1", "variantId": str(variant["variantId"]),
                               "productTitle": product["title"], "variantTitle": variant["name"],
                               "quantity": 1, "price": str(variant["price"]), "currency": "INR"}],
                    "totalAmount": str(variant["price"]), "currency": "INR", "totalQuantity": 1,
                },
            }
        except Exception as e:
            logger.error(f"Add to cart error: {e}")
            return {"message": f"Error: {e}"}

    async def _create_cart(self, variant_gid: str) -> Optional[dict]:
        q = """mutation cartCreate($input: CartInput!) {
          cartCreate(input: $input) {
            cart { id checkoutUrl lines(first: 10) { edges { node { id quantity merchandise { ... on ProductVariant { id title price { amount currencyCode } product { title } } } } } } cost { totalAmount { amount currencyCode } } }
            userErrors { field message }
          }
        }"""
        try:
            data = await self._storefront_graphql(q, {"input": {"lines": [{"merchandiseId": variant_gid, "quantity": 1}]}})
            cart = data.get("data", {}).get("cartCreate", {}).get("cart")
            if not cart:
                return None
            self.cart_id = cart["id"]
            return self._parse_cart(cart)
        except Exception as e:
            logger.error(f"Cart create failed: {e}")
            return None

    async def _add_to_existing_cart(self, variant_gid: str) -> Optional[dict]:
        q = """mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
          cartLinesAdd(cartId: $cartId, lines: $lines) {
            cart { id checkoutUrl lines(first: 10) { edges { node { id quantity merchandise { ... on ProductVariant { id title price { amount currencyCode } product { title } } } } } } cost { totalAmount { amount currencyCode } } }
            userErrors { field message }
          }
        }"""
        try:
            data = await self._storefront_graphql(q, {"cartId": self.cart_id, "lines": [{"merchandiseId": variant_gid, "quantity": 1}]})
            cart = data.get("data", {}).get("cartLinesAdd", {}).get("cart")
            if not cart:
                self.cart_id = None
                return await self._create_cart(variant_gid)
            return self._parse_cart(cart)
        except:
            self.cart_id = None
            return await self._create_cart(variant_gid)

    def _parse_cart(self, cart_data: dict) -> dict:
        lines = []
        total_qty = 0
        for edge in cart_data.get("lines", {}).get("edges", []):
            node = edge["node"]
            merch = node.get("merchandise", {})
            qty = node.get("quantity", 1)
            total_qty += qty
            lines.append({
                "lineId": node["id"], "variantId": merch.get("id", ""),
                "productTitle": merch.get("product", {}).get("title", ""),
                "variantTitle": merch.get("title", ""),
                "quantity": qty, "price": merch.get("price", {}).get("amount", "0"),
                "currency": merch.get("price", {}).get("currencyCode", "INR"),
            })
        cost = cart_data.get("cost", {}).get("totalAmount", {})
        checkout_url = cart_data.get("checkoutUrl", "")
        self.cart_lines = lines
        return {
            "cartId": cart_data.get("id", self.cart_id or ""),
            "checkoutUrl": checkout_url, "lines": lines,
            "totalAmount": cost.get("amount", "0"),
            "currency": cost.get("currencyCode", "INR"),
            "totalQuantity": total_qty,
        }

    def _gen_checkout_url(self, variant_id: int, qty: int = 1) -> str:
        encoded = base64.b64encode(f"{variant_id}:{qty}".encode()).decode()
        domain = self.store_url.replace("https://", "")
        return f"https://{domain}/cart/c/{encoded}"

    async def view_cart(self) -> dict:
        if not self.cart_id:
            return {"message": "Cart is empty.", "cart": None}
        q = """query cart($cartId: ID!) {
          cart(id: $cartId) { id checkoutUrl lines(first: 10) { edges { node { id quantity merchandise { ... on ProductVariant { id title price { amount currencyCode } product { title } } } } } } cost { totalAmount { amount currencyCode } } }
        }"""
        try:
            data = await self._storefront_graphql(q, {"cartId": self.cart_id})
            cart = data.get("data", {}).get("cart")
            if not cart:
                return {"message": "Cart expired.", "cart": None}
            c = self._parse_cart(cart)
            return {"message": f"Cart: {c['totalQuantity']} items, {c['totalAmount']} {c['currency']}", "cart": c}
        except Exception as e:
            return {"message": f"Error: {e}", "cart": None}

    async def checkout(self) -> dict:
        if self.cart_id:
            r = await self.view_cart()
            cart = r.get("cart")
            if cart and cart.get("checkoutUrl"):
                return {"checkout_url": cart["checkoutUrl"], "message": f"Ready! Total: {cart['totalAmount']} {cart['currency']}"}
        if self.cart_lines:
            parts = []
            for l in self.cart_lines:
                vid = l["variantId"].split("/")[-1] if "/" in l["variantId"] else l["variantId"]
                parts.append(f"{vid}:{l['quantity']}")
            encoded = base64.b64encode(",".join(parts).encode()).decode()
            domain = self.store_url.replace("https://", "")
            return {"checkout_url": f"https://{domain}/cart/c/{encoded}", "message": "Opening checkout!"}
        return {"message": "Cart is empty."}
