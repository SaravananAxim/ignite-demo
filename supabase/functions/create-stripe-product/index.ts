import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateProductRequest {
  portalName: string;
  brandName: string;
  planName: string;
  description: string;
  monthlyPrice: number;
  monthlyPriceWithMedia?: number;
  supportsPaidMedia: boolean;
}

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
      apiVersion: "2025-08-27.basil",
    });

    const { 
      portalName, 
      brandName, 
      planName, 
      description, 
      monthlyPrice, 
      monthlyPriceWithMedia, 
      supportsPaidMedia 
    }: CreateProductRequest = await req.json();

    // Build full product name with hierarchy
    const fullProductName = `${portalName} | ${brandName} | ${planName}`;
    
    console.log("Creating Stripe product:", fullProductName, "Price:", monthlyPrice);

    if (!planName || monthlyPrice === undefined) {
      throw new Error("planName and monthlyPrice are required");
    }

    // Create Stripe product with full naming
    const product = await stripe.products.create({
      name: fullProductName,
      description: description || undefined,
      metadata: {
        created_from: "ignite_portal",
        portal_name: portalName || "",
        brand_name: brandName || "",
        plan_name: planName || "",
      },
    });

    console.log("Created Stripe product:", product.id);

    // Create base price (monthly subscription)
    const basePrice = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(monthlyPrice * 100), // Convert to cents
      currency: "usd",
      recurring: {
        interval: "month",
      },
      nickname: `${planName} - Base`,
      metadata: {
        plan_type: "base",
        portal_name: portalName || "",
        brand_name: brandName || "",
      },
    });

    console.log("Created base price:", basePrice.id);

    let mediaPriceId: string | null = null;

    // Create price with media if supported (monthlyPriceWithMedia is the ADD-ON amount)
    if (supportsPaidMedia && monthlyPriceWithMedia && monthlyPriceWithMedia > 0) {
      const totalWithMedia = monthlyPrice + monthlyPriceWithMedia;
      console.log("Creating media price: base", monthlyPrice, "+ add-on", monthlyPriceWithMedia, "= total", totalWithMedia);
      
      const mediaPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: Math.round(totalWithMedia * 100), // Total = base + add-on
        currency: "usd",
        recurring: {
          interval: "month",
        },
        nickname: `${planName} - With Media`,
        metadata: {
          plan_type: "with_media",
          base_price: String(monthlyPrice),
          media_addon: String(monthlyPriceWithMedia),
          portal_name: portalName || "",
          brand_name: brandName || "",
        },
      });

      mediaPriceId = mediaPrice.id;
      console.log("Created media price:", mediaPriceId);
    }

    return new Response(
      JSON.stringify({
        productId: product.id,
        priceId: basePrice.id,
        priceIdWithMedia: mediaPriceId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to create Stripe product";
    console.error("Error creating Stripe product:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
