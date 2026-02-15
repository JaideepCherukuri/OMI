"""Tests for the Shopify client — runs against a real store."""

import os
import pytest

from shopify_agent.client import ShopifyClient


# Skip if env vars not set
pytestmark = pytest.mark.skipif(
    not os.environ.get("SHOPIFY_STORE_URL") or not os.environ.get("SHOPIFY_ACCESS_TOKEN"),
    reason="SHOPIFY_STORE_URL and SHOPIFY_ACCESS_TOKEN must be set",
)


@pytest.fixture
def client():
    c = ShopifyClient()
    yield c
    c.close()


class TestShopInfo:
    def test_get_shop(self, client):
        shop = client.get_shop()
        assert "name" in shop
        assert "myshopify_domain" in shop

    def test_get_locations(self, client):
        locations = client.get_locations()
        assert len(locations) > 0
        assert "id" in locations[0]

    def test_get_primary_location(self, client):
        loc_id = client.get_primary_location_id()
        assert isinstance(loc_id, int)


class TestProducts:
    def test_get_products(self, client):
        products = client.get_products()
        assert isinstance(products, list)

    def test_product_count(self, client):
        count = client.product_count()
        assert isinstance(count, int)
        assert count >= 0

    def test_get_products_with_fields(self, client):
        products = client.get_products(fields="id,title")
        if products:
            assert "id" in products[0]
            assert "title" in products[0]

    def test_product_has_images(self, client):
        """Verify products return image URLs."""
        products = client.get_products()
        products_with_images = [p for p in products if p.get("images")]
        # At least some products should have images
        if products:
            assert len(products_with_images) > 0, "No products have images"
            first_image = products_with_images[0]["images"][0]
            assert "src" in first_image
            assert first_image["src"].startswith("https://")


class TestVariants:
    def test_get_variant(self, client):
        products = client.get_products()
        if products and products[0].get("variants"):
            vid = products[0]["variants"][0]["id"]
            variant = client.get_variant(vid)
            assert "id" in variant
            assert "price" in variant


class TestMetafields:
    def test_get_variant_metafields(self, client):
        products = client.get_products()
        if products and products[0].get("variants"):
            vid = products[0]["variants"][0]["id"]
            mfs = client.get_variant_metafields(vid)
            assert isinstance(mfs, list)
