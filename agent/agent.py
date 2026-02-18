"""
OMI Voice Agent — LiveKit Agents SDK + Gemini 2.5 Flash Realtime

Architecture:
  LiveKit Cloud ←→ This Agent ←→ Gemini Realtime (audio + tool calls)
                                ←→ Shopify APIs (search, cart, checkout)
                ←→ Frontend via Data Channel (product cards, cart state)

User Transcription:
  Parallel Google Cloud STT runs alongside Gemini for real-time streaming.
  Gemini processes audio natively for understanding; STT provides live text.

Context Continuity:
  Frontend sends conversation history via participant metadata in the token.
  Agent reads metadata before greeting, ensuring seamless text→voice transition.

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

# GCP credentials for Cloud Speech STT
GCP_CREDENTIALS_FILE = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "/app/gcp-key.json")

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
    """Publish data to the LiveKit data channel. MUST be awaited."""
    try:
        payload = json.dumps(data).encode()
        await room.local_participant.publish_data(payload, reliable=True)
    except Exception as e:
        logger.error(f"Data channel publish failed: {e}")


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

    # ── Configure models ──

    # 1. Gemini Realtime (native audio understanding + response)
    #    Only output_audio_transcription is enabled (for agent speech text).
    #    User transcription comes from the parallel STT instead — it's faster
    #    and doesn't duplicate with Gemini's delayed input transcription.
    gemini_model = google.realtime.RealtimeModel(
        model="gemini-2.5-flash-native-audio-preview-12-2025",
        voice="Puck",
        temperature=0.7,
        modalities=["AUDIO"],
        output_audio_transcription=genai_types.AudioTranscriptionConfig(),
    )

    # 2. Google Cloud STT (parallel real-time transcription of user speech)
    #    Runs alongside Gemini — STT provides live text for the UI,
    #    while Gemini handles actual understanding and responses.
    #    On Cloud Run, uses Application Default Credentials (service account).
    #    Locally, uses gcp-key.json if present.
    parallel_stt = None
    try:
        stt_kwargs = {
            "languages": "en-US",
            "detect_language": False,  # Force English only — prevents Arabic/other misdetection
            "interim_results": True,
            "model": "latest_long",
        }
        # Use explicit credentials file if available, otherwise fall back to ADC
        if os.path.exists(GCP_CREDENTIALS_FILE):
            stt_kwargs["credentials_file"] = GCP_CREDENTIALS_FILE
            logger.info(f"Google Cloud STT: using credentials from {GCP_CREDENTIALS_FILE}")
        else:
            logger.info("Google Cloud STT: using Application Default Credentials")
        parallel_stt = google.STT(**stt_kwargs)
        logger.info("Google Cloud STT enabled for real-time user transcription")
    except Exception as e:
        logger.warning(f"Google Cloud STT not available, falling back to Gemini transcription only: {e}")

    # ── Wait for user participant to check for conversation context ──
    conversation_context = ""

    # Check existing participants
    for participant in ctx.room.remote_participants.values():
        meta = participant.metadata
        if meta:
            try:
                meta_data = json.loads(meta)
                conversation_context = meta_data.get("conversationContext", "")
                if conversation_context:
                    logger.info(f"Found conversation context from participant {participant.identity}: {conversation_context[:100]}...")
            except (json.JSONDecodeError, AttributeError):
                pass

    # Also listen for new participants joining with context
    context_received = asyncio.Event()

    def on_participant_connected(participant: rtc.RemoteParticipant):
        nonlocal conversation_context
        meta = participant.metadata
        if meta:
            try:
                meta_data = json.loads(meta)
                ctx_text = meta_data.get("conversationContext", "")
                if ctx_text:
                    conversation_context = ctx_text
                    logger.info(f"Received conversation context from {participant.identity}")
                    context_received.set()
            except (json.JSONDecodeError, AttributeError):
                pass

    def on_participant_metadata_changed(participant: rtc.Participant, old_metadata: str | None, new_metadata: str | None):
        nonlocal conversation_context
        if new_metadata:
            try:
                meta_data = json.loads(new_metadata)
                ctx_text = meta_data.get("conversationContext", "")
                if ctx_text:
                    conversation_context = ctx_text
                    logger.info(f"Received updated context from {participant.identity}")
                    context_received.set()
            except (json.JSONDecodeError, AttributeError):
                pass

    ctx.room.on("participant_connected", on_participant_connected)
    ctx.room.on("participant_metadata_changed", on_participant_metadata_changed)

    # ── Create agent session ──
    session_kwargs = {
        "llm": gemini_model,
        "tools": tools,
    }
    if parallel_stt:
        session_kwargs["stt"] = parallel_stt

    session = AgentSession(**session_kwargs)

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
    logger.info("Agent session started.")

    # ── Forward user transcriptions to frontend ──
    # With parallel STT enabled and Gemini input_audio_transcription disabled,
    # user_input_transcribed events come ONLY from Google Cloud STT.
    # This gives real-time English-only partials without duplicates.

    # NOTE: LiveKit event emitter requires SYNC callbacks.
    # Use asyncio.create_task() for async work inside handlers.

    @session.on("user_input_transcribed")
    def on_user_transcribed(ev):
        transcript = ev.transcript.strip() if ev.transcript else ""
        if not transcript:
            return

        logger.info(f"User transcription (final={ev.is_final}): {transcript[:80]}...")
        asyncio.create_task(_publish_data(ctx.room, {
            "type": "user_transcription",
            "text": transcript,
            "isFinal": ev.is_final,
        }))

    # Agent speech text is handled by LiveKit's TranscriptionReceived on the frontend,
    # sourced from Gemini's output_audio_transcription. No need for a data channel handler
    # — that was causing duplicate assistant messages.

    # ── Wait briefly for context, then send greeting ──
    # If user comes from text mode, context arrives via participant metadata.
    # If fresh session, no context — give standard greeting.
    if not conversation_context:
        # Wait up to 2s for context to arrive (user might still be connecting)
        try:
            await asyncio.wait_for(context_received.wait(), timeout=2.0)
        except asyncio.TimeoutError:
            pass

    # Also check for context from data channel (backward compat)
    data_context_received = asyncio.Event()
    data_context_text = ""

    @ctx.room.on("data_received")
    def on_initial_data(data: bytes, participant, kind):
        nonlocal data_context_text
        try:
            event = json.loads(data.decode())
            if event.get("type") == "text_message" and "[Context from text chat" in event.get("content", ""):
                data_context_text = event.get("content", "")
                data_context_received.set()
        except Exception:
            pass

    if not conversation_context:
        try:
            await asyncio.wait_for(data_context_received.wait(), timeout=2.0)
            if data_context_text:
                conversation_context = data_context_text
        except asyncio.TimeoutError:
            pass

    # Generate context-aware greeting
    if conversation_context:
        logger.info(f"Generating context-aware greeting with: {conversation_context[:100]}...")
        await session.generate_reply(
            instructions=(
                f"The user was previously chatting via text. Here's their conversation so far:\n\n"
                f"{conversation_context}\n\n"
                f"They've now switched to voice mode. Continue the conversation naturally — "
                f"acknowledge what they were discussing and offer to help further. "
                f"Keep it to 1-2 sentences. Don't re-introduce yourself if they already know you."
            )
        )
    else:
        await session.generate_reply(
            instructions="Greet the user warmly. Welcome them to Omi (pronounced Oh-mee). "
                         "Ask what occasion they're shopping for. Keep it to 2 sentences max."
        )

    logger.info("Greeting complete. Agent is active.")

    # ── Handle ongoing data channel messages from frontend ──
    @ctx.room.on("data_received")
    def on_data(data: bytes, participant, kind):
        try:
            event = json.loads(data.decode())
            event_type = event.get("type", "")

            if event_type == "text_message":
                content = event.get("content", "").strip()
                # Skip context messages (already handled above)
                if content and "[Context from text chat" not in content:
                    logger.info(f"Text from frontend: {content}")
                    session.generate_reply(
                        instructions=f'The user typed: "{content}". Respond naturally. Use tools if needed.'
                    )

            elif event_type == "user_action":
                action = event.get("action", "")
                if action == "add_to_cart":
                    product_title = event.get("productTitle", "")
                    variant = event.get("variantTitle", "")
                    session.generate_reply(
                        instructions=f"Add '{product_title}'{f' variant {variant}' if variant else ''} to cart."
                    )
                elif action == "checkout":
                    session.generate_reply(instructions="User wants to checkout. Call checkout tool.")
                elif action == "view_cart":
                    session.generate_reply(instructions="User wants to see cart. Call view_cart tool.")
                elif action == "view_details":
                    product_title = event.get("productTitle", "")
                    session.generate_reply(
                        instructions=f"Describe '{product_title}' with details from get_product_details."
                    )

        except Exception as e:
            logger.error(f"Data channel handler error: {e}")

    logger.info("Session fully configured. Agent persists across refreshes.")


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
