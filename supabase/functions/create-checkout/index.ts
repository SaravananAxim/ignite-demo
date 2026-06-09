import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      console.error("STRIPE_SECRET_KEY not configured");
      throw new Error("Stripe is not configured");
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { franchiseeId, successUrl, cancelUrl, effectiveDate } = await req.json();

    console.log("Creating checkout for franchisee:", franchiseeId);
    console.log("Effective date:", effectiveDate);

    if (!franchiseeId) {
      throw new Error("franchiseeId is required");
    }

    if (!effectiveDate) {
      throw new Error("effectiveDate is required");
    }

    // Parse the effective date
    const billingStartDate = new Date(effectiveDate);
    const billingCycleAnchor = Math.floor(billingStartDate.getTime() / 1000);

    console.log("Billing cycle anchor:", new Date(billingCycleAnchor * 1000).toISOString());

    // Fetch franchisee with plan details
    const { data: franchisee, error: franchiseeError } = await supabase
      .from("franchisees")
      .select(`
        *,
        plans (
          id,
          name,
          monthly_price,
          stripe_price_id,
          stripe_price_id_with_media,
          setup_fee,
          trial_days,
          billing_anchor_day
        )
      `)
      .eq("id", franchiseeId)
      .single();

    if (franchiseeError || !franchisee) {
      console.error("Franchisee fetch error:", franchiseeError);
      throw new Error("Franchisee not found");
    }

    console.log("Found franchisee:", franchisee.email, "Plan:", franchisee.plans?.name);

    const plan = franchisee.plans;
    if (!plan) {
      throw new Error("No plan associated with franchisee");
    }

    // Determine which price ID to use based on paid media selection
    const priceId = franchisee.include_paid_media 
      ? plan.stripe_price_id_with_media 
      : plan.stripe_price_id;

    if (!priceId) {
      console.error("No Stripe price ID configured for plan:", plan.id);
      throw new Error("Stripe price not configured for this plan");
    }

    // Check if customer already exists
    let customerId = franchisee.stripe_customer_id;

    if (!customerId) {
      // Create new Stripe customer
      console.log("Creating new Stripe customer for:", franchisee.email);
      
      const customer = await stripe.customers.create({
        email: franchisee.email,
        name: franchisee.name,
        phone: franchisee.phone || undefined,
        address: franchisee.address ? {
          line1: franchisee.address,
        } : undefined,
        metadata: {
          franchisee_id: franchisee.id,
          plan_id: plan.id,
        },
      });

      customerId = customer.id;

      // Update franchisee with Stripe customer ID
      await supabase
        .from("franchisees")
        .update({ stripe_customer_id: customerId })
        .eq("id", franchiseeId);

      console.log("Created Stripe customer:", customerId);
    }

    // Build line items for subscription
    const subscriptionLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price: priceId,
        quantity: 1,
      },
    ];

    // Check if there's a setup fee (one-time charge)
    const setupFee = plan.setup_fee ? Number(plan.setup_fee) : 0;
    
    // Determine checkout mode and line items
    // If there's a setup fee, we need to use subscription mode with a trial
    // and add the setup fee as a separate one-time item
    
    let checkoutConfig: Stripe.Checkout.SessionCreateParams;

    if (setupFee > 0) {
      // Create a checkout with subscription + one-time setup fee
      // The subscription will have a trial until the effective date
      // The setup fee is charged immediately
      
      const now = Math.floor(Date.now() / 1000);
      const trialEnd = billingCycleAnchor;
      
      // Ensure trial_end is at least 48 hours in the future (Stripe requirement)
      const minTrialEnd = now + (48 * 60 * 60);
      const actualTrialEnd = Math.max(trialEnd, minTrialEnd);

      console.log("Creating checkout with setup fee:", setupFee);
      console.log("Trial ends:", new Date(actualTrialEnd * 1000).toISOString());

      checkoutConfig = {
        customer: customerId,
        customer_update: { name: 'auto' },
        mode: "subscription",
        payment_method_types: ["card"],
        allow_promotion_codes: true,
        line_items: [
          // Subscription item
          {
            price: priceId,
            quantity: 1,
          },
          // One-time setup fee
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "One-Time Setup Fee",
                description: "Account setup and onboarding fee",
              },
              unit_amount: Math.round(setupFee * 100),
            },
            quantity: 1,
          },
        ],
        subscription_data: {
          trial_end: actualTrialEnd,
          metadata: {
            franchisee_id: franchiseeId,
            plan_id: plan.id,
            include_paid_media: String(franchisee.include_paid_media),
            effective_date: effectiveDate,
          },
        },
        success_url: successUrl || `${req.headers.get("origin")}/payment-confirmation?franchisee_id=${franchiseeId}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${req.headers.get("origin")}/payment-processing?franchisee_id=${franchiseeId}&canceled=true`,
        metadata: {
          franchisee_id: franchiseeId,
          effective_date: effectiveDate,
        },
      };
    } else {
      // No setup fee - just subscription with trial until effective date
      const now = Math.floor(Date.now() / 1000);
      const trialEnd = billingCycleAnchor;
      
      // Ensure trial_end is at least 48 hours in the future (Stripe requirement)
      const minTrialEnd = now + (48 * 60 * 60);
      const actualTrialEnd = Math.max(trialEnd, minTrialEnd);

      console.log("Creating subscription-only checkout");
      console.log("Trial ends:", new Date(actualTrialEnd * 1000).toISOString());

      checkoutConfig = {
        customer: customerId,
        customer_update: { name: 'auto' },
        mode: "subscription",
        payment_method_types: ["card"],
        allow_promotion_codes: true,
        line_items: subscriptionLineItems,
        subscription_data: {
          trial_end: actualTrialEnd,
          metadata: {
            franchisee_id: franchiseeId,
            plan_id: plan.id,
            include_paid_media: String(franchisee.include_paid_media),
            effective_date: effectiveDate,
          },
        },
        success_url: successUrl || `${req.headers.get("origin")}/payment-confirmation?franchisee_id=${franchiseeId}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${req.headers.get("origin")}/payment-processing?franchisee_id=${franchiseeId}&canceled=true`,
        metadata: {
          franchisee_id: franchiseeId,
          effective_date: effectiveDate,
        },
      };
    }

    // Create checkout session
    console.log("Creating Stripe checkout session...");
    const session = await stripe.checkout.sessions.create(checkoutConfig);

    console.log("Checkout session created:", session.id);

    // Update franchisee with service start date and payment status
    // Set onboarding_step to 'intake' so they proceed to the form after payment
    const { error: updateError } = await supabase
      .from("franchisees")
      .update({
        payment_status: "pending_checkout",
        service_start_date: effectiveDate.split('T')[0], // Store just the date part
        onboarding_step: "intake", // Move them to intake step for after checkout
      })
      .eq("id", franchiseeId);

    if (updateError) {
      console.error("Error updating franchisee with service_start_date:", updateError);
    }

    return new Response(
      JSON.stringify({ 
        sessionId: session.id,
        url: session.url,
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to create checkout session";
    console.error("Error creating checkout session:", errorMessage);
    return new Response(
      JSON.stringify({ 
        error: errorMessage
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
