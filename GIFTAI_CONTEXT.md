# GiftAI Voice Commerce — Full Project Context

> **Purpose**: This document contains EVERYTHING needed to get a new agent (or developer) up to speed on this project and pick up exactly where Viktor left off. Written Feb 16, 2026.

---

## 1. PROJECT VISION

**Goal**: Build a production-grade, voice-first commerce experience called **GiftAI** that outperforms Shopify's "Agentic Commerce" demo (Feb 2026). The key differentiator is **real-time voice shopping** via LiveKit + Gemini 2.5 Flash — something Shopify's own demo doesn't have.

**The pitch**: A user opens GiftAI, speaks "Find me a birthday gift for my mom under $100", and the AI searches across ALL Shopify merchants, shows product cards inline, adds to cart by voice, and checks out — all without typing.

**Owner**: Jaideep Cherukuri (Jai) — @Jai - Nortsta on Slack, GitHub: JaideepCherukuri

---

## 2. REPOSITORIES & BRANCHES

### Primary Repo: `shopify-gift-store-agent`
- **URL**: https://github.com/JaideepCherukuri/shopify-gift-store-agent
- **Active branch**: `voice-commerce-fix` ← ALL work lives here
- **Other branches**: `main` (original CLI-only Shopify agent), `voice-commerce` (first attempt, broken), `webapp` (old)
- **PR #1**: `voice-commerce-fix` → `voice-commerce` (open)

### Reference Repo 1: `realtime-voice-agent` (LiveKit + Gemini voice patterns)
- **URL**: https://github.com/Rahulsharma4298/realtime-voice-agent
- **Tech**: Python (LiveKit Agents SDK 1.4.1 + Gemini 2.5 Flash) backend, Next.js 16 frontend
- **Why it matters**: This is the WORKING reference for how LiveKit voice agents should be built. The `voice-commerce-fix` branch's `agent/agent.py` was modeled after this repo's `agent.py`. Key patterns: `google.realtime.RealtimeModel`, `@llm.function_tool`, `room_io.RoomOptions(close_on_disconnect=False)`, `RoomAudioRenderer`, `useVoiceAssistant`.

### Reference Repo 2: `shopify-gift-store-agent` (main branch)
- **URL**: https://github.com/JaideepCherukuri/shopify-gift-store-agent/tree/main
- **What it is**: The original Python SDK for Shopify — `ShopifyClient`, `GiftRecommender`, `StoreManager`, CLI tools. This is what the store management and product data layer was based on.

### Vercel Deployment
- **Live URL**: https://shopify-gift-chat.vercel.app
- **Vercel Project**: `shopify-gift-chat` (ID: `prj_JPDfJ4aEZLgUlNNxwXfmxREcpIiL`)
- **Team**: `team_klyJs5zNSXRVJsIiYInKraWE`
- **Connected to**: `JaideepCherukuri/shopify-gift-store-agent` repo
- **Production branch**: Deployments go to `preview` (not `production`) because the production branch is still set to `main`. We promote preview deployments to production via the Vercel alias API: `POST /v2/deployments/{uid}/aliases` with `{"alias": "shopify-gift-chat.vercel.app"}`.
- **Auto-deploy**: Every push to `voice-commerce-fix` triggers a Vercel build.
- **11 env vars configured** (see `environmentfiles.md` for values)

---

## 3. ARCHITECTURE

```
┌──────────────────────────────────────────┐
│         FRONTEND (Next.js 14 on Vercel)  │
│                                          │
│  page.tsx → VoiceProvider.tsx             │
│    ├── Text mode: /api/chat → gemini.ts  │
│    └── Voice mode: LiveKit data channel  │
│                                          │
│  /api/chat     → Gemini 2.5 Flash        │
│  /api/token    → LiveKit room token      │
│  /api/catalog  → Global Catalog MCP      │
│                                          │
│  Components:                             │
│    ChatProductCard, ProductDetailPanel,   │
│    InlineCartWidget, CheckoutModal,       │
│    ChatMessage, VoiceControls, Orb       │
└──────────────────────────────────────────┘
           │                    │
           ▼                    ▼
┌──────────────────┐  ┌──────────────────────┐
│  Shopify Store   │  │   LiveKit Cloud       │
│  MCP (per-store) │  │   (voice rooms)       │
│                  │  │                       │
│  jaguar-9969     │  │   Python Agent        │
│  .myshopify.com  │  │   (agent.py)          │
│  /api/mcp        │  │   Gemini 2.5 Flash    │
└──────────────────┘  │   Native Audio        │
           │          └──────────────────────┘
           ▼
┌──────────────────────────────────────────┐
│  Shopify Global Catalog MCP              │
│  catalog.shopify.com/api/mcp             │
│  JWT auth → search ALL merchants         │
└──────────────────────────────────────────┘
```

### Key Architecture Decisions
1. **VoiceProvider owns ALL state** — messages, products, cart. State persists across voice connect/disconnect.
2. **Text mode**: User message → `/api/chat` → `gemini.ts` calls tools (search, cart, etc.) → returns response + products.
3. **Voice mode**: User speaks → LiveKit → Python agent → Gemini native audio → agent publishes data events → frontend updates state.
4. **Search mode toggle**: User explicitly switches between "Our Store" and "All Shopify" via a pill toggle in the header. This controls which search tools the AI has access to — no AI guessing.

---

## 4. WHAT WAS BUILT (Commit History)

All on `voice-commerce-fix` branch:

| Commit | What |
|--------|------|
| `5d7f10a` | Architecture rebuild — VoiceProvider, agent rewrite, Stage+Transcript, unified state |
| `04d45d3` | Chat-first UI redesign — 6 new Shopify-inspired components |
| `07d67be` | Catalog MCP integration — global search wired into Python agent |
| `105a758` | Build fix — `.npmrc` with `legacy-peer-deps=true` for React 19 + Next.js 14 |
| `f687d60` | Agent docs — README, `.env.example`, `pyproject.toml` |
| `d8ad02d` | **Critical fix** — VoiceProvider rewrite, text chat works in both modes (was returning no-ops) |
| `9ccaa36` | Markdown rendering, thinking indicator, concise AI (2-3 sentence) responses |
| `1519419` | Cart persistence, desktop Buy/Add buttons always visible, multi-item checkout |
| `b9337a3` | MCP cart + search — replaced broken StorefrontClient with Shopify's native MCP tools |
| `1aa795e` | Fuzzy product matching for natural language add-to-cart |
| `92be93f` | Global Catalog MCP integration — JWT auth, `/api/catalog` route, `search_global_products` tool |
| `e162920` | Search mode toggle — explicit UI pill switch between Global and Storefront |
| `416a66f` | Hook order bugfix — `useState` before conditional return |

---

## 5. WHAT'S WORKING (Verified E2E in Browser)

### Text Chat (fully functional on production)
- ✅ Search local store products via MCP (`search_shop_catalog`)
- ✅ Search ALL Shopify merchants via Global Catalog MCP (`search_global_products`)
- ✅ Toggle between "Our Store" and "All Shopify" via header pill
- ✅ Product cards with images, prices, ratings, variant names, vendor
- ✅ Local products: "Buy now" + "Add to cart" buttons
- ✅ Global products: "Shopify Catalog" green badge + "Shop Pay" + "Visit shop" buttons
- ✅ Add to cart via MCP (persistent cart across turns, same `cartId`)
- ✅ View cart with all items + total + Shopify checkout URL
- ✅ Checkout URL redirects to real Shopify checkout (verified 302)
- ✅ Product detail panel (slide-in from right)
- ✅ Markdown rendering (bold, italic, bullets)
- ✅ Thinking indicator (pulsing dots)
- ✅ Concise AI responses (2-3 sentences, no repeating card details)
- ✅ Contextual suggestion chips (state-aware)
- ✅ Mobile responsive (390px tested)
- ✅ Store swap modal
- ✅ 78/78 unit tests passing
- ✅ Build compiles clean

### Voice (partially functional — needs Python agent running)
- ✅ Agent registers with LiveKit Cloud successfully
- ✅ Token endpoint generates per-session room tokens (`gift-{uuid}`)
- ✅ VoiceProvider wires LiveKit components (`RoomAudioRenderer`, `StartAudio`, `useVoiceAssistant`)
- ✅ Python agent uses correct SDK surface (`google.realtime.RealtimeModel`, `@llm.function_tool`)
- ❌ **Python agent needs a persistent host** — can't run on Vercel serverless
- ❌ **Not tested E2E in browser** — agent needs to be running somewhere

---

## 6. WHAT'S PENDING (Critical Next Steps)

### 🔴 P0 — Voice Agent Deployment (BIGGEST BLOCKER)
The LiveKit Python agent (`agent/agent.py`) needs a persistent process. Options:
1. **GCP Cloud Run** — Jai has a GCP account. Needs: service account JSON key + project ID. Instructions were given (see Section 11).
2. **Railway** ($5/mo) — easiest option, `railway deploy` from the `agent/` directory.
3. **Fly.io** (free tier) — `fly deploy` with a Dockerfile.
4. **Local** — `cd agent && python agent.py dev` (works for testing, not production).

The agent connects OUTBOUND to LiveKit Cloud (`wss://halo-mcp-2tbjr4ch.livekit.cloud`). No inbound ports needed.

Once the agent is running, the Vercel frontend's `/api/token` route creates room tokens on the same LiveKit instance, and the 🎤 mic button should activate real-time voice shopping.

### 🔴 P0 — Voice ↔ Shopify Tool Integration
The Python agent has Shopify tools (`agent/shopify_tools.py`) but they need to be verified E2E:
- `search_products` — does it call the store MCP correctly?
- `search_global_products` — does the JWT auth work from the Python agent?
- `add_to_cart` / `view_cart` — do data channel events reach the frontend?
- Does the frontend's VoiceProvider correctly handle `products_found`, `cart_updated` events from the agent?

### 🟡 P1 — UI/UX Improvements (from audit)

**From Shopify demo comparison:**
1. **Multi-merchant cart** — Shopify shows separate cart widgets per store (KOTN + Fire Belly Tea). We have single-store cart. Need per-store `InlineCartWidget` when global products are added.
2. **Checkout Kit integration** — Shopify uses `<shopify-checkout>` web component for in-app checkout. We redirect to external URL. Needs Checkout MCP access (currently returns "Forbidden" — needs additional scope on the API key).
3. **Session naming** — Shopify has "Mike's Birthday" named chat sessions. We don't.
4. **Left sidebar nav** — Shopify has Chats/Search/Settings sidebar. We have single-screen.

**Product card carousel improvement:**
- Currently `voice.products` is a single shared array, replaced on each search. The chatItems logic inserts products after the FIRST matching assistant message. This means when you search twice, both product carousels show the latest results at the first position.
- **Fix**: Store products per-message (each assistant message gets its own product array) for true conversation threading.

**Additional UX polish items:**
- Product highlight sync during voice description (M3)
- Audio-amplitude reactive Orb (M5)
- Push-to-talk option (M6)
- Stagger animation for product card entrance (partially done)
- Idle timeout for Gemini connection (M1, bills per-second)

### 🟡 P1 — Prompt Engineering
The system prompt in `src/lib/gemini.ts` (line ~166) has 17 rules. Areas to improve:
- Better handling of "add the first one" / "that one" references
- Smarter budget filtering
- Better occasion detection
- Cross-selling / upselling patterns
- Error recovery when tools fail

### 🔵 P2 — Testing & QA
- Voice E2E testing (can't be done until agent is deployed)
- Edge case testing: empty search results, network failures, expired JWT
- Multi-item cart stress test
- Mobile voice UX testing
- Cross-browser testing (Safari autoplay, Firefox WebRTC)

---

## 7. SHOPIFY DEMO COMPARISON (Gap Analysis)

From the detailed audit comparing GiftAI to Shopify's Agentic Commerce demo:

| Feature | GiftAI | Shopify Demo | Gap |
|---------|--------|-------------|-----|
| Text chat | ✅ Full | ✅ Full | Parity |
| Voice shopping | ✅ LiveKit + Gemini | ❌ Text only | **Our advantage** |
| Product search (local) | ✅ MCP | ✅ MCP | Parity |
| Product search (global) | ✅ Catalog MCP | ✅ Catalog MCP | Parity |
| Product cards | ✅ Inline carousel | ✅ Inline carousel | Parity |
| Product detail panel | ✅ Slide-in | ✅ Slide-in | Parity |
| Add to cart | ✅ MCP cart | ✅ MCP cart | Parity |
| Multi-merchant cart | ❌ Single store | ✅ Per-store widgets | **Gap** |
| In-app checkout | ❌ External redirect | ✅ Checkout Kit | **Gap** |
| Search mode toggle | ✅ Explicit pill toggle | N/A (single mode) | **Our advantage** |
| Suggestion chips | ✅ Context-aware | ❌ None shown | **Our advantage** |
| Mobile responsive | ✅ Tested 390px | Unknown | Likely parity |
| Session naming | ❌ None | ✅ Named sessions | **Gap** |
| Sidebar navigation | ❌ Single screen | ✅ Chats/Search | **Gap** |

**Key insight**: Voice is the 10× differentiator. Shopify's demo is text-only. If we nail the voice experience, we win.

---

## 8. CODEBASE STRUCTURE (`voice-commerce-fix` branch)

```
shopify-gift-store-agent/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Main UI — chat flow + toggle + voice controls
│   │   ├── layout.tsx                  # Root layout
│   │   └── api/
│   │       ├── chat/route.ts           # Text chat API → gemini.ts
│   │       ├── catalog/route.ts        # Global Catalog MCP proxy (keeps secret server-side)
│   │       ├── token/route.ts          # LiveKit room token generator
│   │       └── shopify/
│   │           ├── products/route.ts   # Shopify product API
│   │           └── checkout/route.ts   # Checkout URL builder
│   ├── components/
│   │   ├── VoiceProvider.tsx           # ★ CORE — unified state, voice + text routing
│   │   ├── chat/
│   │   │   ├── ChatMessage.tsx         # AI (● dot) and user (purple bubble) messages
│   │   │   ├── ChatProductCard.tsx     # Product card with Buy/Add + global badges
│   │   │   ├── ProductDetailPanel.tsx  # Right-side slide-in detail view
│   │   │   ├── InlineCartWidget.tsx    # Expandable cart in chat flow
│   │   │   ├── CheckoutModal.tsx       # Checkout overlay
│   │   │   └── index.ts               # Barrel exports
│   │   ├── Orb.tsx                     # Voice state orb animation
│   │   ├── VoiceControls.tsx           # Mic/speaker toggle
│   │   ├── StoreSwapModal.tsx          # Connect different store
│   │   ├── Stage.tsx                   # (Legacy — not used in chat-first layout)
│   │   ├── TranscriptStream.tsx        # (Legacy — not used)
│   │   ├── ChatInterface.tsx           # (Legacy — not used)
│   │   ├── ProductCarousel.tsx         # (Legacy)
│   │   ├── ProductCard.tsx             # (Legacy)
│   │   └── CartPanel.tsx               # (Legacy)
│   ├── hooks/
│   │   └── useVoiceAgent.ts            # (Legacy — replaced by VoiceProvider)
│   ├── lib/
│   │   ├── gemini.ts                   # ★ CORE — Gemini chat + tool execution + search logic
│   │   ├── tools.ts                    # Tool declarations (search, cart, global search, etc.)
│   │   ├── catalog-mcp.ts             # Global Catalog MCP client (JWT auth, JSON-RPC 2.0)
│   │   ├── mcp-client.ts             # Storefront MCP client (per-store, no auth)
│   │   ├── shopify-client.ts          # Admin API client (products, variants)
│   │   └── storefront-client.ts       # (Legacy — replaced by mcp-client)
│   └── types/
│       └── index.ts                    # All TypeScript interfaces
├── agent/
│   ├── agent.py                        # ★ Python LiveKit agent (Gemini 2.5 Flash native audio)
│   ├── shopify_tools.py                # Shopify tool functions for voice agent
│   ├── catalog_mcp.py                  # Global Catalog MCP client (Python)
│   ├── requirements.txt                # Python deps
│   ├── pyproject.toml                  # Python project config
│   └── README.md                       # Agent setup instructions
├── package.json                        # Next.js 14, React 19, LiveKit components
├── .npmrc                              # legacy-peer-deps=true (React 19 + Next 14 compat)
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
└── .env.local                          # (gitignored — see environmentfiles.md)
```

### Key Dependencies
**Frontend (package.json)**:
- Next.js `^14`
- React `^19.2.4`
- `@livekit/components-react` `^2.9.19`
- `@livekit/components-styles`
- `livekit-client` `^2.17.0`
- `livekit-server-sdk` `^2.15.0`
- `lucide-react` (icons)
- Tailwind CSS

**Python Agent (requirements.txt)**:
- `livekit-agents>=1.4.0`
- `livekit-plugins-google>=1.4.0`
- `python-dotenv`
- `httpx`

---

## 9. KEY TECHNICAL DECISIONS & GOTCHAS

### Build Issues
- **React 19 + Next.js 14 conflict**: Solved with `.npmrc` containing `legacy-peer-deps=true`. Without this, `npm install` fails.
- **Vercel deploys to `preview`**: The production branch in Vercel settings is `main` (can't be easily changed via API). To promote a deployment to production, use the alias API: `POST /v2/deployments/{uid}/aliases` with `{"alias": "shopify-gift-chat.vercel.app"}`.

### VoiceProvider Pattern
The most critical file. Previous versions had a bug where text-only mode returned no-op functions (`sendTextMessage: async () => {}`), making the entire app non-functional. The fix: **all state and functions live at the provider level**, outside `LiveKitRoom`. The `LiveKitRoom` wrapper only activates when voice is connected — text always works.

### MCP vs Admin API
- **Storefront MCP** (`{store}.myshopify.com/api/mcp`): No auth needed. Used for search and cart. This is the primary integration.
- **Admin API** (`/admin/api/2024-01/...`): Needs `shpat_` token. Used as fallback for product listing when MCP returns sparse results.
- **Global Catalog MCP** (`catalog.shopify.com/api/mcp`): Needs JWT from `api.shopify.com/auth/access_token`. Searches ALL merchants.

### JWT Token Flow (Global Catalog)
1. POST to `https://api.shopify.com/auth/access_token` with `client_id`, `client_secret`, `grant_type=client_credentials`, `scope=read_global_api_catalog_search`
2. Get back an `access_token` (expires in ~1 hour)
3. Use in `Authorization: Bearer {token}` header for `catalog.shopify.com/api/mcp` requests
4. Auto-refresh implemented in `catalog-mcp.ts`

### Search Mode Toggle
- `page.tsx` has `searchMode` state: `'storefront' | 'global'`
- Passed to VoiceProvider → `/api/chat` → `gemini.ts`
- `gemini.ts` filters tool list: storefront mode removes `search_global_products`, global mode removes `search_products`
- The AI only has access to one search tool at a time — deterministic, no guessing

---

## 10. SHOPIFY RESOURCES & DOCS

- **Shopify Agents docs**: https://shopify.dev/docs/agents
- **Catalog MCP**: https://shopify.dev/docs/agents/catalog/mcp
- **Checkout MCP**: https://shopify.dev/docs/agents/checkout/mcp
- **Storefront MCP**: https://shopify.dev/docs/agents/storefront/mcp
- **Shopify Agentic Commerce demo video**: https://youtu.be/ZPo8n66_6-w
- **Shopify reference app** (`shop-chat-agent`): 97 ⭐ on GitHub — text-only, no voice

---

## 11. GCP DEPLOYMENT INSTRUCTIONS (for LiveKit Voice Agent)

The Python voice agent needs a persistent container. Here's the GCP setup:

### Step 1: GCP Project
Go to https://console.cloud.google.com and pick/create a project. Note the **Project ID**.

### Step 2: Enable APIs
- Cloud Run Admin API
- Artifact Registry API
- Cloud Build API

### Step 3: Service Account
1. IAM & Admin → Service Accounts → Create
2. Name: `viktor-deploy` (or any name)
3. Roles: `Cloud Run Admin`, `Artifact Registry Admin`, `Cloud Build Editor`, `Service Account User`

### Step 4: JSON Key
1. Click the service account → Keys tab → Add Key → Create New Key → JSON
2. Download the JSON file

### Step 5: Deploy
With the JSON key + project ID, the agent can:
1. Build Docker image (Dockerfile exists at `agent/` level, or use `realtime-voice-agent/Dockerfile.agent` as reference)
2. Push to Artifact Registry
3. Deploy to Cloud Run as always-on container
4. Agent connects OUTBOUND to LiveKit Cloud — no inbound ports needed

### Alternative: Railway ($5/mo)
```bash
cd agent/
railway init
railway deploy
```

### Alternative: Run Locally
```bash
cd agent/
pip install -r requirements.txt
# Create .env with LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, GOOGLE_API_KEY
python agent.py dev
```

---

## 12. WHAT JAI ASKED FOR (Complete Request History)

1. **Clone both repos**, understand codebases deeply ✅
2. **Run both repos** with provided env keys ✅
3. **Understand the PRD** (30-page PDF) — voice-first agentic commerce ✅
4. **Audit the `voice-commerce` branch** — found 4 critical, 6 high, 6 medium issues ✅
5. **Fix all critical issues** — VoiceProvider rewrite, agent model update, layout, unified state ✅
6. **Deploy to Vercel** — live at shopify-gift-chat.vercel.app ✅
7. **Study Shopify Agentic Commerce demo** — 6 screenshots + video + docs analyzed ✅
8. **Implement Global Catalog MCP** — JWT auth, search_global_products, product cards with badges ✅
9. **E2E browser testing with screenshots** — multiple rounds of testing done ✅
10. **Make it better than Shopify demo** — ongoing, voice is the differentiator
11. **Add search mode toggle** (not AI guessing) — explicit pill toggle ✅
12. **Deploy LiveKit voice agent to GCP** — BLOCKED on service account key
13. **Create this context document** — you're reading it ✅

---

## 13. CONVERSATION FLOW SUMMARY

The Slack thread at `#random` (thread_ts: `1771227774.760069`) covers the entire project. Key moments:

1. Jai shared two repos and env keys
2. Viktor cloned, analyzed, ran both repos
3. Jai shared PRD PDF + context dump from previous sessions
4. Viktor did expert panel audit (Priya PM, Marcus Design, Elena Eng) — found 16 issues
5. Viktor rebuilt architecture (VoiceProvider, agent rewrite, chat-first UI)
6. Jai pushed to test Shopify demo comparison, demanded E2E testing
7. Viktor discovered VoiceProvider was returning no-ops — fixed
8. Multiple rounds of E2E testing with screenshots
9. Jai asked for Global Catalog MCP integration (client_id/secret provided)
10. Viktor implemented catalog search, JWT auth, product cards with badges
11. Jai asked for explicit toggle instead of AI guessing — implemented
12. Jai asked for this context document

---

## 14. TEAM PERSONAS (from PRD)

The PRD defines three team personas for debate-driven development:
- **Priya Shankar** — PM, prioritizes user experience and feature completeness
- **Marcus Chen** — Design Head, focuses on visual polish, Shopify-level UI quality
- **Dr. Elena Volkov** — Systems Engineer, focuses on architecture, performance, reliability

These are fictional personas used for structured review. When doing an audit, simulate debate between them.

---

## 15. FILE-BY-FILE KEY LOGIC

### `src/lib/gemini.ts` (★ Most important file)
- Contains `SYSTEM_PROMPT` (17 rules)
- `chat()` function — main text chat orchestration
- Tool execution: `search_products`, `search_global_products`, `add_to_cart`, `get_product_details`, `view_cart`, `checkout`, `get_store_policies`
- `findProductFuzzy()` — fuzzy matching for natural language ("add the tea collection")
- `expandQuery()` + `scoreProduct()` — term expansion and relevance scoring
- Accepts `searchMode` param — filters available tools (storefront removes global, global removes local)

### `src/components/VoiceProvider.tsx` (★ Second most important)
- Owns ALL state: messages, products, cart, cartId, mcpSessionId
- `sendViaTextApi()` — POST to `/api/chat` with message + credentials + history + cartId + searchMode
- `sendTextMessage()` — routes to data channel (voice active) or text API (voice off)
- LiveKit integration: `LiveKitRoom`, `RoomAudioRenderer`, `StartAudio`, data channel events
- Passes `searchMode` to chat API

### `src/app/page.tsx`
- `Home()` — root component with store credentials + search mode state
- `GiftAIApp()` — main UI with header (toggle + cart badge), chat flow, suggestion chips, input + voice orb
- `chatItems` memoized array — interleaves messages with product carousels and cart widgets
- `ProductCarouselInline` — horizontal scroll with left/right arrows

### `src/lib/catalog-mcp.ts`
- `CatalogMCPClient` class — JWT token management, auto-refresh, JSON-RPC 2.0 calls
- `getJwtToken()` — POST to api.shopify.com/auth/access_token
- `searchProducts()` → calls `search_products` on catalog.shopify.com/api/mcp
- `getProductDetails()` → calls `get_product_details` by UPID

### `src/app/api/catalog/route.ts`
- Server-side proxy for Global Catalog MCP
- Keeps `SHOPIFY_CATALOG_CLIENT_SECRET` off the browser
- POST with `{query, context}` → JWT token → MCP search → returns products

### `agent/agent.py`
- Python LiveKit agent entry point
- `google.realtime.RealtimeModel` with `gemini-2.5-flash-native-audio-preview-12-2025`
- Puck voice, function calling enabled
- `room_io.RoomOptions(close_on_disconnect=False)` for page refresh persistence
- Data channel handler for `text_message` and `user_action` events from frontend
- `request_fnc=accept_all_jobs` for job acceptance

### `agent/shopify_tools.py`
- 6 `@llm.function_tool` decorated functions
- `search_products`, `search_global_products`, `get_product_details`
- `add_to_cart`, `view_cart`, `checkout`
- Each tool publishes structured data events to frontend via `room.local_participant.publish_data()`

---

## 16. KNOWN BUGS & EDGE CASES

1. **Product carousel position**: Products always appear after the first matching assistant message. Multiple searches don't create multiple carousels. Fix: store products per-message.
2. **Cart doesn't persist across page loads**: New session = empty cart. The `cartId` is in React state only.
3. **"Add the first one" sometimes fails**: Fuzzy matching depends on `foundProducts` array being populated from the last search. If the products were from global search, local add-to-cart won't find them.
4. **Vercel production branch**: Set to `main` in settings. Can't easily change via API. Must manually promote preview deployments.
5. **React 19 + Next.js 14**: Requires `legacy-peer-deps=true` in `.npmrc`.
6. **Checkout MCP forbidden**: The API key scope is `read_global_api_catalog_search` only. Needs additional scope for `create_checkout` / `create_cart`.

---

## 17. IMMEDIATE ACTION ITEMS FOR NEXT AGENT

1. **Get the LiveKit voice agent running** — this is THE differentiator. Deploy to GCP/Railway/Fly.io, or have Jai run `python agent.py dev` locally.
2. **Test voice E2E in browser** — mic button → speak → products appear → add to cart by voice → checkout.
3. **Fix product carousel per-message** — so multiple searches show their own carousels.
4. **Multi-merchant cart** — when adding global products, show per-store cart widgets.
5. **Continue prompt engineering** — the system prompt could be better at handling ambiguous references, cross-selling, and error recovery.
6. **Mobile voice UX** — test on actual mobile devices, ensure mic/speaker work on iOS Safari.

---

*This document was created by Viktor on Feb 16, 2026 based on the complete Slack thread and all work done during the session.*

---

## 18. GCP CLOUD RUN DEPLOYMENT (Completed Feb 16, 2026)

The Python LiveKit voice agent is now deployed and running on GCP Cloud Run.

| Field | Value |
|-------|-------|
| Service URL | `https://giftai-voice-agent-1034579588738.us-central1.run.app` |
| Revision | `giftai-voice-agent-00004-npb` |
| Project ID | `gen-lang-client-0105190198` |
| Region | `us-central1` |
| Memory | 1Gi |
| CPU | 1 (always-on, no throttling) |
| Min instances | 1 (agent always running) |
| Max instances | 1 |
| Service Account | `viktor-deploy@gen-lang-client-0105190198.iam.gserviceaccount.com` |

### Deployment Issues & Fixes
1. **Service account permissions**: Needed Artifact Registry Admin, Cloud Build Editor, Cloud Run Admin, Service Account User roles.
2. **Port binding**: LiveKit agent's HTTP health server defaults to port 8081 in production, but Cloud Run health-checks port 8080. Fixed by reading `PORT` env var in `agent.py`.
3. **Cloud Resource Manager API**: Not enabled, but not needed — deploy works without it (just shows warnings).

### How to Redeploy
```bash
cd agent/
export PATH="/opt/google-cloud-sdk/bin:$PATH"
gcloud auth activate-service-account --key-file=<path-to-key.json>
gcloud config set project gen-lang-client-0105190198
gcloud run deploy giftai-voice-agent \
  --project=gen-lang-client-0105190198 \
  --region=us-central1 \
  --source=. \
  --no-allow-unauthenticated \
  --set-env-vars="LIVEKIT_URL=wss://halo-mcp-2tbjr4ch.livekit.cloud,LIVEKIT_API_KEY=API34HHb6JLeH6E,..." \
  --memory=1Gi --cpu=1 --min-instances=1 --max-instances=1 \
  --timeout=3600 --no-cpu-throttling --execution-environment=gen2 --quiet
```

### Env Vars on Cloud Run
All 8 env vars are set: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, GOOGLE_API_KEY, SHOPIFY_STORE_URL, SHOPIFY_ACCESS_TOKEN, SHOPIFY_CATALOG_CLIENT_ID, SHOPIFY_CATALOG_CLIENT_SECRET.
