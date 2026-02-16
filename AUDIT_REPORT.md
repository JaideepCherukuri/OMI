# GiftAI Voice Commerce — Expert Panel Audit Report
## `voice-commerce` Branch vs PRD Compliance Review

**Date**: February 16, 2026
**Audited by**: Priya Shankar (PM), Marcus Chen (Design), Dr. Elena Volkov (Engineering)
**Branch**: `voice-commerce` (commit `3ce060e`)
**PRD**: GiftAI_Voice_Commerce_PRD v1.0

---

## EXECUTIVE SUMMARY

The `voice-commerce` branch has a **solid text-chat foundation** — the Gemini function-calling pipeline, MCP search with Admin API fallback, Storefront GraphQL cart, hallucination prevention, and response cleaning all work correctly. The Next.js build succeeds. However, the **voice integration layer has critical gaps** that prevent it from functioning as a production voice-commerce experience.

**Overall PRD compliance: ~35%**
- Text commerce path: ~90% complete ✅
- Voice integration: ~15% complete 🔴
- Layout/UX alignment with PRD: ~20% complete 🔴
- Python agent: ~30% complete 🟡

---

## CRITICAL FINDINGS (P0 — Blocks Voice Commerce)

### 🔴 C1: Frontend Uses Raw LiveKit SDK Instead of Components Library
**Found by**: Dr. Elena Volkov (Engineering)
**Severity**: CRITICAL — Voice will not work

The `useVoiceAgent.ts` hook manually instantiates `Room` from `livekit-client` and tries to manage audio tracks, data channels, and connection state by hand. But the reference implementation (and LiveKit's recommended pattern) uses `@livekit/components-react`:

```tsx
// CURRENT (broken pattern)
import { Room, RoomEvent } from 'livekit-client'
const room = new Room()
await room.connect(serverUrl, participantToken)

// REQUIRED (reference pattern)
import { LiveKitRoom, useVoiceAssistant, RoomAudioRenderer, StartAudio } from '@livekit/components-react'
<LiveKitRoom token={token} serverUrl={url}>
  <RoomAudioRenderer />  // Actually plays agent audio!
  <StartAudio />          // Handles iOS autoplay restriction
  <VoiceAgent />
</LiveKitRoom>
```

**What's missing**:
- `RoomAudioRenderer` — without this, the user will NEVER hear the agent's voice
- `StartAudio` — without this, iOS Safari will block audio playback entirely
- `useVoiceAssistant` — provides agent state (`listening`, `speaking`, `thinking`) that the reference agent already uses
- `BarVisualizer` / audio track handling for the Orb

**Impact**: Voice is completely non-functional. User can connect to LiveKit but won't hear the agent or get proper state feedback.

---

### 🔴 C2: Python Agent Uses Wrong API Surface
**Found by**: Dr. Elena Volkov (Engineering)
**Severity**: CRITICAL — Agent will not register correctly

The current `agent/agent.py` uses deprecated/incorrect patterns vs the LiveKit Agents v1.4.1 SDK:

| Issue | Current Code | Correct (per reference) |
|-------|-------------|------------------------|
| Model import | `google.beta.realtime.RealtimeModel` | `google.realtime.RealtimeModel` |
| Model name | `gemini-2.5-flash-native-audio-preview` | `gemini-2.5-flash-native-audio-preview-12-2025` |
| Agent class | Subclasses `Agent` with `@function_tool()` on methods | Uses standalone `@llm.function_tool` + `find_function_tools()` + `tools=` param on session |
| Room options | None | `room_io.RoomOptions(close_on_disconnect=False)` needed for persistence |
| Job acceptance | Implicit | Needs `request_fnc=accept_all_jobs` to accept incoming jobs |
| Session start | `await session.start(room=ctx.room, agent=agent)` | `await session.start(room=ctx.room, agent=Agent(instructions=...), room_options=room_opts)` |

The Agent subclass pattern with `@function_tool()` on instance methods was an older SDK approach. The v1.4.1 SDK uses `llm.function_tool` as a standalone decorator on a utility class, with tools discovered via `llm.find_function_tools()`.

---

### 🔴 C3: Page Layout Does NOT Implement Stage + Transcript Model
**Found by**: Marcus Chen (Design)
**Severity**: CRITICAL — Violates core PRD design principle

PRD Round 2 established: **"Stage area (top 60%) shows active content. Below it, compact transcript."** Pattern 2 won user tests 2:1. But `page.tsx` uses the old chat-first layout:

```
CURRENT LAYOUT:              PRD REQUIRED LAYOUT:
┌─────────────────┐          ┌─────────────────┐
│ Header          │          │ Header          │
├─────────────────┤          ├─────────────────┤
│                 │          │  STAGE (60%)    │
│  ChatInterface  │          │  Orb / Products │
│  (full height)  │          │  / Cart         │
│  messages[],    │          ├─────────────────┤
│  input, cart    │          │  TRANSCRIPT     │
│                 │          │  (compact msgs) │
├─────────────────┤          ├─────────────────┤
│ VoiceControls   │          │ Input+Voice     │
└─────────────────┘          └─────────────────┘
```

**Components exist but aren't wired**: `Stage.tsx`, `TranscriptStream.tsx`, `Orb.tsx` all exist as files, but `page.tsx` only uses `ChatInterface` as the main content area. The Stage is never rendered in the page layout. The TranscriptStream is never used.

---

### 🔴 C4: No Unified Conversation State
**Found by**: Priya Shankar (PM)
**Severity**: CRITICAL — Voice and text are disconnected

PRD Round 5: **"ONE conversation context, TWO input modalities."** But currently:
- Text input → `/api/chat` → Gemini 2.0 Flash → response
- Voice → LiveKit → Python agent → Gemini 2.5 Flash Realtime → response
- These are TWO separate conversations with TWO separate LLMs
- Voice products arrive via `useEffect` and get injected as synthetic messages, but there's no shared conversation history
- The voice agent doesn't know what the user typed, and the text path doesn't know what the user said

**Impact**: User says "show me wedding gifts" via voice → sees products. Then types "add the first one" → text API has NO idea what "the first one" refers to because it has separate history.

---

## HIGH SEVERITY FINDINGS (P1 — Degrades Experience)

### 🟡 H1: No Per-Session Room Isolation
**Found by**: Dr. Elena Volkov
**PRD Section**: 3.1.1, Round 6

Token API defaults to room name `gift-session`. All users would share the same room. PRD requires `gift-{session-uuid}` per user.

```typescript
// CURRENT: static room name
const roomName = req.nextUrl.searchParams.get('room') || 'gift-session'

// REQUIRED: unique per session
const roomName = `gift-${crypto.randomUUID()}`
```

---

### 🟡 H2: No Contextual Suggestion Chips
**Found by**: Priya Shankar (PM)
**PRD Section**: 3.6.2

Current: Static suggestions shown only when `messages.length <= 2`.
PRD requires: Dynamic suggestions that change based on state:
- After products: "Add first one", "Tell me more", "Show cheaper options"
- After add-to-cart: "Checkout", "Keep shopping", "View cart"
- After checkout: "Start over", "Share gift"

---

### 🟡 H3: React 19 + Next.js 14 Peer Dependency Conflict
**Found by**: Dr. Elena Volkov
**Impact**: Build requires `--legacy-peer-deps`, may cause runtime issues

`package.json` specifies `react@^19.2.4` with `next@^14`. Next.js 14 officially requires React 18. Either:
- Downgrade React to `^18.3.1` (safer)
- Upgrade Next.js to `^15` (bigger change, but aligns with React 19)

---

### 🟡 H4: E2E Tests Reference Deleted Pages/Components
**Found by**: Priya Shankar (PM)

`__tests__/e2e/app.spec.ts` tests for:
- Landing page with "Shop Gifts" + "Admin Panel" cards → removed in Phase 11
- `/user` and `/admin` routes → no longer exist
- `StoreConnect` form on separate pages → now a modal

These tests will all fail and need complete rewrite.

---

### 🟡 H5: Python Agent Missing Data Channel Events
**Found by**: Dr. Elena Volkov
**PRD Section**: 3.1.4

Agent publishes `products_found`, `cart_updated`, `checkout_ready` but missing:
- `agent_state` events (`listening`, `thinking`, `speaking`, `idle`) — needed for Orb state
- `transcript` events — needed for TranscriptStream
- Bidirectional: frontend → agent `text_message` handler works but doesn't integrate with shared conversation context

---

### 🟡 H6: No Mobile-Responsive Voice Layout
**Found by**: Marcus Chen (Design)
**PRD Section**: 5.3, Round 7

PRD specifies:
- 64px mic button on mobile (current: 56px on all sizes)
- Transcript as caption overlay that auto-fades
- Products in vertical stack or carousel
- Cart as swipe-up bottom sheet
- Compact voice mode with 2-line caption

Current: No mobile-specific styles. The layout will stack vertically but without any of the PRD-specified mobile optimizations.

---

## MEDIUM SEVERITY FINDINGS (P2 — Polish Issues)

### 🔵 M1: No Idle Timeout
**PRD Risk Section**: "Auto-disconnect after 2 minutes of silence. Cost is real — Gemini bills per second."
No idle timeout implemented in `useVoiceAgent`. Voice session stays connected indefinitely.

### 🔵 M2: No Typing-Pauses-Mic Behavior
**PRD Section 3.6.1**: "Typing auto-pauses mic."
No integration between text input focus and mic state.

### 🔵 M3: No Product Highlight During Voice Description
**PRD Section 3.8**: "When agent is describing a product, that card gets a subtle highlight/glow."
`ProductCard` supports `isHighlighted` prop but nothing sets `highlightedProductId` based on agent speech.

### 🔵 M4: No Stagger Animation for Product Cards
**PRD Round 4**: "Cards stagger-animate in — card 1, then card 2, card 3 — like the agent is laying them out on a table."
Products appear all at once.

### 🔵 M5: Orb Doesn't Respond to Audio Amplitude
**PRD Round 3**: "Reacts to the user's voice amplitude. Ripples outward." and "Rhythmic pulsation matching the agent's speech amplitude."
Current Orb uses CSS animations only. No connection to actual audio levels from LiveKit's audio tracks.

### 🔵 M6: No Push-to-Talk Option
**PRD Section 3.5**: "Long-press for push-to-talk mode."
Not implemented.

---

## WHAT'S WORKING WELL ✅

| Feature | Status | Notes |
|---------|--------|-------|
| Text chat with Gemini function calling | ✅ 100% | Robust, handles multi-turn |
| MCP search + Admin API fallback | ✅ 100% | Synonym expansion working |
| Storefront GraphQL cart | ✅ 100% | cartCreate, cartLinesAdd, getCart |
| `/cart/c/` checkout URLs | ✅ 100% | Proper base64 encoding |
| Hallucination prevention | ✅ 100% | cleanResponse + retry logic |
| Product cards with images | ✅ 100% | Variants, pricing, stock |
| Product carousel (5+) / grid (≤4) | ✅ 100% | Snap scroll, arrows, dots |
| Cart panel (slide-in) | ✅ 100% | Items, total, checkout link |
| Store swap modal | ✅ 100% | Token validation, reset |
| Orb CSS animations | ✅ 100% | All 5 states defined |
| Build / TypeScript | ✅ 100% | Clean compile, no errors |
| Unit tests (fixed) | ✅ 78/78 | shopify-client, tools, API routes, components |

---

## REMEDIATION PLAN (Priority Order)

### Phase 1: Make Voice Work (C1, C2) — BLOCKING
1. Rewrite `useVoiceAgent.ts` → use `@livekit/components-react` (`LiveKitRoom`, `useVoiceAssistant`, `RoomAudioRenderer`, `StartAudio`)
2. Rewrite `agent/agent.py` → match reference agent patterns (standalone tools, correct model name, `room_io.RoomOptions`, `request_fnc`)
3. Fix token route → generate per-session unique room names (H1)

### Phase 2: Implement PRD Layout (C3, C4)
4. Rebuild `page.tsx` → Stage + Transcript + Input layout as defined in PRD Section 5.1
5. Create `VoiceProvider` context → wraps `LiveKitRoom`, provides unified state
6. Wire voice events → products/cart/checkout into unified conversation state
7. Route text input through voice agent when voice is active (send via data channel)

### Phase 3: UX Polish (H2, H5, H6, M1-M6)
8. Dynamic contextual suggestions based on conversation state
9. Agent state events for Orb synchronization
10. Mobile-responsive layout per PRD Section 5.3
11. Idle timeout (2 min) for cost control
12. Typing-pauses-mic behavior
13. Product card highlight during voice description
14. Stagger animations for card entrance

### Phase 4: Tests & QA (H4)
15. Rewrite E2E tests for current page structure
16. Add voice integration tests (data channel events)
17. Browser QA: voice flow, mixed modality, mobile

---

**Conclusion**: The text commerce foundation is production-grade. The voice integration needs a fundamental rewrite of the LiveKit layer (both frontend hook and Python agent) plus a page layout restructure to match the PRD's Stage + Transcript model. Estimated effort: significant but achievable since the building blocks exist — they just need to be wired correctly.

*— Panel review complete. Ready to execute remediation.*
