import express from "express";
import { getPlans, checkout, subscriptionStatus, paystackWebhook } from "../controller/subscription.controller";

const router = express.Router();

router.get("/plans", getPlans);
router.post("/checkout", checkout);
router.get("/subscription/status/:userId", subscriptionStatus);

// Paystack will POST events here, ensure the endpoint is public and set the webhook secret in Paystack dashboard if used.
router.post("/paystack/webhook", express.json({ type: "*/*" }), paystackWebhook);

export default router;