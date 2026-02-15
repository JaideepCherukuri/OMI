"""Shopify Gift Store Agent SDK — fetch products, recommend gifts, manage inventory."""

from shopify_agent.client import ShopifyClient
from shopify_agent.recommender import GiftRecommender
from shopify_agent.store_manager import StoreManager

__version__ = "1.0.0"
__all__ = ["ShopifyClient", "GiftRecommender", "StoreManager"]
