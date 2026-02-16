# GiftAI Voice Agent

Python voice agent powered by LiveKit Agents SDK + Gemini 2.5 Flash.

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Copy and configure env
cp .env.example .env.local
# Edit .env.local with your credentials

# 3. Run the agent (connects to LiveKit Cloud)
python agent.py dev
```

## Architecture

```
Frontend (Vercel)  →  creates room + token  →  LiveKit Cloud
Agent (this)       →  python agent.py dev   →  connects to same LiveKit Cloud
LiveKit Cloud dispatches job → agent picks it up → Gemini 2.5 Flash handles voice
```

## Tools (7 total)

| Tool | Description |
|------|-------------|
| `search_products` | Search connected Shopify store |
| `get_product_details` | Get full product details by ID |
| `create_cart` | Create a new shopping cart |
| `add_to_cart` | Add a product to the cart |
| `get_cart` | View current cart contents |
| `get_checkout_url` | Generate checkout URL |
| `search_global_products` | Search ALL Shopify merchants (Catalog MCP) |

## Files

- `agent.py` — Main agent entrypoint and session logic
- `shopify_tools.py` — All 7 Shopify tool definitions
- `catalog_mcp.py` — Catalog MCP client (global search + JWT management)
- `.env.example` — Environment variable template
