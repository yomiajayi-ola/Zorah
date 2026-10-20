import {
  getFiatPairs,
  getCryptoList,
  getTrend,
  convert,
  HIGHLIGHT_PAIRS,
  TREND_PAIRS,
  FIAT_LIST_PAIRS,
  CONVERTER_DEFAULT,
  CONVERTER_FIAT,
  CRYPTO_ASSETS,
} from "../services/fx.service.js";

/**
 * GET /api/fx/rates
 * Payload mirrors the FX Rate screen sections:
 *  highlights  → top carousel cards (USD/GBP/EUR vs NGN + 24hr change)
 *  trends      → "Rates Trends" chart tabs (7 daily points per pair)
 *  converter   → "Currency Converter" defaults, currencies, "Rates Updated"
 *  fiat        → "FX Rates" tab › Fiat Currency list (+ Live badge)
 *  crypto      → "Crypto" tab list
 */
export const getRates = async (req, res) => {
  try {
    const [highlightsRes, listRes, cryptoRes, trendsRes] = await Promise.allSettled([
      getFiatPairs(HIGHLIGHT_PAIRS),
      getFiatPairs(FIAT_LIST_PAIRS),
      getCryptoList(),
      Promise.all(TREND_PAIRS.map((p) => getTrend(p))),
    ]);

    // Fiat is the core of the screen — fail the request only if it's unavailable
    if (highlightsRes.status === "rejected") {
      const err = highlightsRes.reason;
      return res.status(err.statusCode || 503).json({ success: false, message: err.message });
    }

    const fiatMeta = highlightsRes.value.meta;

    return res.status(200).json({
      success: true,
      data: {
        highlights: highlightsRes.value.pairs,
        trends: trendsRes.status === "fulfilled" ? trendsRes.value : [],
        converter: {
          defaultFrom: CONVERTER_DEFAULT.from,
          defaultTo: CONVERTER_DEFAULT.to,
          currencies: { fiat: CONVERTER_FIAT, crypto: Object.values(CRYPTO_ASSETS) },
          ratesUpdatedAt: fiatMeta.fetchedAt,
        },
        fiat: {
          live: !fiatMeta.stale,
          pairs: listRes.status === "fulfilled" ? listRes.value.pairs : [],
        },
        crypto: {
          live: cryptoRes.status === "fulfilled" && !cryptoRes.value.meta.stale,
          assets: cryptoRes.status === "fulfilled" ? cryptoRes.value.assets : [],
          error: cryptoRes.status === "rejected" ? cryptoRes.reason.message : null,
        },
        meta: {
          fiatSource: fiatMeta.source, // live | cache | snapshot
          fiatProviderUpdatedAt: fiatMeta.providerUpdatedAt,
          fiatFetchedAt: fiatMeta.fetchedAt,
          cryptoFetchedAt: cryptoRes.value?.meta?.fetchedAt ?? null,
        },
      },
    });
  } catch (error) {
    console.error("❌ getRates error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch FX rates" });
  }
};

/**
 * POST /api/fx/convert
 * Body: { from: "NGN", to: "USD", amount: 5000 }
 */
export const convertCurrency = async (req, res) => {
  try {
    const { from, to } = req.body || {};
    const amount = Number(req.body?.amount);

    if (!from || !to || typeof from !== "string" || typeof to !== "string") {
      return res.status(400).json({ success: false, message: "'from' and 'to' currency codes are required" });
    }
    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ success: false, message: "'amount' must be a non-negative number" });
    }

    const data = await convert(from.trim(), to.trim(), amount);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status === 500) console.error("❌ convertCurrency error:", error);
    return res.status(status).json({ success: false, message: error.message || "Conversion failed" });
  }
};
