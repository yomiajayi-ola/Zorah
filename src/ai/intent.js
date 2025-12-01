export function detectIntent(text) {
    text = text.toLowerCase();

    if (text.includes("spend") || text.includes("spent") || text.includes("expenses"))
        return "spending-summary";

    if (text.includes("budget") || text.includes("limit"))
        return "budget-analysis";

    if (text.includes("save") || text.includes("savings"))
        return "savings-goal";

    if (text.includes("income") || text.includes("salary"))
        return "income-summary";

    return "general-advice";
}
