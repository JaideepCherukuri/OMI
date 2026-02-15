"""
Pre-built luxury gift product catalog.

Contains 12 curated products across occasions:
  - Valentine's Day (2)
  - Brother's Birthday (2)
  - Wedding Anniversary (2)
  - Friend's Birthday (2)
  - Any Occasion (4)

Usage:
    from shopify_agent.catalogs.luxury_gifts import LUXURY_GIFT_CATALOG
    manager.bulk_create_products(LUXURY_GIFT_CATALOG)
"""

from shopify_agent.store_manager import ProductInput, VariantInput

LUXURY_GIFT_CATALOG: list[ProductInput] = [
    # ── VALENTINE'S DAY ────────────────────────────────────────
    ProductInput(
        title="Eternal Rose & Gold Leaf Crystal Box",
        description_html=(
            "<p>A breathtaking preserved rose encased in a hand-blown crystal box "
            "with 24K gold leaf accents. Each rose is carefully selected and preserved "
            "to last a lifetime — just like your love.</p>"
            "<ul>"
            "<li>Real preserved rose — lasts 3+ years</li>"
            "<li>Hand-blown borosilicate crystal enclosure</li>"
            "<li>24K gold leaf detailing</li>"
            "<li>Velvet-lined magnetic gift box included</li>"
            "<li>Personalized message card</li>"
            "</ul>"
        ),
        vendor="Maison de Fleur",
        product_type="Luxury Gifts",
        tags=["Valentine's Day", "Romantic", "Luxury", "Roses", "For Her", "For Him", "Anniversary"],
        option_name="Style",
        image_urls=[
            "https://images.unsplash.com/photo-1490750967868-88aa4f44baee?w=1200&q=80",
            "https://images.unsplash.com/photo-1455659817273-f96807779a8a?w=1200&q=80",
        ],
        variants=[
            VariantInput(option_value="Ruby Red", price="189.95", sku="LUX-ROSE-RED",
                         inventory_quantity=25, delivery_time="3-5 business days",
                         available_regions="India, USA, UK, EU, Australia"),
            VariantInput(option_value="Midnight Black", price="189.95", sku="LUX-ROSE-BLK",
                         inventory_quantity=15, delivery_time="3-5 business days",
                         available_regions="India, USA, UK, EU, Australia"),
            VariantInput(option_value="24K Gold Dipped", price="289.95", sku="LUX-ROSE-GLD",
                         inventory_quantity=10, delivery_time="7-10 business days",
                         available_regions="USA, UK, EU"),
        ],
    ),
    ProductInput(
        title="Couple's Luxury Spa Retreat Set",
        description_html=(
            "<p>Transform any evening into a five-star spa experience. This indulgent "
            "set includes everything two people need for a night of pure relaxation — "
            "hand-poured candles, organic bath oils, silk eye masks, and champagne-infused "
            "body butter.</p>"
            "<ul>"
            "<li>2× organic lavender & rose bath oils (200ml)</li>"
            "<li>2× pure silk eye masks</li>"
            "<li>Hand-poured soy candle (60hr burn)</li>"
            "<li>Champagne-infused body butter duo</li>"
            "<li>Bamboo bath tray</li>"
            "<li>Presented in a reusable linen keepsake box</li>"
            "</ul>"
        ),
        vendor="Velvet & Bloom",
        product_type="Luxury Gifts",
        tags=["Valentine's Day", "Romantic", "Spa", "Couples", "Self-Care", "For Her", "For Him", "Anniversary"],
        option_name="Collection",
        image_urls=[
            "https://images.unsplash.com/photo-1540555700478-4be289fbec6f?w=1200&q=80",
            "https://images.unsplash.com/photo-1507652313519-d4e9174996dd?w=1200&q=80",
        ],
        variants=[
            VariantInput(option_value="Classic Collection", price="249.95", sku="LUX-SPA-CLS",
                         inventory_quantity=30, delivery_time="3-5 business days",
                         available_regions="India, USA, UK, EU, Australia, Canada"),
            VariantInput(option_value="Premium Collection (+ Silk Robes)", price="399.95", sku="LUX-SPA-PRM",
                         inventory_quantity=15, delivery_time="5-7 business days",
                         available_regions="USA, UK, EU, Canada"),
        ],
    ),

    # ── BROTHER'S BIRTHDAY ─────────────────────────────────────
    ProductInput(
        title="Italian Full-Grain Leather Weekend Duffel",
        description_html=(
            "<p>Handcrafted in Tuscany from full-grain vegetable-tanned leather, this "
            "duffel ages beautifully with every trip. Brass YKK zippers, cotton canvas "
            "lining, and a dedicated shoe compartment make this the last bag he'll ever need.</p>"
            "<ul>"
            "<li>Full-grain vegetable-tanned Italian leather</li>"
            "<li>Brass hardware & YKK zippers</li>"
            "<li>Detachable padded shoulder strap</li>"
            "<li>Dedicated shoe compartment</li>"
            "<li>Interior laptop sleeve (fits 15\")</li>"
            '<li>Dimensions: 22" × 11" × 12"</li>'
            "</ul>"
        ),
        vendor="Firenze Leather Co.",
        product_type="Luxury Accessories",
        tags=["Birthday", "Brother", "For Him", "Leather", "Travel", "Luxury", "Men's Gifts"],
        option_name="Color",
        image_urls=[
            "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=1200&q=80",
            "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=1200&q=80",
        ],
        variants=[
            VariantInput(option_value="Cognac Brown", price="395.00", sku="LUX-DUF-COG",
                         inventory_quantity=20, delivery_time="5-7 business days",
                         available_regions="India, USA, UK, EU, Australia"),
            VariantInput(option_value="Jet Black", price="395.00", sku="LUX-DUF-BLK",
                         inventory_quantity=20, delivery_time="5-7 business days",
                         available_regions="India, USA, UK, EU, Australia"),
            VariantInput(option_value="Vintage Tan", price="425.00", sku="LUX-DUF-TAN",
                         inventory_quantity=12, delivery_time="7-10 business days",
                         available_regions="USA, UK, EU"),
        ],
    ),
    ProductInput(
        title="Artisan Single Malt Whiskey Tasting Collection",
        description_html=(
            "<p>A curated journey through the world's finest single malts. Five 50ml "
            "bottles from legendary distilleries, paired with hand-turned oak tasting "
            "glasses, tasting notes by a master sommelier, and artisan dark chocolate truffles.</p>"
            "<ul>"
            "<li>5× 50ml premium single malt selections</li>"
            "<li>2× hand-turned Scottish oak tasting glasses</li>"
            "<li>Leather-bound tasting journal with sommelier notes</li>"
            "<li>Artisan dark chocolate truffle pairing (12pc)</li>"
            "<li>Whiskey stone set (9 soapstone cubes)</li>"
            "<li>Walnut presentation box</li>"
            "</ul>"
            "<p><em>Must be 21+ to purchase. Ships to applicable regions only.</em></p>"
        ),
        vendor="The Cask Collective",
        product_type="Luxury Gifts",
        tags=["Birthday", "Brother", "For Him", "Whiskey", "Spirits", "Luxury", "Men's Gifts", "Gourmet"],
        option_name="Selection",
        image_urls=[
            "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=1200&q=80",
            "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=1200&q=80",
        ],
        variants=[
            VariantInput(option_value="Classic Selection", price="275.00", sku="LUX-WHSK-CLS",
                         inventory_quantity=18, delivery_time="5-7 business days",
                         available_regions="USA, UK, EU"),
            VariantInput(option_value="Rare Reserve Selection", price="475.00", sku="LUX-WHSK-RRE",
                         inventory_quantity=8, delivery_time="10-14 business days",
                         available_regions="USA, UK"),
        ],
    ),

    # ── WEDDING ANNIVERSARY ────────────────────────────────────
    ProductInput(
        title="Bespoke Star Map — The Night We Said Forever",
        description_html=(
            "<p>An astronomically accurate map of the stars as they appeared on your "
            "wedding night. Every constellation, every star — precisely rendered for your "
            "exact date, time, and location. Printed on museum-grade cotton rag paper.</p>"
            "<ul>"
            "<li>Astronomically accurate star positions for your date & location</li>"
            "<li>Museum-grade 310gsm cotton rag paper</li>"
            "<li>Archival pigment inks (100+ year lightfastness)</li>"
            "<li>Custom headline, date, and coordinates</li>"
            "<li>Optional: solid walnut or matte black frame</li>"
            "</ul>"
            "<p><em>After purchase, we'll email you to collect your wedding date, time, and location.</em></p>"
        ),
        vendor="Celestial Prints",
        product_type="Personalized Gifts",
        tags=["Wedding Anniversary", "Personalized", "Romantic", "Home Decor", "For Her", "For Him", "Luxury", "Couples"],
        option_name="Size & Framing",
        image_urls=[
            "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&q=80",
            "https://images.unsplash.com/photo-1532978379173-523e16f371f2?w=1200&q=80",
        ],
        variants=[
            VariantInput(option_value='Print Only (18×24")', price="149.95", sku="LUX-STAR-PRT",
                         inventory_quantity=50, delivery_time="5-7 business days",
                         available_regions="India, USA, UK, EU, Australia, Canada, Japan"),
            VariantInput(option_value='Walnut Framed (18×24")', price="249.95", sku="LUX-STAR-WLN",
                         inventory_quantity=25, delivery_time="7-10 business days",
                         available_regions="India, USA, UK, EU, Australia, Canada"),
            VariantInput(option_value='Grand Format Framed (24×36")', price="349.95", sku="LUX-STAR-GRD",
                         inventory_quantity=15, delivery_time="10-14 business days",
                         available_regions="USA, UK, EU, Australia"),
        ],
    ),
    ProductInput(
        title="Luxury Silk Robe Set for Two",
        description_html=(
            "<p>Pure mulberry silk, 22-momme weight — the gold standard. This matching "
            "set includes two full-length robes with contrast piping, monogramming, and "
            "a silk pillowcase duo.</p>"
            "<ul>"
            "<li>22-momme Grade 6A mulberry silk</li>"
            "<li>Two full-length robes with pockets</li>"
            "<li>Contrast satin piping</li>"
            "<li>Complimentary monogram embroidery (up to 3 initials each)</li>"
            "<li>Bonus: 2× matching silk pillowcases</li>"
            "<li>Sizes: S/M – L/XL per robe</li>"
            "</ul>"
        ),
        vendor="Maison Soie",
        product_type="Luxury Apparel",
        tags=["Wedding Anniversary", "Romantic", "Silk", "Couples", "For Her", "For Him", "Luxury", "Personalized"],
        option_name="Color Pairing",
        image_urls=[
            "https://images.unsplash.com/photo-1616046229478-9901c5536a45?w=1200&q=80",
        ],
        variants=[
            VariantInput(option_value="Champagne & Ivory", price="329.95", sku="LUX-ROBE-CIV",
                         inventory_quantity=20, delivery_time="5-7 business days",
                         available_regions="India, USA, UK, EU, Australia, Canada"),
            VariantInput(option_value="Midnight Navy & Silver", price="329.95", sku="LUX-ROBE-MNS",
                         inventory_quantity=20, delivery_time="5-7 business days",
                         available_regions="India, USA, UK, EU, Australia, Canada"),
            VariantInput(option_value="Blush Rose & Charcoal", price="329.95", sku="LUX-ROBE-BRC",
                         inventory_quantity=15, delivery_time="7-10 business days",
                         available_regions="USA, UK, EU, Canada"),
        ],
    ),

    # ── FRIEND'S BIRTHDAY ──────────────────────────────────────
    ProductInput(
        title="Gourmet Artisan Chocolate & Wine Pairing Box",
        description_html=(
            "<p>A sommelier-curated pairing of single-origin chocolates and boutique wines. "
            "Each of the 6 chocolate pieces is crafted to complement a specific wine profile.</p>"
            "<ul>"
            "<li>6× single-origin artisan chocolate pieces</li>"
            "<li>2× boutique wine half-bottles (375ml)</li>"
            "<li>Illustrated tasting guide with pairing notes</li>"
            "<li>Hand-made ceramic tasting plate</li>"
            "<li>Presented in a magnetic-close gift box</li>"
            "</ul>"
            "<p><em>Must be 21+ to purchase. Wine selections rotate seasonally.</em></p>"
        ),
        vendor="Cacao & Cork",
        product_type="Gourmet Gifts",
        tags=["Birthday", "Friend", "Gourmet", "Chocolate", "Wine", "Luxury", "For Her", "For Him", "Foodie"],
        option_name="Pairing",
        image_urls=[
            "https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=1200&q=80",
            "https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=1200&q=80",
        ],
        variants=[
            VariantInput(option_value="Dark Chocolate & Red Wine", price="175.00", sku="LUX-CHOC-DRW",
                         inventory_quantity=25, delivery_time="3-5 business days",
                         available_regions="USA, UK, EU"),
            VariantInput(option_value="Milk & White Chocolate & Rosé", price="175.00", sku="LUX-CHOC-MWR",
                         inventory_quantity=25, delivery_time="3-5 business days",
                         available_regions="USA, UK, EU"),
            VariantInput(option_value="Grand Tasting (12pc + Full Bottles)", price="295.00", sku="LUX-CHOC-GRD",
                         inventory_quantity=12, delivery_time="5-7 business days",
                         available_regions="USA, UK"),
        ],
    ),
    ProductInput(
        title="Adventure Experiences Gift Box",
        description_html=(
            "<p>Give the gift of unforgettable memories. Each box contains a redeemable "
            "experience voucher, a premium branded tumbler, and a pocket adventure journal.</p>"
            "<ul>"
            "<li>Redeemable experience voucher (valid 12 months)</li>"
            "<li>Insulated stainless steel tumbler (20oz)</li>"
            "<li>Leather-bound pocket adventure journal</li>"
            "<li>Custom photo frame for their adventure pics</li>"
            "</ul>"
            "<p><em>Experiences include: hot air balloon rides, sunset sailing, gourmet cooking "
            "classes, helicopter tours, and more.</em></p>"
        ),
        vendor="Wanderlux",
        product_type="Experience Gifts",
        tags=["Birthday", "Friend", "Adventure", "Experiences", "For Her", "For Him", "Luxury", "Unique"],
        option_name="Tier",
        image_urls=[
            "https://images.unsplash.com/photo-1507608616759-54f48f0af0ee?w=1200&q=80",
            "https://images.unsplash.com/photo-1473496169904-658ba7c44d8a?w=1200&q=80",
        ],
        variants=[
            VariantInput(option_value="Explorer (Local Adventures)", price="199.95", sku="LUX-ADV-EXP",
                         inventory_quantity=40, delivery_time="2-3 business days",
                         available_regions="India, USA, UK, EU, Australia, Canada"),
            VariantInput(option_value="Thrill Seeker (Premium Adventures)", price="349.95", sku="LUX-ADV-THR",
                         inventory_quantity=25, delivery_time="2-3 business days",
                         available_regions="India, USA, UK, EU, Australia"),
            VariantInput(option_value="Ultimate (Bucket List Experiences)", price="599.95", sku="LUX-ADV-ULT",
                         inventory_quantity=10, delivery_time="3-5 business days",
                         available_regions="USA, UK, EU, Australia"),
        ],
    ),

    # ── ANY OCCASION ───────────────────────────────────────────
    ProductInput(
        title="Hand-Poured Luxury Candle Trio",
        description_html=(
            "<p>Three signature scents crafted by a master perfumer in Grasse, France. "
            "Each candle is hand-poured with a coconut-soy wax blend and wooden wick.</p>"
            "<ul>"
            "<li>3× 8oz hand-poured candles</li>"
            "<li>Coconut-soy wax blend, cotton-wood wick</li>"
            "<li>60+ hour burn time each</li>"
            "<li>Scents: Velvet Oud, Mediterranean Fig, Vanilla Bourbon</li>"
            "<li>Reusable hand-blown glass vessels</li>"
            "<li>Linen drawstring gift bag</li>"
            "</ul>"
        ),
        vendor="Lumière Atelier",
        product_type="Luxury Home",
        tags=["Any Occasion", "Home Decor", "Candles", "Luxury", "For Her", "For Him", "Housewarming", "Self-Care"],
        option_name="Set",
        image_urls=[
            "https://images.unsplash.com/photo-1602607312530-ead18c0c09b7?w=1200&q=80",
            "https://images.unsplash.com/photo-1603006905003-be475563bc59?w=1200&q=80",
        ],
        variants=[
            VariantInput(option_value="Signature Trio", price="129.95", sku="LUX-CND-TRI",
                         inventory_quantity=40, delivery_time="3-5 business days",
                         available_regions="India, USA, UK, EU, Australia, Canada, Japan"),
            VariantInput(option_value="Grand Collection (5 Scents)", price="199.95", sku="LUX-CND-GRD",
                         inventory_quantity=20, delivery_time="3-5 business days",
                         available_regions="India, USA, UK, EU, Australia, Canada"),
        ],
    ),
    ProductInput(
        title="Premium Cashmere Wrap & Scarf Set",
        description_html=(
            "<p>Woven from Grade-A Mongolian cashmere — impossibly soft, featherlight, "
            "and warm. Includes an oversized wrap and a classic scarf with hand-rolled edges.</p>"
            "<ul>"
            '<li>100% Grade-A Mongolian cashmere</li>'
            '<li>1× oversized wrap (80" × 28")</li>'
            '<li>1× classic scarf (72" × 12")</li>'
            "<li>Hand-rolled edges</li>"
            "<li>Moth-resistant cedar gift box</li>"
            "</ul>"
        ),
        vendor="Altai Cashmere",
        product_type="Luxury Apparel",
        tags=["Any Occasion", "Cashmere", "Luxury", "For Her", "For Him", "Winter", "Fashion", "Birthday"],
        option_name="Color",
        image_urls=[
            "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=1200&q=80",
            "https://images.unsplash.com/photo-1609803384069-19f3e5a70e75?w=1200&q=80",
        ],
        variants=[
            VariantInput(option_value="Heather Grey", price="225.00", sku="LUX-CSH-GRY",
                         inventory_quantity=20, delivery_time="5-7 business days",
                         available_regions="India, USA, UK, EU, Australia, Canada"),
            VariantInput(option_value="Camel", price="225.00", sku="LUX-CSH-CML",
                         inventory_quantity=20, delivery_time="5-7 business days",
                         available_regions="India, USA, UK, EU, Australia, Canada"),
            VariantInput(option_value="Ivory", price="225.00", sku="LUX-CSH-IVR",
                         inventory_quantity=15, delivery_time="5-7 business days",
                         available_regions="India, USA, UK, EU, Australia, Canada"),
            VariantInput(option_value="Burgundy", price="245.00", sku="LUX-CSH-BRG",
                         inventory_quantity=12, delivery_time="7-10 business days",
                         available_regions="USA, UK, EU, Canada"),
        ],
    ),
    ProductInput(
        title="Personalized Leather Journal & Fountain Pen Set",
        description_html=(
            "<p>Full-grain Italian leather journal with hot-stamped personalization, "
            "paired with a German-engineered fountain pen.</p>"
            "<ul>"
            "<li>Full-grain vegetable-tanned leather cover</li>"
            "<li>Hot-stamped name or initials (up to 20 characters)</li>"
            "<li>192 pages, 120gsm acid-free cream paper</li>"
            "<li>Lay-flat Smyth-sewn binding</li>"
            "<li>German-engineered fountain pen with converter</li>"
            "<li>Ink bottle (50ml, choice of 4 colors)</li>"
            "<li>Presented in a cloth-lined magnetic box</li>"
            "</ul>"
            "<p><em>Personalization details collected after purchase via email.</em></p>"
        ),
        vendor="Carta & Quill",
        product_type="Personalized Gifts",
        tags=["Any Occasion", "Personalized", "Leather", "Stationery", "For Her", "For Him", "Luxury", "Birthday", "Graduation"],
        option_name="Leather Color",
        image_urls=[
            "https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=1200&q=80",
            "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=1200&q=80",
        ],
        variants=[
            VariantInput(option_value="British Tan Leather", price="165.00", sku="LUX-JRN-TAN",
                         inventory_quantity=30, delivery_time="5-7 business days",
                         available_regions="India, USA, UK, EU, Australia, Canada, Japan"),
            VariantInput(option_value="Oxford Black Leather", price="165.00", sku="LUX-JRN-BLK",
                         inventory_quantity=30, delivery_time="5-7 business days",
                         available_regions="India, USA, UK, EU, Australia, Canada, Japan"),
            VariantInput(option_value="Emerald Green Leather", price="185.00", sku="LUX-JRN-EMR",
                         inventory_quantity=15, delivery_time="7-10 business days",
                         available_regions="USA, UK, EU, Canada"),
        ],
    ),
    ProductInput(
        title="Luxury Tea & Artisan Honey Tasting Collection",
        description_html=(
            "<p>A curated collection of 8 rare single-estate teas paired with 4 artisan "
            "honeys from around the world. Includes a handmade ceramic teapot, two matching "
            "cups, and a tasting guide by a certified tea master.</p>"
            "<ul>"
            "<li>8× single-estate loose leaf teas (25g each)</li>"
            "<li>4× artisan honey jars (Manuka, Acacia, Wildflower, Buckwheat)</li>"
            "<li>Handmade ceramic teapot & 2 cups</li>"
            "<li>Bamboo tea scoop & strainer</li>"
            "<li>Illustrated tasting guide</li>"
            "<li>Woven seagrass gift basket</li>"
            "</ul>"
        ),
        vendor="The Tea Atelier",
        product_type="Gourmet Gifts",
        tags=["Any Occasion", "Tea", "Gourmet", "Luxury", "For Her", "For Him", "Foodie", "Housewarming", "Birthday"],
        option_name="Collection",
        image_urls=[
            "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=1200&q=80",
            "https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=1200&q=80",
        ],
        variants=[
            VariantInput(option_value="Classic Collection", price="145.00", sku="LUX-TEA-CLS",
                         inventory_quantity=25, delivery_time="3-5 business days",
                         available_regions="India, USA, UK, EU, Australia, Canada, Japan"),
            VariantInput(option_value="Connoisseur Collection (12 Teas + 6 Honeys)", price="225.00", sku="LUX-TEA-CON",
                         inventory_quantity=15, delivery_time="5-7 business days",
                         available_regions="India, USA, UK, EU, Australia, Canada"),
        ],
    ),
]
