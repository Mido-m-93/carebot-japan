# Kanso Templates
### Digital product business — StartupRobos instance

**Template type:** `digital_product`
**Status:** Active — initial product lineup created
**Revenue model:** Gumroad direct sales

---

## Business Overview

Kanso Templates is a Gumroad shop selling Japan-themed Notion templates and travel planning tools, targeting English speakers planning a Japan trip or considering moving to Japan.

**Brand philosophy:** Kanso (簡素) — the Japanese aesthetic of simplicity. Every product removes the unnecessary to reveal what actually matters for travelers.

**Traffic source:** Organic from JapanUnlocked (sibling affiliate/SEO business)

---

## Product Lineup

| # | Product | Price | Purpose |
|---|---|---|---|
| 1 | 7-Day Tokyo Itinerary | **FREE ($0)** | Lead magnet → email list growth |
| 2 | Japan 14-Day Adventure Bundle | **$12** | Core revenue product |

### Product 1: 7-Day Tokyo Itinerary (Lead Magnet)
- **File:** `products/01-tokyo-7day-itinerary.md`
- **Gumroad listing:** `gumroad/product-descriptions.md` → Product 1 section
- **What it is:** Notion template covering 7 days in Tokyo — daily schedule, pre-trip checklist, budget tracker, food phrases, transport cheat sheet
- **Why free:** Captures email addresses, builds trust, creates natural upsell to Product 2
- **Format:** Markdown (imports to Notion) + PDF export

### Product 2: Japan 14-Day Adventure Bundle
- **File:** `products/02-japan-14day-adventure-bundle.md`
- **Gumroad listing:** `gumroad/product-descriptions.md` → Product 2 section
- **What it is:** 3-part bundle — 14-day itinerary (Tokyo-Kyoto-Osaka) + packing system + transport decoder
- **Price:** $12 one-time
- **Format:** Markdown (imports to Notion) + PDF export

---

## Pricing Strategy

### Why $0 / $12?

**Free lead magnet logic:**
- Zero friction to download — builds the email list
- Tokyo-only scope makes it genuinely useful but incomplete
- Creates strong upsell context (you've seen quality, now want more)
- Shareable — travelers share free resources, creating organic spread

**$12 for the bundle:**
- Undercuts generic travel guide books ($18–$25 on Amazon) while being more actionable
- Low enough that impulse purchase is reasonable for someone already planning a trip
- High enough to signal real value (free-perceived products convert worse to trust)
- Leaves room to test: $15 or $19 in future if conversion rate is strong

**Future pricing ladder:**
- $0 — Tokyo 7-day (lead magnet)
- $12 — Japan 14-day bundle (current)
- $19 — Japan for expats / moving guide (planned)
- $29 — Japan 30-day slow travel bundle (planned)

---

## Gumroad Setup Steps

### Step 1: Create a Gumroad Account
1. Go to gumroad.com
2. Sign up with business email
3. Add Stripe for payment processing (required for payouts)
4. Set payout schedule (weekly is fine to start)

### Step 2: Create Product 1 (Free Lead Magnet)

1. Click "New Product" → type: Digital Product
2. **Name:** `7-Day Tokyo Itinerary — Free Notion Template`
3. **Price:** $0 (toggle "Pay what you want" OFF — keep it truly free)
4. **Description:** Copy from `gumroad/product-descriptions.md` → Product 1 section
5. **Upload files:**
   - Export `products/01-tokyo-7day-itinerary.md` as PDF
   - Include the original `.md` file for Notion import
   - Bundle both in a single `.zip`
6. **Cover image:** Create in Canva — minimal, cream background, serif type, torii gate line icon
7. **Confirmation page message:** Copy the "After download CTA" from the product description file
8. **Set up email follow-up:** Copy the follow-up email from the product description file
9. **Publish**

### Step 3: Create Product 2 (Paid Bundle)

1. Click "New Product" → type: Digital Product
2. **Name:** `Japan 14-Day Adventure Bundle — Itinerary + Packing List + Transport Guide`
3. **Price:** $12
4. **Description:** Copy from `gumroad/product-descriptions.md` → Product 2 section
5. **Upload files:**
   - Export `products/02-japan-14day-adventure-bundle.md` as PDF
   - Include the original `.md` file for Notion import
   - Bundle in a `.zip` named `kanso-japan-14day-bundle.zip`
6. **Cover image:** Create in Canva — minimal, cream background, large "14" in serif numerals, three small icons
7. **Publish**

### Step 4: Link Products Together

In Product 1's confirmation page:
- Add a link to Product 2 with the line: "Ready to plan the full trip? → Japan 14-Day Adventure Bundle ($12)"

In Product 2's listing:
- Add at the bottom: "Not sure yet? Start with our free 7-Day Tokyo template →"

### Step 5: Enable Email Collection

In Gumroad settings:
- Turn on "Collect buyers' emails"
- Export the list monthly
- Use Mailchimp (free tier) or ConvertKit to send follow-up sequences

---

## Traffic Strategy: JapanUnlocked Connection

Kanso Templates receives organic traffic from **JapanUnlocked** — the companion affiliate SEO site that publishes Japan travel articles.

### Placement Points on JapanUnlocked

Every JapanUnlocked article about Tokyo or Japan travel should include:

**Inline CTA (mid-article):**
> "Planning your own trip? Our free 7-Day Tokyo Itinerary Notion template has the full schedule, budget tracker, and key Japanese phrases — download free at kanso-templates.gumroad.com"

**End-of-article CTA:**
> "For the full 14-day Tokyo → Kyoto → Osaka plan (plus a packing system and transport decoder), the Japan 14-Day Adventure Bundle is $12 at kanso-templates.gumroad.com"

**Article types that convert best:**
- "How many days do I need in Tokyo?"
- "Tokyo itinerary first time"
- "Japan budget travel"
- "Is the JR Pass worth it?"
- "Tokyo to Kyoto how to get there"

### UTM Tracking

Add UTM parameters to all links from JapanUnlocked:

```
https://kanso-templates.gumroad.com/l/tokyo-7day?utm_source=japanunlocked&utm_medium=article&utm_campaign=[article-slug]
```

This lets you see which JapanUnlocked articles drive the most Gumroad downloads/sales.

---

## Revenue Projections (Conservative)

### Month 1-2 (build phase)
- Traffic: organic from JapanUnlocked SEO articles (slow to build)
- Free downloads: 20–50/month
- Paid conversions: 3–8% of free downloaders → 1–4 sales/month
- Revenue: $12–$48/month

### Month 3-6 (growth phase)
- Free downloads: 100–300/month (as SEO articles rank)
- Paid conversion rate: 5–10%
- Revenue: $60–$360/month

### Month 6+ (established)
- At 500 free downloads/month with 8% conversion: ~40 sales = $480/month
- Add Product 3 ($19 moving guide) → additional revenue stream

**Break-even on Gumroad:** Immediate (Gumroad takes 10% + payment processing ~3%)
**Net per $12 sale:** ~$10.44

---

## Experiment 1: First Validation

**Hypothesis:** English speakers planning Japan trips will download the free Tokyo template if they discover it through JapanUnlocked articles.

**Metric:** Number of free downloads in first 30 days

**Goal:** 50 downloads in 30 days

**Method:**
1. Publish Kanso Templates on Gumroad
2. Add CTAs to the first 5 JapanUnlocked articles published
3. Share the free template on 2-3 relevant subreddits (r/JapanTravel, r/JapanTravelTips) with honest context

**Success:** 50+ downloads → proceed to optimize paid conversion
**Failure (<20 downloads):** Revise CTA placement or traffic source

---

## File Structure

```
businesses/kanso-templates/
├── README.md                          ← This file
├── products/
│   ├── 01-tokyo-7day-itinerary.md    ← Free product content
│   └── 02-japan-14day-adventure-bundle.md  ← Paid product content
└── gumroad/
    └── product-descriptions.md        ← Gumroad listing copy
```

---

## Next Products (Planned)

| Product | Price | Target Audience |
|---|---|---|
| Japan for Expats: Moving Guide | $19 | People considering relocating to Japan |
| Japan 30-Day Slow Travel Bundle | $29 | Longer trip / digital nomad |
| Kyoto Deep Dive (3-day temple focus) | $9 | Culture-focused travelers |
| Japan on a Budget: Backpacker Edition | $15 | Budget-conscious under-30s |

---

## Notes for CMO Agent

- All products use minimal Kanso aesthetic — cream/off-white tones, serif type, clean line icons
- No affiliate links in the templates themselves (conflict of interest with Gumroad positioning)
- JapanUnlocked drives traffic via SEO; Kanso Templates converts that traffic to revenue
- The email list built via Product 1 is the long-term asset — treat email capture as the primary KPI for the free product, not downloads alone
- Do not use paid ads — organic only per StartupRobos operating rules
