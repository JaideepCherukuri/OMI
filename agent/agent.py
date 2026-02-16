"""
GiftAI Voice Agent — LiveKit + Gemini 2.5 Flash
"""

import logging
import json
import os
from dotenv import load_dotenv
from livekit import agents
from livekit.agents import Agent, AgentSession, RunContext
from livekit.agents.llm import function_tool
from livekit.plugins import google
from shopify_tools import ShopifyStore

load_dotenv(".env.local")

logger = logging.getLogger("gift-agent")
logger.setLevel(logging.INFO)

STORE_URL = os.getenv("SHOPIFY_STORE_URL", "jaguar-9969.myshopify.com")
ACCESS_TOKEN = os.getenv("SHOPIFY_ACCESS_TOKEN", "")


class GiftAssistant(Agent):
    def __init__(self):
        super().__init__(
            instructions="""You are GiftAI — a warm, friendly voice assistant for a luxury gift store.

RULES:
- ALWAYS call search_products for recommendations — never guess
- Keep voice responses to 2-4 sentences
- Be genuinely enthusiastic about products
- NEVER make up product details or prices
- For "the first one" or "that one" — match to recent search results
- After adding to cart, mention total and ask about checkout""",
        )
        self.store = ShopifyStore(STORE_URL, ACCESS_TOKEN)
        self._room = None

    async def on_enter(self):
        self.session.generate_reply(
            instructions="Greet warmly. Welcome to the gift store. Ask what occasion. Max 2 sentences."
        )

    async def _publish_data(self, data: dict):
        if self._room:
            try:
                payload = json.dumps(data).encode()
                await self._room.local_participant.publish_data(payload, reliable=True)
            except Exception as e:
                logger.error(f"Data publish failed: {e}")

    @function_tool()
    async def search_products(self, context: RunContext, query: str, max_price: float | None = None, occasion: str | None = None) -> str:
        """Search gift products by query, occasion, or budget."""
        results = await self.store.search_products(query, max_price, occasion)
        if results.get("products"):
            await self._publish_data({"type": "products_found", "products": results["products"], "query": query})
        return json.dumps({"message": results.get("message", ""), "count": len(results.get("products", []))})

    @function_tool()
    async def add_to_cart(self, context: RunContext, product_title: str, variant_title: str | None = None) -> str:
        """Add a product to cart by title."""
        result = await self.store.add_to_cart(product_title, variant_title)
        if result.get("cart"):
            await self._publish_data({"type": "cart_updated", "cart": result["cart"]})
        return json.dumps(result)

    @function_tool()
    async def get_product_details(self, context: RunContext, product_title: str) -> str:
        """Get detailed info about a product."""
        result = await self.store.get_product_details(product_title)
        if result.get("product"):
            await self._publish_data({"type": "product_detail", "product": result["product"]})
        return json.dumps(result)

    @function_tool()
    async def view_cart(self, context: RunContext) -> str:
        """View current cart."""
        result = await self.store.view_cart()
        if result.get("cart"):
            await self._publish_data({"type": "cart_updated", "cart": result["cart"]})
        return json.dumps(result)

    @function_tool()
    async def checkout(self, context: RunContext) -> str:
        """Generate checkout URL."""
        result = await self.store.checkout()
        if result.get("checkout_url"):
            await self._publish_data({"type": "checkout_ready", "url": result["checkout_url"]})
        return json.dumps(result)

    @function_tool()
    async def get_store_policies(self, context: RunContext, policy_type: str) -> str:
        """Get store policies (shipping, returns, etc)."""
        return json.dumps({"message": f"This store hasn't published detailed {policy_type} information yet."})


async def entrypoint(ctx: agents.JobContext):
    await ctx.connect()
    logger.info(f"Connected to room: {ctx.room.name}")

    agent = GiftAssistant()
    agent._room = ctx.room

    session = AgentSession(
        llm=google.beta.realtime.RealtimeModel(
            model="gemini-2.5-flash-native-audio-preview",
            voice="Puck",
            temperature=0.7,
        ),
    )

    await session.start(room=ctx.room, agent=agent)

    @ctx.room.on("data_received")
    async def on_data(data: bytes, participant, kind):
        try:
            event = json.loads(data.decode())
            if event.get("type") == "text_message":
                await session.generate_reply(
                    instructions=f"User typed: {event.get('content', '')}. Respond naturally."
                )
            elif event.get("type") == "user_action":
                action = event.get("action")
                if action == "add_to_cart":
                    await session.generate_reply(
                        instructions=f"User clicked Add to Cart for '{event.get('productTitle', '')}'. Call add_to_cart."
                    )
                elif action == "checkout":
                    await session.generate_reply(instructions="User wants checkout. Call checkout function.")
                elif action == "view_cart":
                    await session.generate_reply(instructions="User wants cart. Call view_cart.")
        except Exception as e:
            logger.error(f"Data handler error: {e}")


if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
