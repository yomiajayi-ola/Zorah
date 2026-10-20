import mongoose from "mongoose";

/**
 * Daily snapshot of fiat FX rates (USD base) from ExchangeRate-API.
 * Used for: 24hr change, 7-day "Rates Trends" chart, and fallback when the provider is unreachable.
 * One document per UTC day (upserted on every successful fetch).
 */
const fxRateSnapshotSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true }, // YYYY-MM-DD (UTC)
    base: { type: String, default: "USD" },
    rates: { type: Map, of: Number, required: true },
    providerUpdatedAt: { type: Date },
    fetchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.models.FxRateSnapshot || mongoose.model("FxRateSnapshot", fxRateSnapshotSchema);
