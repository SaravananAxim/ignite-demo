import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const emitSignupEventOnce = async ({
  supabase,
  franchiseeId,
  eventName,
  activityAction,
}: {
  supabase: ReturnType<typeof createClient>;
  franchiseeId: string;
  eventName: "signup.payment_completed";
  activityAction: string;
}) => {
  const { data: existingLog, error: existingLogError } = await supabase
    .from("activity_logs")
    .select("id")
    .eq("target_type", "franchisee")
    .eq("target_id", franchiseeId)
    .eq("action", activityAction)
    .limit(1)
    .maybeSingle();

  if (existingLogError) {
    throw existingLogError;
  }

  if (existingLog) {
    console.log(`Skipping duplicate ${eventName} for franchisee ${franchiseeId}`);
    return;
  }

  const { data: webhookResult, error: webhookInvokeError } = await supabase.functions.invoke("send-signup-webhook", {
    body: {
      franchiseeId,
      event: eventName,
    },
  });

  if (webhookInvokeError) {
    throw webhookInvokeError;
  }

  if (webhookResult?.success === false) {
    throw new Error(webhookResult.error || `Failed to emit ${eventName}`);
  }

  await supabase.from("activity_logs").insert({
    action: activityAction,
    target_type: "franchisee",
    target_id: franchiseeId,
    user_email: "system",
    details: {
      event: eventName,
      emitted_at: new Date().toISOString(),
    },
  });
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    // For now, we'll process without signature verification
    // In production, add STRIPE_WEBHOOK_SECRET and verify
    let event: Stripe.Event;

    try {
      event = JSON.parse(body) as Stripe.Event;
      console.log("Received Stripe webhook event:", event.type);
    } catch (err) {
      console.error("Error parsing webhook body:", err);
      return new Response("Invalid payload", { status: 400 });
    }

    // Handle different event types
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("Checkout session completed:", session.id);

        const franchiseeId = session.metadata?.franchisee_id;
        if (franchiseeId) {
          const customerName = session.customer_details?.name;

          // Update franchisee with payment authorized status and real name if available
          const franchiseeUpdate: Record<string, unknown> = {
            payment_status: "authorized",
            status: "active",
            stripe_subscription_id: session.subscription as string,
          };
          if (customerName) {
            franchiseeUpdate.name = customerName;
          }

          const { error } = await supabase
            .from("franchisees")
            .update(franchiseeUpdate)
            .eq("id", franchiseeId);

          // Also update the Stripe customer name so it shows correctly in the dashboard
          if (customerName && session.customer) {
            try {
              await stripe.customers.update(session.customer as string, { name: customerName });
              console.log("Updated Stripe customer name:", customerName);
            } catch (stripeErr) {
              console.error("Failed to update Stripe customer name:", stripeErr);
            }
          }

          if (error) {
            console.error("Error updating franchisee:", error);
          } else {
            console.log("Franchisee updated to active:", franchiseeId);
          }

          const { data: franchiseeRow } = await supabase
            .from("franchisees")
            .select("onboarding_step")
            .eq("id", franchiseeId)
            .maybeSingle();

          const onboardingStep = franchiseeRow?.onboarding_step || null;
          const onboardingStarted = onboardingStep !== null && onboardingStep !== "payment";

          if (onboardingStarted) {
            try {
              await emitSignupEventOnce({
                supabase,
                franchiseeId,
                eventName: "signup.payment_completed",
                activityAction: "webhook_signup_payment_completed_sent",
              });
            } catch (emitError) {
              console.error("Failed emitting signup.payment_completed:", emitError);
            }
          }

          // Log activity
          await supabase.from("activity_logs").insert({
            action: "payment_authorized",
            target_type: "franchisee",
            target_id: franchiseeId,
            user_email: session.customer_email || "system",
            details: {
              session_id: session.id,
              subscription_id: session.subscription,
              amount_total: session.amount_total,
            },
          });
        }
        break;
      }

      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log("Subscription created:", subscription.id);
        
        const franchiseeId = subscription.metadata?.franchisee_id;
        if (franchiseeId) {
          await supabase
            .from("franchisees")
            .update({
              stripe_subscription_id: subscription.id,
              trial_ends_at: subscription.trial_end 
                ? new Date(subscription.trial_end * 1000).toISOString()
                : null,
            })
            .eq("id", franchiseeId);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log("Subscription updated:", subscription.id, "Status:", subscription.status);
        
        // Find franchisee by subscription ID
        const { data: franchisees } = await supabase
          .from("franchisees")
          .select("id")
          .eq("stripe_subscription_id", subscription.id)
          .limit(1);

        if (franchisees && franchisees.length > 0) {
          const franchiseeId = franchisees[0].id;
          
          let status = "active";
          let paymentStatus = "authorized";

          if (subscription.status === "canceled") {
            status = "cancelled";
            paymentStatus = "cancelled";
          } else if (subscription.status === "past_due") {
            paymentStatus = "past_due";
          } else if (subscription.status === "trialing") {
            paymentStatus = "trialing";
          } else if (subscription.status === "active") {
            paymentStatus = "paid";
          }

          await supabase
            .from("franchisees")
            .update({
              status,
              payment_status: paymentStatus,
              trial_ends_at: subscription.trial_end 
                ? new Date(subscription.trial_end * 1000).toISOString()
                : null,
            })
            .eq("id", franchiseeId);

          console.log("Updated franchisee status:", franchiseeId, status, paymentStatus);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log("Subscription deleted:", subscription.id);
        
        const { data: franchisees } = await supabase
          .from("franchisees")
          .select("id")
          .eq("stripe_subscription_id", subscription.id)
          .limit(1);

        if (franchisees && franchisees.length > 0) {
          await supabase
            .from("franchisees")
            .update({
              status: "cancelled",
              payment_status: "cancelled",
            })
            .eq("id", franchisees[0].id);

          console.log("Marked franchisee as cancelled:", franchisees[0].id);
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log("Invoice paid:", invoice.id);
        
        if (invoice.subscription) {
          const { data: franchisees } = await supabase
            .from("franchisees")
            .select("id")
            .eq("stripe_subscription_id", invoice.subscription as string)
            .limit(1);

          if (franchisees && franchisees.length > 0) {
            await supabase
              .from("franchisees")
              .update({ payment_status: "paid" })
              .eq("id", franchisees[0].id);

            // Log payment activity
            await supabase.from("activity_logs").insert({
              action: "payment_received",
              target_type: "franchisee",
              target_id: franchisees[0].id,
              user_email: invoice.customer_email || "system",
              details: {
                invoice_id: invoice.id,
                amount_paid: invoice.amount_paid,
                currency: invoice.currency,
              },
            });

            console.log("Marked franchisee as paid:", franchisees[0].id);
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log("Invoice payment failed:", invoice.id);
        
        if (invoice.subscription) {
          const { data: franchisees } = await supabase
            .from("franchisees")
            .select("id")
            .eq("stripe_subscription_id", invoice.subscription as string)
            .limit(1);

          if (franchisees && franchisees.length > 0) {
            await supabase
              .from("franchisees")
              .update({ payment_status: "failed" })
              .eq("id", franchisees[0].id);

            console.log("Marked franchisee payment as failed:", franchisees[0].id);
          }
        }
        break;
      }

      default:
        console.log("Unhandled event type:", event.type);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Webhook error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
