"""
OMI Voice Agent — LiveKit Agents SDK + Gemini 2.5 Flash Realtime

Architecture:
  LiveKit Cloud ←→ This Agent ←→ Gemini Realtime (audio + tool calls)
                                ←→ Shopify APIs (search, cart, checkout)
                ←→ Frontend via Data Channel (product cards, cart state)

Based on LiveKit Agents SDK v1.4.x patterns (matching reference implementation).
"""

import logging
import json
import os
import asyncio
import uuid

from dotenv import load_dotenv
from livekit import agents
from livekit.agents import (
    Agent, AgentSession, JobContext, WorkerOptions, cli, room_io, llm
)
from livekit.plugins import google
from google.genai import types as genai_types

from shopify_tools import ShopifyTools
from catalog_mcp import CatalogMCPClient, StorefrontMCPClient

load_dotenv(".env.local")  # Local dev
load_dotenv(".env")         # Docker / production

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gift-agent")

# Store config
STORE_URL = os.getenv("SHOPIFY_STORE_URL", "jaguar-9969.myshopify.com")
ACCESS_TOKEN = os.getenv("SHOPIFY_ACCESS_TOKEN", "")

# Catalog MCP config (global search across all Shopify merchants)
CATALOG_CLIENT_ID = os.getenv("SHOPIFY_CATALOG_CLIENT_ID", "")
CATALOG_CLIENT_SECRET = os.getenv("SHOPIFY_CATALOG_CLIENT_SECRET", "")

# Agent personality / system prompt
AGENT_INSTRUCTIONS = """You are Omi (pronounced "Oh-mee", one word, NOT spelled out as O-M-I) — a warm, friendly, and knowledgeable voice shopping assistant.

IMPORTANT PRONUNCIATION: Always say your name as "Omi" (rhymes with "homie"), never spell it out letter by letter. Never say "O. M. I."

YOU HAVE TWO SEARCH MODES:
A) search_products — searches OUR connected Shopify store's catalog
B) search_global_products — searches ALL of Shopify (millions of merchants worldwide)

WHEN TO USE EACH:
- If the user asks about "our products" or "your store" → use search_products
- If the user wants to explore broadly ("find me the best X", "what's out there") → use search_global_products
- If the user mentions a budget or specific category without store preference → use search_global_products
- Default to search_global_products for the richest results

RESPONSE FORMAT — THIS IS CRITICAL:
When you show product cards visually, you MUST ALSO provide a spoken text summary that matches. Structure your response like this:
1. Start with a brief intro ("Great choice! Here's what I found...")
2. Highlight 2-3 specific products by name, mentioning price and what makes them special
3. End with a question to guide them ("Want to see more details on any of these, or should I search for something different?")

Example good response after showing cards:
"Nice! I found some great options for graduation gifts. There's a beautiful leather bracelet set from Fetchthelove for $44.95 — really popular. Also a personalized acrylic plaque from PersonalisedBee that would be a lovely keepsake. And if you want something classic, there's a College Graduation gift set from BeWishedGifts. Would you like me to tell you more about any of these, or should I look for something in a different price range?"

RULES:
1. ALWAYS use a search tool when the user asks for recommendations — never guess or make up products.
2. Keep voice responses to 3-5 sentences. Be descriptive but concise.
3. Be genuinely enthusiastic about the products. You're helping someone find a meaningful gift.
4. NEVER make up product details, prices, or availability — only use data from tool calls.
5. When a user says "the first one" or "that rose one", match to the most recent search results.
6. After adding to cart, mention the total and ask if they want to keep shopping or checkout.
7. For global products, mention the store name so the user knows where it's from.
8. NEVER mention variantIds, GIDs, UPIDs, or internal identifiers in your speech.
9. Ask follow-up questions to narrow down: occasion, recipient, budget, style preferences.
10. When you recommend products, always mention specific names and prices from the search results.

PERSONALITY: Like a knowledgeable personal shopper at a high-end store — warm, helpful, not pushy. You have access
to the entire Shopify ecosystem, so you can find ANYTHING. Be confident and specific in your recommendations.

PRONUNCIATION: Your name is "Omi" (sounds like "Oh-mee"). NEVER say "O. M. I." or spell it out. Always say it as one smooth word: "Omi".
"""


async def entrypoint(ctx: JobContext):
    """Main agent entrypoint — one instance per LiveKit room/session."""
    logger.info(f"=== JOB RECEIVED === Room: {ctx.job.room.name if ctx.job and ctx.job.room else 'Unknown'}")
    await ctx.connect()
    logger.info(f"Agent joined room: {ctx.room.name}")

    # Initialize Catalog MCP client (global search across all Shopify)
    catalog_client = None
    if CATALOG_CLIENT_ID and CATALOG_CLIENT_SECRET:
        catalog_client = CatalogMCPClient(CATALOG_CLIENT_ID, CATALOG_CLIENT_SECRET)
        logger.info("Catalog MCP enabled — global product search active")
    else:
        logger.info("Catalog MCP not configured — using store-only search")

    # Initialize Storefront MCP client (single store, no auth)
    storefront_mcp = StorefrontMCPClient(STORE_URL)

    # Initialize Shopify tools (one instance per session = one cart per session)
    shopify = ShopifyTools(
        store_url=STORE_URL,
        access_token=ACCESS_TOKEN,
        room=ctx.room,
        catalog_client=catalog_client,
        storefront_mcp_client=storefront_mcp,
    )
    tools = llm.find_function_tools(shopify)

    # Configure Gemini Realtime model with input + output audio transcription
    # input_audio_transcription: Gemini returns what it heard (user speech → text)
    # output_audio_transcription: Gemini returns what it said (agent speech → text)
    model = google.realtime.RealtimeModel(
        model="gemini-2.5-flash-native-audio-preview-12-2025",
        voice="Puck",
        temperature=0.7,
        modalities=["AUDIO"],
        input_audio_transcription=genai_types.AudioTranscriptionConfig(),
        output_audio_transcription=genai_types.AudioTranscriptionConfig(),
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

    logger.info("Agent session started. Setting up transcription forwarding...")

    # ── User transcription streaming ──
    # Forward user input transcriptions to frontend via data channel.
    # Streams partial text in real-time so the user sees their speech appear.
    _current_utterance_id: str = ""
    _utterance_text: str = ""

    @session.on("user_input_transcribed")
    def on_user_input_transcribed(event):
        nonlocal _current_utterance_id, _utterance_text

        text = getattr(event, 'transcript', '') or getattr(event, 'text', '') or str(event)
        text = text.strip()
        if not text or len(text) <= 1:
            return

        # If this is longer than previous, it's a continuation of same utterance
        # If shorter (new sentence), start a new utterance
        if len(text) < len(_utterance_text) * 0.5 and len(_utterance_text) > 10:
            # New utterance — finalize the old one and start fresh
            if _utterance_text:
                _publish_sync(ctx.room, {
                    "type": "user_transcription",
                    "text": _utterance_text,
                    "utteranceId": _current_utterance_id,
                    "isFinal": True,
                })
            _current_utterance_id = str(uuid.uuid4())[:8]
            _utterance_text = text
        else:
            # Continuation of same utterance
            if not _current_utterance_id:
                _current_utterance_id = str(uuid.uuid4())[:8]
            _utterance_text = text

        # Send partial
        _publish_sync(ctx.room, {
            "type": "user_transcription",
            "text": text,
            "utteranceId": _current_utterance_id,
            "isFinal": False,
        })
        logger.info(f"User transcription [{_current_utterance_id}]: {text[:60]}...")

    # Finalize user utterance when agent starts responding
    @session.on("agent_started_speaking")
    def on_agent_speaking(event=None):
        nonlocal _current_utterance_id, _utterance_text
        if _utterance_text and _current_utterance_id:
            _publish_sync(ctx.room, {
                "type": "user_transcription",
                "text": _utterance_text,
                "utteranceId": _current_utterance_id,
                "isFinal": True,
            })
            logger.info(f"Finalized user transcription: {_utterance_text[:60]}...")
        _current_utterance_id = ""
        _utterance_text = ""

    # ── Agent transcription streaming ──
    # Forward agent's spoken text to frontend in real-time
    _agent_speech_text: str = ""

    @session.on("agent_speech_transcribed")
    def on_agent_speech_transcribed(event):
        nonlocal _agent_speech_text
        text = getattr(event, 'transcript', '') or getattr(event, 'text', '') or ''
        text = text.strip()
        if not text:
            return

        _agent_speech_text = text
        _publish_sync(ctx.room, {
            "type": "agent_transcription",
            "text": text,
            "isFinal": False,
        })
        logger.info(f"Agent speech (partial): {text[:60]}...")

    @session.on("agent_stopped_speaking")
    def on_agent_stopped(event=None):
        nonlocal _agent_speech_text
        if _agent_speech_text:
            _publish_sync(ctx.room, {
                "type": "agent_transcription",
                "text": _agent_speech_text,
                "isFinal": True,
            })
            logger.info(f"Agent speech (final): {_agent_speech_text[:60]}...")
            _agent_speech_text = ""

    # Generate initial greeting
    await session.generate_reply(
        instructions="Greet the user warmly. Welcome them to Omi (pronounced Oh-mee, NOT spelled out). "
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


def _publish_sync(room, data: dict):
    """Synchronously publish data to the LiveKit data channel."""
    try:
        payload = json.dumps(data).encode()
        room.local_participant.publish_data(payload, reliable=True)
    except Exception as e:
        logger.error(f"Data channel publish failed: {e}")


async def accept_all_jobs(req):
    """Accept jobs for any room (development mode)."""
    await req.accept()


if __name__ == "__main__":
    http_port = int(os.environ.get("PORT", 8080))

    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            request_fnc=accept_all_jobs,
            port=http_port,
        )
    )
