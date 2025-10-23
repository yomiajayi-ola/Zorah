import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";

export const debitWallet = async (userId, amount, purpose, reference) => {
    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet || wallet.balance < amount) {
      throw new Error("Insufficient wallet balance");
    }
  
    wallet.balance -= amount;
    await wallet.save();
  
    await Transaction.create({
      user: userId,
      type: "debit",
      purpose, // 'savings_deposit' or 'esusu_contribution'
      amount,
      reference,
    });
  };
  