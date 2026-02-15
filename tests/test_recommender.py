"""Tests for the gift recommender — runs against a real store."""

import os
import json
import pytest

from shopify_agent.client import ShopifyClient
from shopify_agent.recommender import GiftRecommender, ProductInfo


pytestmark = pytest.mark.skipif(
    not os.environ.get("SHOPIFY_STORE_URL") or not os.environ.get("SHOPIFY_ACCESS_TOKEN"),
    reason="SHOPIFY_STORE_URL and SHOPIFY_ACCESS_TOKEN must be set",
)


@pytest.fixture
def client():
    c = ShopifyClient()
    yield c
    c.close()


@pytest.fixture
def recommender(client):
    return GiftRecommender(client)


class TestFetchProducts:
    def test_fetch_all(self, recommender):
        products = recommender.fetch_all_products(include_metafields=False)
        assert isinstance(products, list)
        if products:
            p = products[0]
            assert isinstance(p, ProductInfo)
            assert p.product_id > 0
            assert p.title
            assert isinstance(p.tags, list)

    def test_products_have_images(self, recommender):
        """Verify fetched products include image URLs."""
        products = recommender.fetch_all_products(include_metafields=False)
        products_with_imgs = [p for p in products if p.images]
        assert len(products_with_imgs) > 0, "No products returned images"
        assert products_with_imgs[0].images[0].startswith("https://")

    def test_products_have_variants(self, recommender):
        products = recommender.fetch_all_products(include_metafields=False)
        products_with_variants = [p for p in products if p.variants]
        assert len(products_with_variants) > 0
        v = products_with_variants[0].variants[0]
        assert v.price > 0
        assert v.sku

    def test_product_to_dict(self, recommender):
        products = recommender.fetch_all_products(include_metafields=False)
        if products:
            d = products[0].to_dict()
            assert "product_id" in d
            assert "images" in d
            assert "variants" in d
            # Should be JSON-serializable
            json.dumps(d)


class TestRecommend:
    def test_basic_recommend(self, recommender):
        recs = recommender.recommend(top_n=5, include_metafields=False)
        assert isinstance(recs, list)
        assert len(recs) <= 5
        if recs:
            assert "title" in recs[0]
            assert "price_range" in recs[0]
            assert "images" in recs[0]
            assert "variants" in recs[0]

    def test_recommend_with_occasion(self, recommender):
        recs = recommender.recommend(
            occasion="Valentine's Day", top_n=3, include_metafields=False
        )
        for r in recs:
            tags_lower = [t.lower() for t in r["tags"]]
            assert any("valentine" in t for t in tags_lower)

    def test_recommend_with_budget(self, recommender):
        recs = recommender.recommend(
            budget_max=200, top_n=10, include_metafields=False
        )
        for r in recs:
            cheapest = min(v["price"] for v in r["variants"])
            assert cheapest <= 200

    def test_recommend_with_region(self, recommender):
        recs = recommender.recommend(
            region="India", top_n=5, include_metafields=True
        )
        for r in recs:
            india_available = any(
                v.get("available_regions") and "India" in v["available_regions"]
                for v in r["variants"]
            )
            assert india_available

    def test_recommend_formatted(self, recommender):
        text = recommender.recommend_formatted(top_n=3)
        assert isinstance(text, str)
        assert "Top" in text or "No products" in text


class TestRecommendWithMeta:
    def test_metafields_populated(self, recommender):
        products = recommender.fetch_all_products(include_metafields=True)
        has_delivery = any(
            v.delivery_time for p in products for v in p.variants
        )
        has_regions = any(
            v.available_regions for p in products for v in p.variants
        )
        # At least some should have metafields if catalog was populated
        if len(products) > 2:
            assert has_delivery, "No variants have delivery_time metafield"
            assert has_regions, "No variants have available_regions metafield"
