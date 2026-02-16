# GiftAI — Project Context & Continuation Guide

> **Last updated**: February 16, 2026
> **Author**: Viktor AI (@viktor) — autonomous AI coworker at Nortsta
> **Founder**: Jaideep Cherukuri (@Jai - Nortsta) — Halofy (Agentic Banking OS)

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Repository & Hosting](#repository--hosting)
4. [API Keys & Credentials](#api-keys--credentials)
5. [Local Development Setup](#local-development-setup)
6. [Project History & Progress](#project-history--progress)
7. [Current Focus: Voice-First Commerce](#current-focus-voice-first-commerce)
8. [Codebase Structure](#codebase-structure)
9. [Key Technical Decisions](#key-technical-decisions)
10. [Known Issues & Fixes Applied](#known-issues--fixes-applied)
11. [PRD & Design Reference](#prd--design-reference)

---

## Project Overview

**GiftAI** is an AI-powered luxury gift shopping interface built on top of Shopify. Users interact with a conversational agent (text and voice) to discover gifts, get personalized recommendations, add to cart, and checkout — all within a chat-like interface.

### What It Does
- **Natural language product search** — "Show me wedding gifts under $300"
- **AI recommendations** by occasion, budget, recipient
- **Add to cart** and **checkout** entirely within chat
- **Product cards** with images, prices, variants, stock
- **Horizontal carousel** for 5+ product results
- **Voice-first mode** (in development) — speak to shop, products appear as you talk

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

## Architecture

### Text Mode (Current — Fully Working)
```
Browser → Next.js Frontend
         → /api/chat (POST)
           → Gemini 2.0 Flash (function calling)
             → Shopify MCP (search, cart, policies)
             → Shopify Admin API (product details, fallback)
             → Shopify Storefront API (cart, checkout)
           ← Response + Products + Cart State
         ← Renders chat messages + product cards + cart
```

### Voice Mode (In Development)
```
Browser → LiveKit Room (WebRTC audio)
         → Python Voice Agent (LiveKit Agents SDK)
           → Gemini 2.5 Flash Realtime (native audio)
             → Tool calls → Shopify APIs
           → Data Channel → Frontend (products, cart, checkout)
           → Audio Stream → Frontend (agent voice)
         
Browser → Text Input (always available)
         → /api/chat (existing fallback)
```

### Key Architectural Decision
Voice and text share ONE conversation state. Whether the user speaks or types, it feeds the same agent context. Products from voice tool calls render using the same ProductCard/ProductCarousel components as text mode.

---

## Repository & Hosting

### GitHub Repositories
| Repo | Description | URL |
|------|-------------|-----|
| **shopify-gift-store-agent** | Original Python SDK for Shopify | https://github.com/JaideepCherukuri/shopify-gift-store-agent |
| **realtime-voice-agent** | LiveKit + Gemini voice agent (reference) | https://github.com/Rahulsharma4298/realtime-voice-agent.git |

### Vercel Deployment
| Field | Value |
|-------|-------|
| **Live URL** | https://shopify-gift-chat.vercel.app |
| **Vercel Project** | `shopify-gift-chat` |
| **Project ID** | `prj_JPDfJ4aEZLgUlNNxwXfmxREcpIiL` |
| **Team** | `jaideepc` (Team ID: `team_klyJs5zNSXRVJsIiYInKraWE`) |
| **Framework** | Next.js |
| **Build Command** | `bun run build` |
| **Install Command** | `bun install` |

### Shopify Stores
| Store | URL | MCP Support |
|-------|-----|-------------|
| **Store 1 (Primary)** | jaguar-9969.myshopify.com | ✅ Yes (`/api/mcp`) |
| **Store 2** | llm-5706.myshopify.com | ❌ (Storefront API fallback) |

**Store 1** has 14-16 luxury gift products: Bespoke Star Map, Luxury Silk Robes, Couple's Spa Set, Eternal Rose Box, Artisan Whiskey Collection, Italian Leather Duffel, Adventure Experiences Gift Box, Personalized Journal & Pen Set, Luxury Tea & Honey Collection, Gourmet Chocolate & Wine Pairing, Michael Kors Wallet, Rado Watch, Luxury Perfume Gift Box, and more.

**Primary Location ID** (Store 1): `77123813610`

---

## API Keys & Credentials

### Shopify Store 1 (Jaguar — Primary)
```env
SHOPIFY_STORE_URL=jaguar-9969.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_YOUR_TOKEN_HERE
```

### Shopify Store 2 (LLM — Token needs regeneration)
```env
SHOPIFY_STORE_URL=llm-5706.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_YOUR_STORE2_TOKEN
# ⚠️ This token returns 401 as of Feb 16, 2026. Needs regeneration in Shopify admin.
```

### Google Gemini
```env
GOOGLE_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```
- Text model: `gemini-2.0-flash`
- Voice model: `gemini-2.5-flash-native-audio-preview-12-2025`

### LiveKit Cloud
```env
LIVEKIT_URL=wss://halo-mcp-2tbjr4ch.livekit.cloud
LIVEKIT_API_KEY=YOUR_LIVEKIT_KEY
LIVEKIT_API_SECRET=YOUR_LIVEKIT_SECRET
```

---

## Local Development Setup

### Prerequisites
- Node.js 20+ and Bun (`npm install -g bun`)
- Python 3.11+ (for voice agent)
- Git

### Frontend Setup
```bash
# Clone or enter the project directory
cd shopify-gift-chat

# Install dependencies
bun install

# Create .env.local
cat > .env.local << 'EOF'
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
LIVEKIT_URL=wss://halo-mcp-2tbjr4ch.livekit.cloud
LIVEKIT_API_KEY=YOUR_LIVEKIT_KEY
LIVEKIT_API_SECRET=YOUR_LIVEKIT_SECRET
EOF

# Run dev server
bun run dev
# Open http://localhost:3000
```

### Voice Agent Setup (Python)
```bash
cd shopify-gift-chat/agent

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt

# The .env.local in agent/ has all required keys
# Start the agent
python agent.py start
```

### Building for Production
```bash
bun run build  # Next.js build
```

### Deploying to Vercel
The project deploys via Vercel API (not Git-connected). Deployments are triggered programmatically. The Vercel project has env vars set for `GEMINI_API_KEY`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.

---

## Project History & Progress

### Phase 1: Foundation (Completed ✅)
- Set up Next.js app with Shopify integration
- Implemented Gemini text chat with function calling
- Built product search via MCP + Admin API
- Created ProductCard and ChatInterface components

### Phase 2: Checkout & Cart (Completed ✅)
- **Checkout Logic**: Replaced broken Draft Order invoices with Shopify `/cart/c/` checkout URLs
- Cart management via Storefront GraphQL API
- CartPanel component with line items, quantities, checkout button

### Phase 3: Bug Fixes & Hallucination Prevention (Completed ✅)
- **Hallucination Prevention**: Rewrote system prompts to enforce function calling. Added server-side retry that detects if Gemini claims add-to-cart without generating a `checkoutUrl`.
- **Response Cleaning**: Implemented `cleanResponse` (server) and `cleanInternalData` (client) to strip leaked GIDs, variant IDs, and `[Products shown...]` annotations.
- **Search Improvements**: 
  - Supplement MCP results with Admin API tag-based matching if <3 results
  - Synonym expansion: "explore" → adventure/travel/duffel, "cooking" → gourmet/artisan
  - Fixed empty-tag bug where products with no tags scored highest
- **Policy Handling**: Honest responses about sparse policy data instead of hallucinating

### Phase 4: QA (Completed ✅)
- **API QA**: 13/13 tests passed (Valentine's, Wedding, Birthday, Brother who explores, Under $200, Return policy, Shipping, Checkout flow, Positional references, View cart, Gifts for her, Show everything)
- **Browser QA**: 8/8 scenarios passed — verified visual rendering of product cards, cart panel, checkout buttons
- **Recording**: https://www.browserbase.com/sessions/b7ca219c-2f97-4be5-8b62-fbbf0cb46fb8

### Phase 5: UI Enhancement (Completed ✅)
- **ProductCarousel**: Horizontal auto-scroll with snap-to-card, swipe, arrow buttons, dot indicators. Triggers at 5+ products; ≤4 stays as 2-col grid.
- **Admin Removal**: Removed admin panel. App opens directly to chat with Jaguar store pre-connected.
- **StoreSwapModal**: "Switch Store" button in header opens modal to change store URL + token.
- Latest deploy: `dpl_BkSAxTnsE4twrtV1`

### Phase 6: Voice-First Commerce (IN PROGRESS 🔨)
- Cloned LiveKit voice agent repo, explored architecture
- Ran expert brainstorm panel (PM/Design/Eng)
- Produced full PRD with specs, user flows, wireframes, architecture
- **Currently building**: Python voice agent + Frontend LiveKit integration

---

## Current Focus: Voice-First Commerce

### What's Being Built
The app is being enhanced with real-time voice interaction powered by LiveKit + Gemini 2.5 Flash native audio. The core principle: **"Voice drives. Visuals confirm. Touch completes."**

### New Components (In Development)
| Component | Status | Description |
|-----------|--------|-------------|
| `agent/agent.py` | ✅ Built | Python voice agent with Shopify tool functions |
| `agent/shopify_tools.py` | ✅ Built | Shopify API wrapper for Python agent |
| `Orb.tsx` | ✅ Built | Animated voice presence indicator |
| `Stage.tsx` | ✅ Built | Smart layout for products/cart/checkout |
| `VoiceControls.tsx` | 🔨 In progress | Mic/speaker buttons |
| `TranscriptStream.tsx` | 🔨 In progress | Real-time conversation transcript |
| `useVoiceAgent.ts` | ✅ Built | LiveKit connection + data channel hook |
| `/api/token` | 🔨 In progress | LiveKit token generation route |
| `page.tsx` update | 🔨 In progress | Unified layout orchestration |

### Data Channel Protocol
The Python agent sends structured events to the frontend via LiveKit data channel:

```typescript
// Agent → Frontend
{ type: 'products_found', products: ProductDetail[], query: string }
{ type: 'cart_updated', cart: CartState }
{ type: 'checkout_ready', url: string }
{ type: 'product_detail', product: ProductDetail }

// Frontend → Agent
{ type: 'text_message', content: string }
{ type: 'user_action', action: 'add_to_cart', productTitle: string }
{ type: 'user_action', action: 'checkout' }
```

### PRD Document
Full PRD with brainstorm, specs, user flows, wireframes, and architecture:
- See `docs/GiftAI_Voice_Commerce_PRD.pdf` in this repo
- Covers: Voice Engine, Orb, Stage, Transcript, Controls, Cart, Checkout
- 5-week implementation plan
- Component inventory (new, modified, preserved)

---

## Codebase Structure

```
shopify-gift-chat/
├── agent/                          # Python voice agent
│   ├── agent.py                    # LiveKit agent with Shopify tools
│   ├── shopify_tools.py            # Shopify API wrapper
│   ├── requirements.txt            # Python dependencies
│   └── .env.local                  # Agent env vars
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/route.ts       # Text chat API (Gemini + Shopify)
│   │   │   ├── shopify/
│   │   │   │   ├── checkout/route.ts
│   │   │   │   └── products/route.ts
│   │   │   └── token/route.ts      # LiveKit token generation (NEW)
│   │   ├── page.tsx                # Main app page
│   │   ├── layout.tsx              # Root layout
│   │   └── globals.css             # Global styles + Orb animations
│   ├── components/
│   │   ├── CartPanel.tsx           # Shopping cart panel
│   │   ├── ChatInterface.tsx       # Main chat interface
│   │   ├── ChatMessage.tsx         # Message bubble + product rendering
│   │   ├── Orb.tsx                 # Voice presence indicator (NEW)
│   │   ├── ProductCard.tsx         # Individual product card
│   │   ├── ProductCarousel.tsx     # Horizontal carousel for 5+ products
│   │   ├── Stage.tsx               # Product display area (NEW)
│   │   ├── StoreSwapModal.tsx      # Store switching modal
│   │   ├── TranscriptStream.tsx    # Voice transcript (NEW)
│   │   └── VoiceControls.tsx       # Mic/speaker controls (NEW)
│   ├── hooks/
│   │   └── useVoiceAgent.ts        # LiveKit voice state hook (NEW)
│   ├── lib/
│   │   ├── gemini.ts               # Gemini API + function calling + MCP
│   │   ├── mcp-client.ts           # Shopify MCP client
│   │   ├── shopify-client.ts       # Shopify Admin API client
│   │   ├── storefront-client.ts    # Shopify Storefront API client
│   │   └── tools.ts                # Gemini tool definitions
│   └── types/
│       └── index.ts                # TypeScript types
├── docs/
│   └── GiftAI_Voice_Commerce_PRD.pdf
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── next.config.js
└── PROJECT_CONTEXT.md              # This file
```

---

## Key Technical Decisions

### 1. MCP-First Search
The search function tries Shopify's MCP endpoint first (`/api/mcp`), then supplements with Admin API tag-based matching if fewer than 3 results. This gives the best of both worlds: semantic MCP search + structured tag filtering.

### 2. Synonym Expansion
Query terms are expanded with synonyms to improve search relevance:
- valentine → romance, love, couple, her
- birthday → celebration, party
- wedding → couple, anniversary, bride, groom
- explore → adventure, travel, duffel, outdoor
- cooking → gourmet, artisan, chef, kitchen

### 3. Checkout via Cart URLs
We use Shopify's `/cart/c/{base64_encoded_variants}` URL format instead of Draft Orders. Draft Order invoices were unreliable; cart URLs work consistently.

### 4. Server-Side Response Cleaning
Gemini sometimes leaks internal data (GIDs, variant IDs) in text responses. We strip these server-side with regex before sending to the client. There's also a client-side fallback cleaner.

### 5. Voice Architecture: LiveKit + Data Channel
Voice audio flows through LiveKit WebRTC. Product/cart data flows through LiveKit's reliable data channel as JSON events. This allows the frontend to receive product cards *before* the agent finishes speaking — parallel streams, no blocking.

### 6. Graceful Degradation
Voice is an enhancement. If LiveKit is unavailable or the user keeps voice off, the app falls back to the existing text chat API (`/api/chat`). Zero functionality loss.

---

## Known Issues & Fixes Applied

| Issue | Fix | Deployed |
|-------|-----|----------|
| Draft Order checkout URLs broken | Switched to `/cart/c/` URLs | ✅ V3 |
| Gemini hallucinating add-to-cart without function call | Server-side retry mechanism | ✅ V4 |
| Variant IDs leaked in chat text | `cleanResponse()` server-side + `cleanInternalData()` client-side | ✅ V5 |
| Products with no tags matched everything | Skip scoring for empty tag products | ✅ V6 |
| Search returned too many/few results | Supplement MCP with Admin API if <3 results | ✅ V6 |
| Hallucinated "repair services" for store policies | System prompt: be honest about sparse data | ✅ V6 |
| Store 2 token (llm-5706) returns 401 | Token needs regeneration in Shopify admin | ⚠️ Pending |

---

## PRD & Design Reference

The full Product Requirements Document is at `docs/GiftAI_Voice_Commerce_PRD.pdf`. Key sections:

- **Expert Panel Brainstorm** (10 rounds) — PM (ex-Shopify/Walmart), Design (ex-Amazon), Engineering (ex-Google)
- **Core Principle**: "Voice drives. Visuals confirm. Touch completes."
- **The Orb**: Animated voice presence indicator with states (idle/listening/thinking/speaking)
- **Stage Layout**: Top 60% = product cards, bottom = conversation transcript
- **Data Channel Protocol**: JSON events for products, cart, checkout
- **User Flows**: Voice discovery, text fallback, mixed modality, store switching
- **Wireframes**: Desktop + mobile text mockups
- **System Architecture**: Full diagram with client, LiveKit, Python agent, Shopify
- **5-Week Implementation Plan**: Foundation → Voice Commerce → Polish → Testing → Launch

---

## Quick Reference for Continuing Development

### To deploy a frontend change:
1. Make changes in `shopify-gift-chat/src/`
2. Run `bun run build` to verify
3. Deploy via Vercel API (see deployment scripts in Viktor's workspace)

### To run the voice agent locally:
1. `cd agent && pip install -r requirements.txt`
2. Ensure `.env.local` has all keys
3. `python agent.py start`

### To test:
- Unit tests: `bun run test`
- E2E tests: `bun run test:e2e` (requires Playwright)
- Manual: Open https://shopify-gift-chat.vercel.app

### To add a new Shopify tool to the voice agent:
1. Add method to `ShopifyStore` class in `agent/shopify_tools.py`
2. Add `@llm.function_tool` decorated method to `ShopifyAssistant` in `agent/agent.py`
3. The tool will automatically be available to Gemini's function calling

---

*This context document ensures any agent or developer can pick up exactly where development left off.*
