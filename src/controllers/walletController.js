import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";
import { v4 as uuidv4 } from "uuid";

// Create or get wallet for authenticated user 
export const getOrCreateWallet = async (req, res) => {
    try {
        let wallet = await Wallet.findOne({ user: req.user.id });

        if (!wallet) {
            wallet = await Wallet.create({ user: req.user.id });
        }

        return res.status(200).json({ success: true, wallet });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message })
    }
};

// Deposit funds 
export const depositFunds = async (req, res) => {
    const { amount } = req.body;
    if(!amount || amount <= 0)
        return res.status(400).json({ success: false, messsage: "Invalid amount" });

    try {
        const wallet = await Wallet.findOne({ user: req.user.id });
        if (!wallet) return res.status(404).json({ message: "Wallet not found" });

        const reference = uuidv4();

        const transaction = await Transaction.create({
            user: req.user.id,
            type: "credit",
            amount,
            purpose: "deposit",
            reference,
            status: "successful",
        });

        wallet.balance += amount;
        wallet.lastTransaction = new Date();
        await wallet.save();

        return res.status(200).json({
            success: true,
            message: "Deposit successfuly",
            wallet,
            transaction,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message})
    }
};