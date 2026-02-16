# GiftAI — Project Context & Continuation Guide

> **Last updated**: February 16, 2026  
> **Author**: Viktor AI (@viktor) — autonomous AI coworker at Nortsta  
> **Founder**: Jaideep Cherukuri (@Jai - Nortsta) — Halofy (Agentic Banking OS)

---

## Project Overview

**GiftAI** is an AI-powered luxury gift shopping interface built on Shopify. Users interact with a conversational agent (text + voice) to discover gifts, get recommendations, add to cart, and checkout.

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 19, Tailwind CSS 3, TypeScript |
| LLM (Text) | Google Gemini 2.0 Flash (function calling) |
| LLM (Voice) | Google Gemini 2.5 Flash Native Audio (via LiveKit) |
| Voice Infra | LiveKit Cloud (WebRTC + Data Channels) |
| Voice Agent | Python, LiveKit Agents SDK |
| Commerce | Shopify Admin API + MCP + Storefront API |
| Hosting | Vercel (frontend), LiveKit Cloud (voice agent) |
| Package Manager | Bun |

---

## Repository & Hosting

### GitHub
| Repo | URL |
|------|-----|
| shopify-gift-store-agent (this repo) | https://github.com/JaideepCherukuri/shopify-gift-store-agent |
| realtime-voice-agent (reference) | https://github.com/Rahulsharma4298/realtime-voice-agent.git |

### Vercel
| Field | Value |
|-------|-------|
| Live URL | https://shopify-gift-chat.vercel.app |
| Project | shopify-gift-chat |
| Project ID | prj_JPDfJ4aEZLgUlNNxwXfmxREcpIiL |
| Team | jaideepc (team_klyJs5zNSXRVJsIiYInKraWE) |
| Build | bun run build |

### Shopify Stores
| Store | URL | MCP |
|-------|-----|-----|
| Store 1 (Primary) | jaguar-9969.myshopify.com | Yes (/api/mcp) |
| Store 2 | llm-5706.myshopify.com | No (token expired) |

Primary Location ID (Store 1): 77123813610  
Store 1 has 14-16 luxury gift products.

---

## API Keys & Credentials

> All secrets stored in `.env.local` files (gitignored). Check Vercel env vars or ask @Jai.

### Required .env.local (Frontend)
```env
GEMINI_API_KEY=<from Google AI Studio>
LIVEKIT_URL=wss://halo-mcp-2tbjr4ch.livekit.cloud
LIVEKIT_API_KEY=<from LiveKit dashboard>
LIVEKIT_API_SECRET=<from LiveKit dashboard>
```

### Required .env.local (Agent)
```env
LIVEKIT_URL=wss://halo-mcp-2tbjr4ch.livekit.cloud
LIVEKIT_API_KEY=<from LiveKit dashboard>
LIVEKIT_API_SECRET=<from LiveKit dashboard>
GOOGLE_API_KEY=<from Google AI Studio>
SHOPIFY_STORE_URL=jaguar-9969.myshopify.com
SHOPIFY_ACCESS_TOKEN=<from Shopify admin>
```

---

## Local Development Setup

### Frontend
```bash
cd shopify-gift-chat
bun install
# Create .env.local with keys above
bun run dev  # http://localhost:3000
```

### Voice Agent (Python)
```bash
cd agent
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
# Create .env.local with keys above  
python agent.py start
```

---

## Project History

### Completed ✅
1. **Text Chat** — Gemini 2.0 Flash with function calling, Shopify MCP search/cart/checkout
2. **Product Cards** — Images, prices, variants, stock levels
3. **Checkout** — Shopify /cart/c/ URLs (replaced broken Draft Order invoices)
4. **Hallucination Prevention** — Server-side retry, response cleaning (strip GIDs/variantIds)
5. **Search** — MCP + Admin API tag matching, synonym expansion, empty-tag fix
6. **ProductCarousel** — Horizontal auto-scroll, snap, swipe, dots (5+ products)
7. **UI Streamlining** — Admin panel removed, direct chat landing, StoreSwapModal
8. **QA** — 13/13 API tests, 8/8 browser tests passed (V6: dpl_GvPtENrLDKqUZPdP)

### In Progress 🔨
9. **Voice-First Commerce** — LiveKit + Gemini 2.5 Flash native audio integration

---

## Voice Commerce Architecture (In Development)

### Core Principle
**"Voice drives. Visuals confirm. Touch completes."**

### Architecture
```
Browser → LiveKit Room (WebRTC audio)
  → Python Voice Agent (LiveKit Agents SDK)
    → Gemini 2.5 Flash Realtime (native audio)
      → Tool calls → Shopify APIs
    → Data Channel → Frontend (products, cart events)
    → Audio Stream → Frontend (agent voice)
         
Browser → Text Input (always available as fallback)
  → /api/chat (existing text API)
```

### Data Channel Protocol
```json
// Agent → Frontend
{ "type": "products_found", "products": [...], "query": "..." }
{ "type": "cart_updated", "cart": {...} }
{ "type": "checkout_ready", "url": "..." }

// Frontend → Agent  
{ "type": "text_message", "content": "..." }
{ "type": "user_action", "action": "add_to_cart", "productTitle": "..." }
```

### New Components (Designed, Implementation Started)
| Component | Description |
|-----------|-------------|
| Orb.tsx | Animated voice presence indicator (idle/listening/thinking/speaking) |
| Stage.tsx | Smart layout: products/cart/detail views |
| VoiceControls.tsx | Mic/speaker buttons |
| TranscriptStream.tsx | Real-time conversation transcript |
| useVoiceAgent.ts | LiveKit connection + data channel hook |
| /api/token | LiveKit token generation |
| agent/agent.py | Python voice agent with Shopify tools |
| agent/shopify_tools.py | Shopify API wrapper for Python |

### PRD
Full PRD with expert brainstorm, specs, user flows, wireframes, architecture:
→ See `docs/GiftAI_Voice_Commerce_PRD.pdf`

---

## Key Technical Decisions

1. **MCP-First Search** — Try Shopify MCP, supplement with Admin API tag matching if <3 results
2. **Synonym Expansion** — valentine→romance/love, birthday→celebration, explore→adventure/travel
3. **Cart URLs** — /cart/c/{base64} format instead of Draft Orders
4. **Response Cleaning** — Server-side regex strips leaked GIDs/variantIds
5. **Voice via Data Channel** — Product data flows parallel to audio stream, no blocking
6. **Graceful Degradation** — Voice off = full text chat, zero functionality loss

---

## Known Issues
| Issue | Status |
|-------|--------|
| Store 2 (llm-5706) token expired | ⚠️ Needs regeneration in Shopify admin |
| Git hard reset lost Next.js source files | ⚠️ Source is in Vercel deploy dpl_BkSAxTnsE4twrtV1 and .next cache |
| Voice implementation incomplete | 🔨 PRD done, components designed, partial code written |

---

## Recovering the Next.js Frontend Source

The latest working frontend (text chat + carousel + store swap) is deployed at:
- **Vercel**: https://shopify-gift-chat.vercel.app (deploy: dpl_BkSAxTnsE4twrtV1)
- **Build cache**: .next/ directory in workspace

The source files were in the workspace but got wiped by a git hard reset. The full file structure was:
```
src/app/page.tsx              — Main page (direct chat, Jaguar pre-connected)
src/app/layout.tsx            — Root layout  
src/app/globals.css           — Styles + carousel/orb animations
src/app/api/chat/route.ts     — Text chat API
src/app/api/shopify/*/        — Shopify API routes
src/components/ChatInterface.tsx  — Main chat component
src/components/ChatMessage.tsx    — Message bubbles + product rendering
src/components/ProductCard.tsx    — Product card
src/components/ProductCarousel.tsx — Horizontal carousel
src/components/CartPanel.tsx      — Cart panel  
src/components/StoreSwapModal.tsx — Store switch modal
src/lib/gemini.ts              — Gemini + function calling + MCP
src/lib/mcp-client.ts         — Shopify MCP client
src/lib/shopify-client.ts     — Admin API client
src/lib/storefront-client.ts  — Storefront API client
src/lib/tools.ts              — Tool definitions
src/types/index.ts             — TypeScript types
```

To reconstruct: check the Vercel deployment source or the .next build cache.

---

*This document ensures any agent or developer can continue where Viktor left off.*
