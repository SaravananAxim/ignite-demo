import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Plan = {
  id: string;
  name: string;
  category?: string | null;
  monthly_price?: number | string | null;
  stripe_price_id?: string | null;
  stripe_price_id_with_media?: string | null;
  setup_fee?: number | string | null;
  trial_days?: number | null;
  billing_anchor_day?: number | null;
};

type SelectedPlan = {
  plan: Plan;
  category: string;
  isPrimary: boolean;
};

const DEFAULT_PLAN_CATEGORY = "Other";
const PAID_MEDIA_CATEGORY = "paid media";

const normalizeCategory = (category?: string | null) => (category || DEFAULT_PLAN_CATEGORY).trim().toLowerCase();

const joinMetadataList = (values: string[]) => values.join(",");

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

    // Fetch franchisee with the legacy primary plan and brand flag. Multi-plan selections
    // are loaded server-side below from franchisee_plans so the client cannot alter the cart.
    const { data: franchisee, error: franchiseeError } = await supabase
      .from("franchisees")
      .select(`
        *,
        brands (
          id,
          multi_plan_logic
        ),
        plans (
          id,
          name,
          category,
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

    const primaryPlan = franchisee.plans as Plan | null;
    if (!primaryPlan) {
      throw new Error("No plan associated with franchisee");
    }

    const isMultiPlanLogicEnabled = franchisee.brands?.multi_plan_logic === true;
    let selectedPlans: SelectedPlan[] = [];

    if (isMultiPlanLogicEnabled) {
      const { data: persistedSelections, error: persistedSelectionsError } = await supabase
        .from("franchisee_plans")
        .select(`
          category,
          is_primary,
          plans (
            id,
            name,
            category,
            monthly_price,
            stripe_price_id,
            stripe_price_id_with_media,
            setup_fee,
            trial_days,
            billing_anchor_day
          )
        `)
        .eq("franchisee_id", franchiseeId)
        .order("is_primary", { ascending: false })
        .order("category", { ascending: true });

      if (persistedSelectionsError) {
        console.error("Selected plan fetch error:", persistedSelectionsError);
        throw new Error("Could not load selected plans");
      }

      selectedPlans = (persistedSelections || [])
        .filter((selection: { plans: Plan | null }) => !!selection.plans)
        .map((selection: { category?: string | null; is_primary?: boolean | null; plans: Plan }) => ({
          plan: selection.plans,
          category: selection.category || selection.plans.category || DEFAULT_PLAN_CATEGORY,
          isPrimary: selection.is_primary === true,
        }));

      if (selectedPlans.length === 0) {
        throw new Error("No selected plans found for this franchisee");
      }
    } else {
      selectedPlans = [{
        plan: primaryPlan,
        category: primaryPlan.category || DEFAULT_PLAN_CATEGORY,
        isPrimary: true,
      }];
    }

    const primarySelectedPlan = selectedPlans.find((selection) => selection.isPrimary)?.plan || selectedPlans[0].plan;
    const selectedPlanIds = selectedPlans.map(({ plan }) => plan.id);
    const selectedPlanCategories = selectedPlans.map(({ category }) => category);
    const planIdsMetadata = joinMetadataList(selectedPlanIds);
    const planCategoriesMetadata = joinMetadataList(selectedPlanCategories);

    console.log(
      "Found franchisee:",
      franchisee.email,
      "Selected plans:",
      selectedPlans.map(({ plan }) => plan.name).join(", "),
    );

    const missingBasePricePlan = selectedPlans.find(({ plan }) => !plan.stripe_price_id);
    if (missingBasePricePlan) {
      console.error("No base Stripe price ID configured for selected plan:", missingBasePricePlan.plan.id);
      throw new Error(`Stripe price not configured for ${missingBasePricePlan.plan.name}`);
    }

    const getSubscriptionPriceId = ({ plan, category }: SelectedPlan) => {
      if (!isMultiPlanLogicEnabled) {
        // Legacy single-plan behavior: the aggregate include_paid_media flag upgrades the
        // selected plan to stripe_price_id_with_media when configured.
        return franchisee.include_paid_media ? plan.stripe_price_id_with_media : plan.stripe_price_id;
      }

      // Multi-plan behavior: stripe_price_id_with_media is only used for the selected
      // Paid Media category plan. Other selected plans always use their base Stripe price.
      if (franchisee.include_paid_media && normalizeCategory(category) === PAID_MEDIA_CATEGORY) {
        return plan.stripe_price_id_with_media || plan.stripe_price_id;
      }

      return plan.stripe_price_id;
    };

    const subscriptionLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = selectedPlans.map((selection) => {
      const priceId = getSubscriptionPriceId(selection);

      if (!priceId) {
        console.error("No Stripe price ID configured for selected plan:", selection.plan.id);
        throw new Error(`Stripe price not configured for ${selection.plan.name}`);
      }

      return {
        price: priceId,
        quantity: 1,
      };
    });

    // Check if there's a setup fee (one-time charge). Multi-plan checkouts charge the
    // total setup fee across selected plans; single-plan checkouts retain the legacy total.
    const setupFee = selectedPlans.reduce((total, { plan }) => total + (plan.setup_fee ? Number(plan.setup_fee) : 0), 0);

    const commonMetadata = {
      franchisee_id: franchiseeId,
      plan_id: primarySelectedPlan.id,
      primary_plan_id: primarySelectedPlan.id,
      plan_ids: planIdsMetadata,
      plan_categories: planCategoriesMetadata,
      include_paid_media: String(franchisee.include_paid_media),
      paid_media_price_scope: isMultiPlanLogicEnabled ? "selected_paid_media_plan" : "legacy_single_plan_add_on",
      effective_date: effectiveDate,
    };

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
        metadata: commonMetadata,
      });

      customerId = customer.id;

      // Update franchisee with Stripe customer ID
      await supabase
        .from("franchisees")
        .update({ stripe_customer_id: customerId })
        .eq("id", franchiseeId);

      console.log("Created Stripe customer:", customerId);
    }
    
    // Determine checkout mode and line items
    // If there's a setup fee, we need to use subscription mode with a trial
    // and add the setup fee as a separate one-time item
    const now = Math.floor(Date.now() / 1000);
    const trialEnd = billingCycleAnchor;
    
    // Ensure trial_end is at least 48 hours in the future (Stripe requirement)
    const minTrialEnd = now + (48 * 60 * 60);
    const actualTrialEnd = Math.max(trialEnd, minTrialEnd);

    console.log(setupFee > 0 ? "Creating checkout with setup fee:" : "Creating subscription-only checkout", setupFee);
    console.log("Trial ends:", new Date(actualTrialEnd * 1000).toISOString());

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [...subscriptionLineItems];

    if (setupFee > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "One-Time Setup Fee",
            description: isMultiPlanLogicEnabled
              ? "Account setup and onboarding fees for selected plans"
              : "Account setup and onboarding fee",
          },
          unit_amount: Math.round(setupFee * 100),
        },
        quantity: 1,
      });
    }

    const checkoutConfig: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      customer_update: { name: "auto" },
      mode: "subscription",
      payment_method_types: ["card"],
      allow_promotion_codes: true,
      line_items: lineItems,
      subscription_data: {
        trial_end: actualTrialEnd,
        metadata: commonMetadata,
      },
      success_url: successUrl || `${req.headers.get("origin")}/payment-confirmation?franchisee_id=${franchiseeId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${req.headers.get("origin")}/payment-processing?franchisee_id=${franchiseeId}&canceled=true`,
      metadata: commonMetadata,
    };

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
        service_start_date: effectiveDate.split("T")[0], // Store just the date part
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
