import { Request, Response, NextFunction } from "express";
import User from "../models/User";
import { 
    initializeTransaction, 
    createCustomer, 
    verifyTransaction, 
    // createSubscription 
} from "../services/paystackService";
import { PLANS } from "../utils/data";
import { Document } from "mongoose"; // Import Document type

// --- Local Type Definitions to fix TypeScript errors (TS2339) ---
// Define the subscription structure as it's used in the User schema
interface ISubscription {
    planId: string | null;
    billingInterval: "monthly" | "annual" | null;
    status: "active" | "inactive" | "expired" | string;
    paystackSubscriptionId: string | null;
    paystackCustomerId: string | null;
    startedAt: Date | null;
    expiresAt: Date | null;
}




type UserWithSubscription = Document & {
    _id: any; // Explicitly define _id to resolve 'unknown' type access error
    subscription?: ISubscription;
    email: string; // Ensure required properties are known
    username: string;
    // Add other properties that are accessed outside of 'subscription' if needed
};
// --- End Type Definitions ---


/**
 * GET /plans
 * Return plan list (client uses this to render UI).
 */
export async function getPlans(req: Request, res: Response) {
  return res.json({ plans: PLANS });
}

/**
 * POST /checkout
 * Body: { userId, planId, billingInterval }
 * Returns: { authorization_url, reference } to redirect user to Paystack.
 */
export async function checkout(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, planId, billingInterval } = req.body as { 
      userId: string; 
      planId: string; 
      billingInterval: "monthly" | "annual"; 
    };

    if (!userId || !planId || !billingInterval) {
      return res.status(400).json({ error: "userId, planId and billingInterval are required" });
    }

    const plan = PLANS.find(p => p.id === planId);
    if (!plan) return res.status(400).json({ error: "Invalid planId" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // ✅ Handle free plan immediately
    if (planId === "free" || (plan.monthlyPrice === 0 && plan.annualPrice === 0)) {
      user.subscription = {
        planId,
        billingInterval,
        status: "active",
        startedAt: new Date(),
        expiresAt: null,
      } as any;
      await user.save();
      return res.json({ ok: true, message: "Upgraded to Free plan locally" });
    }

    // ✅ Pick the correct Paystack plan ID
    const selectedPaystackPlanId =
      billingInterval === "monthly"
        ? plan.paystackPlanMonthlyId
        : plan.paystackPlanAnnualId;

    if (!selectedPaystackPlanId) {
      return res.status(400).json({ error: "Paystack plan ID not configured for this interval" });
    }

    // Convert USD → NGN (fallback to 1500 if not set)
    const exchangeRate = Number(process.env.EXCHANGE_RATE_USD_TO_NGN || "1500");
    const chosenPriceUSD = billingInterval === "monthly" ? plan.monthlyPrice : plan.annualPrice;
    const amountInNgn = Math.round(chosenPriceUSD * exchangeRate);
    const amountInKobo = amountInNgn * 100;

    // ✅ Ensure Paystack customer
    let paystackCustomer = user.subscription?.paystackCustomerId || null;
    if (!paystackCustomer) {
      const creation = await createCustomer(user.email, user.username, "");
      paystackCustomer =
        creation.data.customer_code ||
        creation.data.code ||
        creation.data.id;

      if (!user.subscription) {
        user.subscription = {
          planId: "free",
          billingInterval: "monthly",
          status: "inactive",
          paystackSubscriptionId: null,
          paystackCustomerId: paystackCustomer,
          startedAt: null,
          expiresAt: null,
        };
      } else {
        user.subscription.paystackCustomerId = paystackCustomer;
      }

      await user.save();
    }

    // ✅ Initialize transaction
    const callback_url = `${process.env.APP_BASE_URL}/checkout/success`;
    const metadata = { 
      userId: user._id.toString(), 
      planId, 
      billingInterval, 
      paystackPlanId: selectedPaystackPlanId 
    };

    const init = await initializeTransaction(
      user.email,
      amountInKobo,
      callback_url,
      metadata
    );

    return res.json({ 
      authorization_url: init.data.authorization_url, 
      reference: init.data.reference,
      paystackPlanId: selectedPaystackPlanId, // helpful for client-side tracking
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /subscription/status/:userId
 * Polling helper for front-end to ask whether user subscription is active
 */
export async function subscriptionStatus(req: Request, res: Response) {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ error: "userId required" });
  
  // Cast the retrieved user document to the extended type
  const user = await User.findById(userId).lean() as (UserWithSubscription | null);
  if (!user) return res.status(404).json({ error: "User not found" });
  
  // Accessing subscription property is now valid
  return res.json({ subscription: user.subscription || null });
}

/**
 * POST /paystack/webhook
 * Receive webhook events from Paystack. IMPORTANT: configure webhook URL in Paystack dashboard.
 */
export async function paystackWebhook(req: Request, res: Response) {
  // Validate webhook signature if using Paystack's header signature (x-paystack-signature)
  try {
    const event = req.body;
    const eventName = event.status;

    // Example: handle successful transaction
    if (eventName === "success") {
      const { metadata } = event;
      const userId = metadata?.userId;
      const planId = metadata?.planId;
      const billingInterval = metadata?.billingInterval;

      if (userId) {
        // Cast the retrieved user document to the extended type
        const user = await User.findById(userId) as (UserWithSubscription | null);
        if (user) {
          // Accessing subscription property is now valid
          if (!user.subscription) {
            user.subscription = {
              billingInterval: billingInterval || "monthly",
              status: "active",
              planId: planId || null,
              paystackSubscriptionId: event.plan || event.plan_object.plan_code || null,
              paystackCustomerId: null,
              startedAt: new Date(),
              expiresAt: null,
            }; 
          } else {
            user.subscription.planId = planId;
            user.subscription.billingInterval = billingInterval;
            user.subscription.status = "active";
            user.subscription.paystackSubscriptionId = event.plan || event.data.subscription_code || user.subscription.paystackSubscriptionId;
            user.subscription.startedAt = new Date();
          }
          // Set expiresAt for annual/monthly when you can derive from Paystack details.
          await user.save();
        }
      }
    }

    // Handle subscription.create or invoice.success etc as needed for recurring.
    res.json({ status: "ok" });
  } catch (err) {
    console.error("Webhook handling error", err);
    res.status(500).send("error");
  }
}






export async function paystackCallback(req: Request, res: Response) {
  // Paystack might redirect with `reference` query param
  const { reference } = req.query;
  if (!reference) {
    return res.status(400).send("Missing reference");
  }

  try {
    const result = await verifyTransaction(String(reference));
    // Get metadata to know which user & plan
    const metadata = result.data?.metadata || {};
    const userId = metadata.userId;
    const planId = metadata.planId;
    const billingInterval = metadata.billingInterval;

    if (result.data.status === "success" && userId) {
      const user = await User.findById(userId);
      if (user) {
        user.subscription = {
        planId: planId || null,
        billingInterval: billingInterval || "monthly", // fallback
        status: "active",
        paystackSubscriptionId:
        result.data.subscription || user.subscription?.paystackSubscriptionId || null,
        paystackCustomerId: user.subscription?.paystackCustomerId || null,
        startedAt: new Date(),
        expiresAt: null, // you can compute this later
    };

        // You might set expiresAt based on plan duration
        await user.save();
      }
    }

    // Redirect to success page
    return res.redirect(`${process.env.APP_BASE_URL}/subscription/success?ref=${reference}`);
  } catch (err) {
    console.error("Paystack verify failed", err);
    return res.redirect(`${process.env.APP_BASE_URL}/subscription/failure`);
  }
}
