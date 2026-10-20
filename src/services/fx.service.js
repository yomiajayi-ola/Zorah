import axios from "axios";
import FxRateSnapshot from "../models/FxRateSnapshot.js";

/**
 * FX Service — data for the "FX Rate" screen (Figma: Mobile Screen › FX Market).
 *
 * Fiat:   ExchangeRate-API open endpoint (USD base, provider refreshes daily)
 * Crypto: CoinGecko public /coins/markets
 *
 * Caching: in-memory TTL (fiat 30 min, crypto 15 min) + daily MongoDB snapshot.
 * Fallback order on provider failure: memory cache → latest MongoDB snapshot → error.
 */

const FIAT_URL = "https://open.er-api.com/v6/latest/USD";
const CRYPTO_URL = "https://api.coingecko.com/api/v3/coins/markets";

const FIAT_TTL_MS = 30 * 60 * 1000;
const CRYPTO_TTL_MS = 15 * 60 * 1000;

// ---- Screen config (mirrors Figma) ----

// Top carousel cards: "USD/NGN ₦1,456.00 +2.5% 24hr change"
export const HIGHLIGHT_PAIRS = ["USD/NGN", "GBP/NGN", "EUR/NGN"];

// "Rates Trends" chart tabs (7 daily points, Mon–Sun)
export const TREND_PAIRS = ["USD/NGN", "GBP/NGN", "EUR/NGN"];
export const TREND_DAYS = 7;

// "FX Rates › Fiat Currency" list
export const FIAT_LIST_PAIRS = ["CAD/NGN", "USD/CAD", "GBP/JPY", "EUR/CAD", "USD/AUD", "AUD/NGN"];

// "Currency Converter" defaults + selectable currencies
export const CONVERTER_DEFAULT = { from: "NGN", to: "USD" };
export const CONVERTER_FIAT = ["NGN", "USD", "GBP", "EUR", "CAD", "AUD", "JPY"];

// "Crypto" tab — CoinGecko id -> symbol
export const CRYPTO_ASSETS = {
  bitcoin: "BTC",
  ethereum: "ETH",
  tether: "USDT",
  "usd-coin": "USDC",
  binancecoin: "BNB",
  solana: "SOL",
};

// ---- In-memory cache ----

const cache = {
  fiat: { data: null, expiresAt: 0, pending: null },
  crypto: { data: null, expiresAt: 0, pending: null },
};

const withCache = async (key, ttl, fetcher, fallback) => {
  const entry = cache[key];
  if (entry.data && Date.now() < entry.expiresAt) return { ...entry.data, source: "cache", stale: false };
  if (entry.pending) return entry.pending;

  entry.pending = (async () => {
    try {
      const data = await fetcher();
      entry.data = data;
      entry.expiresAt = Date.now() + ttl;
      return { ...data, source: "live", stale: false };
    } catch (err) {
      console.error(`❌ FX ${key} fetch failed:`, err.message);
      if (entry.data) return { ...entry.data, source: "cache", stale: true };
      const fb = fallback ? await fallback().catch(() => null) : null;
      if (fb) {
        entry.data = fb; // short retry window so we don't hammer a failing provider
        entry.expiresAt = Date.now() + 60 * 1000;
        return { ...fb, source: "snapshot", stale: true };
      }
      throw codeError(`Unable to fetch ${key} rates at the moment`, 503);
    } finally {
      entry.pending = null;
    }
  })();

  return entry.pending;
};

// ---- Fiat ----

const todayKey = (d = new Date()) => d.toISOString().slice(0, 10);

export const getFiatRates = () =>
  withCache(
    "fiat",
    FIAT_TTL_MS,
    async () => {
      const { data } = await axios.get(FIAT_URL, { timeout: 10000 });
      if (data?.result !== "success" || !data?.rates) {
        throw new Error(data?.["error-type"] || "Invalid response from ExchangeRate-API");
      }
      const result = {
        rates: data.rates,
        providerUpdatedAt: data.time_last_update_utc ? new Date(data.time_last_update_utc).toISOString() : null,
        fetchedAt: new Date().toISOString(),
      };
      // Persist daily snapshot (runs at most once per TTL; failure doesn't block the response)
      await FxRateSnapshot.updateOne(
        { date: todayKey() },
        { $set: { rates: data.rates, providerUpdatedAt: result.providerUpdatedAt, fetchedAt: new Date() } },
        { upsert: true }
      ).catch((e) => console.error("⚠️ FX snapshot save failed:", e.message));
      return result;
    },
    async () => {
      const snap = await FxRateSnapshot.findOne().sort({ date: -1 }).lean();
      if (!snap) return null;
      return {
        rates: snap.rates,
        providerUpdatedAt: snap.providerUpdatedAt?.toISOString() ?? null,
        fetchedAt: snap.fetchedAt?.toISOString() ?? null,
      };
    }
  );

/** Rate of 1 `base` in `quote` from a USD-based rates map. */
const pairRate = (rates, base, quote) => {
  const b = rates[base];
  const q = rates[quote];
  if (!b || !q) return null;
  return q / b;
};

const splitPair = (pair) => pair.toUpperCase().split("/");

/** Snapshot from the most recent day before today (for 24hr change). */
const getPreviousSnapshot = async () =>
  FxRateSnapshot.findOne({ date: { $lt: todayKey() } }).sort({ date: -1 }).lean();

const pctChange = (current, previous) =>
  current != null && previous ? round(((current - previous) / previous) * 100, 2) : null;

/** Build a pair row: { pair, symbol, base, quote, rate, change24h } */
const buildPair = (pair, rates, prevRates) => {
  const [base, quote] = splitPair(pair);
  const rate = pairRate(rates, base, quote);
  const prev = prevRates ? pairRate(prevRates, base, quote) : null;
  return {
    pair: `${base}/${quote}`,
    symbol: `${base}${quote}`,
    base,
    quote,
    rate: round(rate, rate != null && rate < 10 ? 5 : 2),
    change24h: pctChange(rate, prev),
  };
};

export const getFiatPairs = async (pairs) => {
  const fiat = await getFiatRates();
  const prevSnap = await getPreviousSnapshot().catch(() => null);
  const prevRates = prevSnap?.rates ?? null;
  return {
    pairs: pairs.map((p) => buildPair(p, fiat.rates, prevRates)).filter((p) => p.rate != null),
    meta: fiat,
  };
};

/** Daily series for a pair over the last `days` snapshots: [{ date, day, rate }] */
export const getTrend = async (pair, days = TREND_DAYS) => {
  const [base, quote] = splitPair(pair);
  await getFiatRates(); // ensures today's snapshot is persisted before reading history
  const snaps = await FxRateSnapshot.find().sort({ date: -1 }).limit(days).lean();
  const points = snaps
    .reverse()
    .map((s) => {
      const rate = pairRate(s.rates, base, quote);
      return rate == null
        ? null
        : {
            date: s.date,
            day: new Date(`${s.date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
            rate: round(rate, 2),
          };
    })
    .filter(Boolean);
  const values = points.map((p) => p.rate);
  return {
    pair: `${base}/${quote}`,
    points,
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
  };
};

// ---- Crypto ----

export const getCryptoMarkets = () =>
  withCache("crypto", CRYPTO_TTL_MS, async () => {
    const { data } = await axios.get(CRYPTO_URL, {
      timeout: 10000,
      params: {
        vs_currency: "usd",
        ids: Object.keys(CRYPTO_ASSETS).join(","),
        price_change_percentage: "24h",
      },
      headers: process.env.COINGECKO_API_KEY ? { "x-cg-demo-api-key": process.env.COINGECKO_API_KEY } : undefined,
    });
    if (!Array.isArray(data)) throw new Error("Invalid response from CoinGecko");

    const assets = Object.entries(CRYPTO_ASSETS)
      .map(([id, symbol]) => {
        const c = data.find((x) => x.id === id);
        if (!c) return null;
        return {
          id,
          symbol,
          name: c.name,
          image: c.image,
          priceUsd: c.current_price,
          change24h: c.price_change_percentage_24h != null ? round(c.price_change_percentage_24h, 2) : null,
          high24hUsd: c.high_24h,
          low24hUsd: c.low_24h,
          lastUpdatedAt: c.last_updated,
        };
      })
      .filter(Boolean);

    return { assets, fetchedAt: new Date().toISOString() };
  });

/** Crypto assets with NGN prices derived from the fiat USD/NGN rate. */
export const getCryptoList = async () => {
  const [crypto, fiat] = await Promise.all([getCryptoMarkets(), getFiatRates()]);
  const ngnPerUsd = fiat.rates.NGN;
  return {
    assets: crypto.assets.map((a) => ({
      ...a,
      pair: `${a.symbol}/NGN`,
      priceNgn: round(a.priceUsd * ngnPerUsd, 2),
    })),
    meta: crypto,
  };
};

// ---- Conversion ----

export const isCrypto = (sym) => Object.values(CRYPTO_ASSETS).includes(String(sym).toUpperCase());

const usdValueOf = async (symbol, fiatRates) => {
  if (symbol === "USD") return 1;
  if (isCrypto(symbol)) {
    const { assets } = await getCryptoMarkets();
    const a = assets.find((x) => x.symbol === symbol);
    if (!a?.priceUsd) throw codeError(`Price unavailable for ${symbol}`, 503);
    return a.priceUsd;
  }
  const r = fiatRates[symbol];
  if (!r) throw codeError(`Unsupported currency: ${symbol}`, 400);
  return 1 / r;
};

/**
 * Converter payload: { fromCurrency, toCurrency, inputAmount, outputAmount, appliedRate, inverseRate, ratesUpdatedAt }
 * No fee/spread — none is shown in the Figma converter.
 */
export const convert = async (from, to, amount) => {
  const fromCurrency = String(from).toUpperCase();
  const toCurrency = String(to).toUpperCase();
  const fiat = await getFiatRates();

  const appliedRate =
    fromCurrency === toCurrency
      ? 1
      : (await usdValueOf(fromCurrency, fiat.rates)) / (await usdValueOf(toCurrency, fiat.rates));

  const usesCrypto = isCrypto(fromCurrency) || isCrypto(toCurrency);
  const ratesUpdatedAt = usesCrypto ? cache.crypto.data?.fetchedAt ?? fiat.fetchedAt : fiat.fetchedAt;

  return {
    fromCurrency,
    toCurrency,
    inputAmount: amount,
    outputAmount: round(amount * appliedRate, isCrypto(toCurrency) ? 8 : 2),
    appliedRate: sig(appliedRate),
    inverseRate: appliedRate ? sig(1 / appliedRate) : null,
    ratesUpdatedAt,
    stale: !!fiat.stale,
  };
};

// ---- helpers ----

const codeError = (message, statusCode) => Object.assign(new Error(message), { statusCode });

export const round = (n, dp = 4) => (n == null || !Number.isFinite(n) ? null : Math.round(n * 10 ** dp) / 10 ** dp);

// Round to significant digits (keeps precision for tiny rates like NGN→BTC)
const sig = (n, digits = 10) => (n == null || !Number.isFinite(n) ? null : Number(n.toPrecision(digits)));
