export const usageGuard = async (req, res, next) => {
    const user = await User.findById(req.user._id);

    // If they have a wallet, they are "Elite" - no limits
    if (user.walletId) return next();

    // Check if the lockout flag is already true
    if (user.usageMetrics.isFeatureLocked) {
        return res.status(403).json({
            status: "failed",
            hasReachedLimit: true, // Frontend triggers Wallet Modal here
            message: "Limit reached. Create a Zorah Wallet to unlock unlimited access."
        });
    }

    next();
};