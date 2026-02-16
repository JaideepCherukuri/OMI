"""
GiftAI Voice Agent — LiveKit Agents SDK + Gemini 2.5 Flash Realtime

Architecture:
  LiveKit Cloud ←→ This Agent ←→ Gemini Realtime (audio + tool calls)
                                ←→ Shopify APIs (search, cart, checkout)
                ←→ Frontend via Data Channel (product cards, cart state)

Based on LiveKit Agents SDK v1.4.x patterns (matching reference implementation).
"""

import logging
import json
import os

from dotenv import load_dotenv
from livekit import agents
from livekit.agents import (
    Agent, AgentSession, JobContext, WorkerOptions, cli, room_io, llm
)
from livekit.plugins import google

from shopify_tools import ShopifyTools

load_dotenv(".env.local")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gift-agent")

# Store config
STORE_URL = os.getenv("SHOPIFY_STORE_URL", "jaguar-9969.myshopify.com")
ACCESS_TOKEN = os.getenv("SHOPIFY_ACCESS_TOKEN", "")

# Agent personality / system prompt
AGENT_INSTRUCTIONS = """You are GiftAI — a warm, friendly, and knowledgeable voice assistant
for a luxury gift store.

RULES:
1. ALWAYS use search_products when the user asks for recommendations — never guess or make up products.
2. Keep voice responses to 2-4 sentences. Be concise — the user sees product cards visually.
3. Be genuinely enthusiastic about the products. You're helping someone find a meaningful gift.
4. NEVER make up product details, prices, or availability — only use data from tool calls.
5. When a user says "the first one" or "that rose one", match to the most recent search results.
6. After adding to cart, mention the total and ask if they want to keep shopping or checkout.
7. For store policies: honestly say the store hasn't published detailed info if data is unavailable.
8. NEVER mention variantIds, GIDs, or internal identifiers in your speech.
9. When showing multiple products, briefly describe the top 2-3 highlights and let them explore.
10. Ask follow-up questions to narrow down: occasion, recipient, budget, style preferences.

PERSONALITY: Like a knowledgeable friend at a boutique gift shop — warm, helpful, not pushy.
"""


async def entrypoint(ctx: JobContext):
    """Main agent entrypoint — one instance per LiveKit room/session."""
    logger.info(f"=== JOB RECEIVED === Room: {ctx.job.room.name if ctx.job and ctx.job.room else 'Unknown'}")
    await ctx.connect()
    logger.info(f"Agent joined room: {ctx.room.name}")

    # Initialize Shopify tools (one instance per session = one cart per session)
    shopify = ShopifyTools(
        store_url=STORE_URL,
        access_token=ACCESS_TOKEN,
        room=ctx.room,
    )
    tools = llm.find_function_tools(shopify)

    # Configure Gemini Realtime model
    model = google.realtime.RealtimeModel(
        model="gemini-2.5-flash-native-audio-preview",
        voice="Puck",
        temperature=0.7,
    )

    # Create agent session with tools
    session = AgentSession(
        llm=model,
        tools=tools,
    )

    # Room options — keep agent alive across page refreshes
    room_opts = room_io.RoomOptions(
        close_on_disconnect=False,
    )

    # Start the session
    await session.start(
        room=ctx.room,
        agent=Agent(instructions=AGENT_INSTRUCTIONS),
        room_options=room_opts,
    )

    logger.info("Agent session started. Generating greeting...")

    # Generate initial greeting
    await session.generate_reply(
        instructions="Greet the user warmly. Welcome them to the gift store. "
                     "Ask what occasion they're shopping for. Keep it to 2 sentences max."
    )

    logger.info("Greeting complete. Agent is active.")

    # Handle data channel messages from frontend (text input, UI actions)
    @ctx.room.on("data_received")
    def on_data(data: bytes, participant, kind):
        try:
            event = json.loads(data.decode())
            event_type = event.get("type", "")

            if event_type == "text_message":
                # User typed a message while voice is active — route to same conversation
                content = event.get("content", "").strip()
                if content:
                    logger.info(f"Text from frontend: {content}")
                    session.generate_reply(
                        instructions=f"The user typed this message (they're using text input alongside voice): \"{content}\". "
                                     "Respond naturally as if they spoke it. Use your tools if needed."
                    )

            elif event_type == "user_action":
                action = event.get("action", "")
                if action == "add_to_cart":
                    product_title = event.get("productTitle", "")
                    variant = event.get("variantTitle", "")
                    logger.info(f"UI action: add_to_cart '{product_title}' variant '{variant}'")
                    session.generate_reply(
                        instructions=f"The user clicked 'Add to Cart' on the product '{product_title}'"
                                     f"{f' variant {variant}' if variant else ''}. "
                                     "Call the add_to_cart tool to add it, then confirm."
                    )
                elif action == "checkout":
                    logger.info("UI action: checkout")
                    session.generate_reply(
                        instructions="The user clicked checkout. Call the checkout tool and guide them."
                    )
                elif action == "view_cart":
                    logger.info("UI action: view_cart")
                    session.generate_reply(
                        instructions="The user wants to see their cart. Call view_cart and describe the contents."
                    )
                elif action == "view_details":
                    product_title = event.get("productTitle", "")
                    logger.info(f"UI action: view_details '{product_title}'")
                    session.generate_reply(
                        instructions=f"The user clicked on '{product_title}' to see details. "
                                     "Call get_product_details and describe it enthusiastically."
                    )

        except Exception as e:
            logger.error(f"Data channel handler error: {e}")

    logger.info("Session configured with close_on_disconnect=False — agent persists across refreshes")


async def accept_all_jobs(req):
    """Accept jobs for any room (development mode)."""
    await req.accept()


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            request_fnc=accept_all_jobs,
        )
    )
