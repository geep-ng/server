import Transaction from "../models/Transaction";

// Helper function to validate transaction data
export const validateTransactionData = (data: any) => {
    const { userId, sender, receiver, amount, sendingCurrency, receivingCurrency } = data;
    if (!userId || !sender || !receiver || !amount || !sendingCurrency || !receivingCurrency) {
        throw new Error('Missing required transaction fields.');
    }
};



export async function createTransactionFromWebhook(metadata: any, reference: string) {
  return Transaction.create({
    userId: metadata.userId,
    sourceCountry: metadata.sourceCountry,
    destinationCountry: metadata.destinationCountry,
    sourceCurrency: metadata.currency,
    receivingCurrency: metadata.receivingCurrency,
    amountSent: parseFloat(metadata.amount),
    amountReceived: parseFloat(metadata.amountToReceive),
    reference,
    status: "charged",
    receiverName: metadata.receiverName,
    receiverEmail: metadata.receiverEmail,
    receiverPhone: metadata.receiverPhone,
    bankCode: metadata.bankCode,
    accountNumber: metadata.accountNumber,
    narration: metadata.narration,
    exchangeRate: parseFloat(metadata.exchangeRate),
    markedUpRate: parseFloat(metadata.markedUpRate),
  });
}

export async function updateTransactionStatus(reference: string, status: string) {
  return Transaction.findOneAndUpdate({ reference }, { status }, { new: true });
}