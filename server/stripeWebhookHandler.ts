import { Request, Response } from "express";
import Stripe from "stripe";
import { stripe } from "./stripe";
import { db } from "./db";
import { orders, cartItems } from "@shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "./storage";

// Stripe Webhook Secret (from environment variables)
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"];

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig as string,
      stripeWebhookSecret as string,
    );
  } catch (err: any) {
    console.error(`⚠️ Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Immediately respond to Stripe to acknowledge receipt of the event
  // This prevents Stripe from retrying the webhook multiple times
  res.json({ received: true });

  try {
    // Log all webhook events for debugging
    console.log(`[Webhook] Received event type: ${event.type}`);

    if (event.type === "checkout.session.completed") {
      await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
    } else if (event.type === "payment_intent.succeeded") {
      await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
    } else if (event.type === "payment_intent.payment_failed") {
      await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
    } else {
      console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error(`[Webhook ERROR] Failed to process webhook:`, error);
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log(`[Webhook] Processing checkout.session.completed: ${session.id}`);
  console.log(`[Webhook] Session metadata:`, session.metadata);
  console.log(`[Webhook] Payment status: ${session.payment_status}`);
  
  if (session.payment_status !== "paid") {
    console.log(`[Webhook] Payment not yet paid, status: ${session.payment_status}`);
    return;
  }

  // Try to get order ID from metadata
  const orderId = session.metadata?.order_id;
  const userId = session.metadata?.userId;

  if (!orderId) {
    console.error(`[Webhook ERROR] No order_id found in session metadata`);
    return;
  }

  try {
    console.log(`[Webhook] Looking for order with ID: ${orderId}`);
    
    // First try Drizzle ORM query
    let orderToUpdate = await db.query.orders.findFirst({
      where: eq(orders.id, parseInt(orderId)),
    });

    // If order not found with Drizzle, try the storage interface
    if (!orderToUpdate) {
      console.log(`[Webhook] Order not found with Drizzle, trying storage interface`);
      orderToUpdate = await storage.getOrder(parseInt(orderId));
    }

    if (orderToUpdate) {
      console.log(`[Webhook] Found order #${orderId}, current status: ${orderToUpdate.status}`);
      
      // Update order status
      await db
        .update(orders)
        .set({
          status: "completed",
          paymentStatus: "paid",
          updatedAt: new Date(),
        })
        .where(eq(orders.id, parseInt(orderId)));
      
      console.log(`[Webhook] Order #${orderId} updated to 'completed' status`);
      
      // Update with payment intent if available
      if (session.payment_intent && typeof session.payment_intent !== 'string') {
        await db
          .update(orders)
          .set({
            paymentIntentId: session.payment_intent.id,
          })
          .where(eq(orders.id, parseInt(orderId)));
        
        console.log(`[Webhook] Added payment intent ID: ${session.payment_intent.id}`);
      }
      
      // Clear cart if userId is available
      if (userId) {
        try {
          console.log(`[Webhook] Clearing cart for user #${userId}`);
          await db
            .delete(cartItems)
            .where(eq(cartItems.userId, parseInt(userId)));
          console.log(`[Webhook] Cart cleared for user #${userId}`);
        } catch (cartError) {
          console.error(`[Webhook] Error clearing cart:`, cartError);
        }
      }
      
      console.log(`[Webhook] Successfully processed order #${orderId}`);
    } else {
      console.error(`[Webhook ERROR] Order #${orderId} not found`);
      
      // Get detailed session info for debugging
      try {
        const detailedSession = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ['line_items', 'customer', 'payment_intent']
        });
        
        console.log(`[Webhook] Detailed session info:`, {
          id: detailedSession.id,
          customerId: detailedSession.customer,
          customerEmail: detailedSession.customer_details?.email,
          amount: detailedSession.amount_total,
          metadata: detailedSession.metadata,
          lineItems: detailedSession.line_items?.data?.length || 0
        });
      } catch (sessionError) {
        console.error(`[Webhook] Failed to retrieve detailed session:`, sessionError);
      }
    }
  } catch (error) {
    console.error(`[Webhook ERROR] Failed to process checkout session:`, error);
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log(`[Webhook] PaymentIntent ${paymentIntent.id} succeeded`);
  
  // Add additional handling if needed, but checkout.session.completed
  // usually handles the order update
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log(`[Webhook] PaymentIntent ${paymentIntent.id} failed`);
  
  // Handle failed payment if you need to update an order
  const orderId = paymentIntent.metadata?.order_id;
  
  if (orderId) {
    try {
      await db
        .update(orders)
        .set({
          status: "failed",
          paymentStatus: "failed",
          updatedAt: new Date(),
        })
        .where(eq(orders.id, parseInt(orderId)));
      
      console.log(`[Webhook] Order #${orderId} marked as failed`);
    } catch (error) {
      console.error(`[Webhook] Error updating order after payment failure:`, error);
    }
  }
}
