const products = [
  {
    id: "tokyo-7day",
    name: "Tokyo 7-Day Itinerary",
    tagline: "A free Notion template for your first week in Tokyo.",
    description:
      "Day-by-day plans, transport reference, food vocabulary, and a daily budget tracker — all in one clean Notion workspace. Free, forever.",
    price: "Free",
    badge: "Free",
    gumroadUrl: "https://gumroad.com/l/tokyo-7day",
    highlights: [
      "7 fully planned days",
      "Transport & subway cheat sheet",
      "Japanese food vocabulary",
      "Budget tracker built in",
    ],
  },
  {
    id: "japan-14day",
    name: "Japan 14-Day Adventure Bundle",
    tagline: "The complete system for planning 2 weeks across Japan.",
    description:
      "Tokyo · Kyoto · Nara · Osaka · Hiroshima. Includes a 14-day itinerary, packing system, transport decoder, and accommodation list.",
    price: "¥980",
    badge: "Premium",
    gumroadUrl: "https://gumroad.com/l/japan-14day",
    highlights: [
      "14-day multi-city itinerary",
      "Packing system (carry-on only)",
      "Transport decoder (Shinkansen, IC cards)",
      "Accommodation shortlist by city",
      "Budget planning worksheet",
    ],
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="px-8 py-24 text-center max-w-2xl mx-auto">
        <p className="text-xs tracking-widest uppercase text-stone-400 mb-6" style={{ letterSpacing: "0.3em" }}>
          間 · Ma
        </p>
        <h1 className="text-4xl md:text-5xl font-serif font-normal mb-6 leading-tight" style={{ color: "#1A1A18" }}>
          Plan Japan.<br />Without the noise.
        </h1>
        <p className="text-base text-stone-600 leading-relaxed max-w-lg mx-auto">
          Notion templates built on the Japanese principle of <em>kanso</em> —
          simplicity, only what matters. No clutter, no overwhelm.
        </p>
      </section>

      {/* Divider */}
      <div className="max-w-3xl mx-auto px-8">
        <div className="border-t border-stone-200" />
      </div>

      {/* Products */}
      <section className="px-8 py-20 max-w-3xl mx-auto">
        <div className="grid gap-12 md:grid-cols-2">
          {products.map((product) => (
            <div key={product.id} className="flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <span className="text-xs tracking-widest uppercase text-stone-400" style={{ letterSpacing: "0.2em" }}>
                  {product.badge}
                </span>
                <span className="text-sm font-serif text-ink">{product.price}</span>
              </div>
              <h2 className="text-xl font-serif font-normal mb-3 leading-snug" style={{ color: "#1A1A18" }}>
                {product.name}
              </h2>
              <p className="text-sm text-stone-600 leading-relaxed mb-5">
                {product.description}
              </p>
              <ul className="mb-8 space-y-2">
                {product.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2 text-sm text-stone-700">
                    <span className="mt-0.5 text-stone-400">—</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
              <a
                href={product.gumroadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-auto inline-block border border-ink text-ink text-sm px-6 py-3 text-center tracking-wider hover:bg-ink hover:text-cream transition-colors"
                style={{ letterSpacing: "0.1em" }}
              >
                {product.price === "Free" ? "Download Free" : `Get for ${product.price}`}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Trust section */}
      <section className="px-8 py-16 border-t border-stone-200 text-center">
        <p className="text-xs text-stone-400 tracking-wide max-w-sm mx-auto leading-relaxed">
          Built for people who want to experience Japan deeply, not just check it off a list.
          All templates open in Notion. Duplicate and it&apos;s yours.
        </p>
      </section>
    </>
  );
}
