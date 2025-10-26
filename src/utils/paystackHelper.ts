import axios from "axios";

export async function initiateTransfer({
  amount,
  recipientCode,
  narration,
  country,
}: {
  amount: number; // in kobo
  recipientCode: string;
  narration: string;
  country: string; // to select the right Paystack key
}) {
  const secretKey = process.env[`PAYSTACK_SECRET_KEY_${country}`]; // e.g. PAYSTACK_SECRET_KEY_NG
  if (!secretKey) throw new Error("No Paystack key for country: " + country);

  const res = await axios.post(
    "https://api.paystack.co/transfer",
    {
      source: "balance",
      amount,
      recipient: recipientCode,
      reason: narration,
    },
    {
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  return res.data;
}

export async function createRecipient({
  name,
  accountNumber,
  bankCode,
  country,
}: {
  name: string;
  accountNumber: string;
  bankCode: string;
  country: string;
}) {
  const secretKey = process.env[`PAYSTACK_SECRET_KEY_${country}`];

  const res = await axios.post(
    "https://api.paystack.co/transferrecipient",
    {
      type: "nuban",
      name,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: "NGN",
    },
    {
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  return res.data.data.recipient_code;
}