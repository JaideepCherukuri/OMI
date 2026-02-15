"""Tests for the store manager — runs against a real store."""

import os
import pytest

from shopify_agent.client import ShopifyClient
from shopify_agent.store_manager import (
    StoreManager,
    ProductInput,
    VariantInput,
)

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
def manager(client):
    return StoreManager(client)


class TestStoreSummary:
    def test_summary_structure(self, manager):
        summary = manager.get_store_summary()
        assert "total_products" in summary
        assert "total_inventory" in summary
        assert "price_range" in summary
        assert "products" in summary
        assert isinstance(summary["products"], list)

    def test_summary_products_have_images(self, manager):
        summary = manager.get_store_summary()
        products_with_imgs = [
            p for p in summary["products"] if p.get("images")
        ]
        if summary["total_products"] > 0:
            assert len(products_with_imgs) > 0


class TestProductLifecycle:
    """Test create → verify → delete cycle with a test product."""

    def test_create_and_delete(self, manager):
        test_product = ProductInput(
            title="[TEST] Viktor Test Product — Delete Me",
            description_html="<p>Automated test product. Safe to delete.</p>",
            vendor="Test Vendor",
            product_type="Test",
            tags=["test", "delete-me"],
            option_name="Size",
            image_urls=[
                "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80"
            ],
            variants=[
                VariantInput(
                    option_value="Standard",
                    price="9.99",
                    sku="TEST-001",
                    inventory_quantity=5,
                    delivery_time="1-2 business days",
                    available_regions="USA",
                ),
            ],
        )

        # Create
        result = manager.create_product(test_product)
        assert result.success, f"Create failed: {result.message}"
        assert result.product_id is not None

        # Verify it exists
        product = manager.client.get_product(result.product_id)
        assert product["title"] == test_product.title
        assert len(product["variants"]) == 1
        assert len(product["images"]) == 1

        # Verify metafields
        vid = product["variants"][0]["id"]
        mfs = manager.client.get_variant_metafields(vid)
        mf_keys = {mf["key"] for mf in mfs}
        assert "delivery_time" in mf_keys
        assert "available_regions" in mf_keys

        # Delete
        del_results = manager.delete_products([result.product_id])
        assert del_results[0].success
