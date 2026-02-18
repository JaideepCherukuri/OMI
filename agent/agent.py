"""
OMI Voice Agent — LiveKit Agents SDK + Gemini 2.5 Flash Native Audio

Simple, clean architecture:
  - Gemini handles ALL audio natively (understanding + response + transcription)
  - output_audio_transcription → LiveKit publishes agent speech to room
  - input_audio_transcription → agent forwards user text via data channel
  - No parallel STT, no extra complexity

Based on LiveKit Agents SDK v1.4.x.
"""

import logging
import json
import os
import asyncio

from dotenv import load_dotenv
from livekit import agents, rtc
from livekit.agents import (
    Agent, AgentSession, JobContext, WorkerOptions, cli, room_io, llm
)
from livekit.plugins import google
from google.genai import types as genai_types

from shopify_tools import ShopifyTools
from catalog_mcp import CatalogMCPClient, StorefrontMCPClient

load_dotenv(".env.local")
load_dotenv(".env")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gift-agent")

# Store config
STORE_URL = os.getenv("SHOPIFY_STORE_URL", "jaguar-9969.myshopify.com")
ACCESS_TOKEN = os.getenv("SHOPIFY_ACCESS_TOKEN", "")

# Catalog MCP config
CATALOG_CLIENT_ID = os.getenv("SHOPIFY_CATALOG_CLIENT_ID", "")
CATALOG_CLIENT_SECRET = os.getenv("SHOPIFY_CATALOG_CLIENT_SECRET", "")

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

RESPONSE FORMAT:
Keep voice responses extremely short and crisp — 2-3 sentences max. The user already sees product cards visually, so don't repeat what they can see. Just give a quick intro and ask what catches their eye.

Good example: "Here are some great graduation gift options! Take a look and let me know which one you like, or I can search for something different."

Bad example (too long): "I found a leather bracelet set from Fetchthelove for $44.95, and a personalized acrylic plaque from PersonalisedBee..." — DON'T list products verbally when they're shown as cards.

RULES:
1. ALWAYS use a search tool when the user asks for recommendations — never guess or make up products.
2. Keep voice responses to 2-3 sentences MAX. Cards show the details — you just guide the conversation.
3. Be genuinely enthusiastic about the products. You're helping someone find a meaningful gift.
4. NEVER make up product details, prices, or availability — only use data from tool calls.
5. When a user says "the first one" or "that rose one", match to the most recent search results.
6. After adding to cart, mention the total and ask if they want to keep shopping or checkout.
7. For global products, mention the store name so the user knows where it's from.
8. NEVER mention variantIds, GIDs, UPIDs, or internal identifiers in your speech.
9. Ask follow-up questions to narrow down: occasion, recipient, budget, style preferences.
10. When you recommend products, always mention specific names and prices from the search results.

PERSONALITY: Like a knowledgeable personal shopper at a high-end store — warm, helpful, not pushy.

PRONUNCIATION: Your name is "Omi" (sounds like "Oh-mee"). NEVER say "O. M. I." or spell it out.
"""


async def _publish_data(room: rtc.Room, data: dict) -> None:
    """Publish JSON data to the LiveKit data channel."""
    try:
        payload = json.dumps(data).encode()
        await room.local_participant.publish_data(payload, reliable=True)
    except Exception as e:
        logger.error(f"Data channel publish failed: {e}")


async def entrypoint(ctx: JobContext):
    """One instance per LiveKit room/session."""
    logger.info(f"=== JOB === Room: {ctx.job.room.name if ctx.job and ctx.job.room else '?'}")
    await ctx.connect()
    logger.info(f"Joined room: {ctx.room.name}")

    # ── Initialize tools ──
    catalog_client = None
    if CATALOG_CLIENT_ID and CATALOG_CLIENT_SECRET:
        catalog_client = CatalogMCPClient(CATALOG_CLIENT_ID, CATALOG_CLIENT_SECRET)
        logger.info("Catalog MCP enabled")

    storefront_mcp = StorefrontMCPClient(STORE_URL)

    shopify = ShopifyTools(
        store_url=STORE_URL,
        access_token=ACCESS_TOKEN,
        room=ctx.room,
        catalog_client=catalog_client,
        storefront_mcp_client=storefront_mcp,
    )
    tools = llm.find_function_tools(shopify)

    # ── Gemini Realtime — handles everything natively ──
    model = google.realtime.RealtimeModel(
        model="gemini-2.5-flash-native-audio-preview-12-2025",
        voice="Puck",
        temperature=0.7,
        modalities=["AUDIO"],
        input_audio_transcription=genai_types.AudioTranscriptionConfig(),
        output_audio_transcription=genai_types.AudioTranscriptionConfig(),
    )

    # ── Create session (no parallel STT — Gemini handles transcription) ──
    session = AgentSession(
        llm=model,
        tools=tools,
    )

    # ── Room options ──
    room_opts = room_io.RoomOptions(
        close_on_disconnect=False,
    )

    # ── Start session ──
    await session.start(
        room=ctx.room,
        agent=Agent(instructions=AGENT_INSTRUCTIONS),
        room_options=room_opts,
    )
    logger.info("Session started")

    # ── Wait for user to join, then read their metadata for context ──
    # The agent connects first; the user joins shortly after with their JWT
    # which may contain conversation context in the metadata field.
    conversation_context = ""

    # Check if user is already in the room
    for participant in ctx.room.remote_participants.values():
        if participant.metadata:
            try:
                meta = json.loads(participant.metadata)
                conversation_context = meta.get("conversationContext", "")
                if conversation_context:
                    logger.info(f"Context from existing participant: {conversation_context[:80]}...")
            except (json.JSONDecodeError, AttributeError):
                pass

    # If no context yet, wait briefly for user to join with metadata
    if not conversation_context:
        context_event = asyncio.Event()

        def _on_participant_connected(participant: rtc.RemoteParticipant):
            nonlocal conversation_context
            if participant.metadata:
                try:
                    meta = json.loads(participant.metadata)
                    ctx_text = meta.get("conversationContext", "")
                    if ctx_text:
                        conversation_context = ctx_text
                        logger.info(f"Context from joining participant: {ctx_text[:80]}...")
                        context_event.set()
                except (json.JSONDecodeError, AttributeError):
                    pass

        ctx.room.on("participant_connected", _on_participant_connected)
        try:
            await asyncio.wait_for(context_event.wait(), timeout=3.0)
        except asyncio.TimeoutError:
            logger.info("No conversation context received (timeout)")
        ctx.room.off("participant_connected", _on_participant_connected)

    # ── Greet with or without context ──
    if conversation_context:
        logger.info(f"Context-aware greeting")
        await session.generate_reply(
            instructions=(
                f"The user was chatting via text before switching to voice. "
                f"Their conversation:\n{conversation_context}\n\n"
                f"Continue naturally — acknowledge what they were looking at "
                f"and offer to help further. 1-2 sentences. Don't re-introduce yourself."
            )
        )
    else:
        await session.generate_reply(
            instructions="Greet the user warmly. You're Omi (say Oh-mee). "
                         "Ask what occasion they're shopping for. 2 sentences max."
        )
    logger.info("Greeting sent")

    # ── Forward user transcriptions to frontend via data channel ──
    # Gemini's input_audio_transcription provides these after processing.
    # LiveKit event emitter requires SYNC handlers — use create_task for async work.
    @session.on("user_input_transcribed")
    def on_user_transcribed(ev):
        text = ev.transcript.strip() if ev.transcript else ""
        if not text:
            return
        logger.info(f"User said (final={ev.is_final}): {text[:60]}")
        asyncio.create_task(_publish_data(ctx.room, {
            "type": "user_transcription",
            "text": text,
            "isFinal": ev.is_final,
        }))

    # ── Handle data channel messages from frontend ──
    @ctx.room.on("data_received")
    def on_data(data: bytes, participant, kind):
        try:
            event = json.loads(data.decode())
            event_type = event.get("type", "")

            if event_type == "text_message":
                content = event.get("content", "").strip()
                if content and "[Context from text chat" not in content:
                    logger.info(f"Text input: {content}")
                    session.generate_reply(
                        instructions=f'The user typed: "{content}". Respond naturally. Use tools if needed.'
                    )

            elif event_type == "user_action":
                action = event.get("action", "")
                if action == "add_to_cart":
                    title = event.get("productTitle", "")
                    variant = event.get("variantTitle", "")
                    session.generate_reply(
                        instructions=f"Add '{title}'{f' variant {variant}' if variant else ''} to cart."
                    )
                elif action == "checkout":
                    session.generate_reply(instructions="User wants to checkout. Call checkout tool.")
                elif action == "view_cart":
                    session.generate_reply(instructions="User wants to see cart. Call view_cart tool.")
                elif action == "view_details":
                    title = event.get("productTitle", "")
                    session.generate_reply(
                        instructions=f"Describe '{title}' with details from get_product_details."
                    )

        except Exception as e:
            logger.error(f"Data handler error: {e}")

    logger.info("Agent fully active")


async def accept_all_jobs(req):
    await req.accept()


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            request_fnc=accept_all_jobs,
            port=int(os.environ.get("PORT", 8080)),
        )
    )
