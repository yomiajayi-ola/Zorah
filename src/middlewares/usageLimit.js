export const checkUsageLimit = async (req, res, next) => {
    const user = await User.findById(req.user._id);

    // If user has a wallet, skip limits
    if (user.walletId) return next();

    // Logic for AI Assistant (e.g., limit to 2 sessions)
    if (req.originalUrl.includes('/ai-assistant') && user.usageMetrics.aiSessionsCount >= 2) {
        return res.status(403).json({ 
            hasReachedLimit: true, 
            message: "You've reached your free AI limit. Create a Zorah Wallet to continue!" 
        });
    }

    next();
};