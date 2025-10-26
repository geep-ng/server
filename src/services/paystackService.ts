import axios from "axios";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || "";
if (!PAYSTACK_SECRET) {
  console.warn("PAYSTACK_SECRET not set — Paystack endpoints will fail");
}

const client = axios.create({
  baseURL: "https://api.paystack.co",
  headers: {
    Authorization: `Bearer ${PAYSTACK_SECRET}`,
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

export async function initializeTransaction(email: string, amountInNaira: number, callback_url?: string, metadata?: any) {
  // Paystack expects amount in the smallest currency unit (kobo) for NGN.
  // If using USD, configure Paystack accordingly. Here we assume NGN base. If you charge in NGN,
  // make sure you convert from USD price to NGN before calling this.
  const response = await client.post("/transaction/initialize", {
    email,
    amount: amountInNaira,
    plan: metadata?.paystackPlanId || undefined,
    // currency: "USD",
    callback_url,
    metadata,
  });
  return response.data;
}

export async function createCustomer(email: string, first_name?: string, last_name?: string) {
  const resp = await client.post("/customer", { email, first_name, last_name });
  return resp.data;
}

export async function verifyTransaction(reference: string) {
  const resp = await client.get(`/transaction/verify/${encodeURIComponent(reference)}`);
  return resp.data;
}

/**
 * Optionally: create plan and subscription endpoints.
 * If you already created Paystack plans via dashboard, store the plan ids in env.
 */
export async function createPaystackPlan(name: string, amount: number, interval: "monthly" | "annual") {
  // amount should be in kobo (NGN) or smallest unit
  const resp = await client.post("/plan", {
    name,
    amount,
    interval: interval === "monthly" ? "monthly" : "yearly",
  });
  return resp.data;
}

export async function createSubscription(customer_code: string, plan: string) {
  // plan here is paystack plan code
  const resp = await client.post("/subscription", {
    customer: customer_code,
    plan,
  });
  return resp.data;
}