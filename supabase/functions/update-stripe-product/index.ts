import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateProductRequest {
  stripePriceId: string;
  fullProductName: string;
  description: string;
}

/** Decode HTML entities so Stripe shows plain text (e.g. &amp; -> &, &nbsp; -> space). */
function decodeHtmlEntities(text: string): string {
  if (!text) return text;
  return text
    .replace(/&nbsp;/g, "\u00A0")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

serve(async (req) => {
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

    const { stripePriceId, fullProductName, description }: UpdateProductRequest = await req.json();

    if (!stripePriceId || !fullProductName) {
      throw new Error("stripePriceId and fullProductName are required");
    }

    const price = await stripe.prices.retrieve(stripePriceId);
    const productId = typeof price.product === "string" ? price.product : price.product?.id;
    if (!productId) {
      throw new Error("Could not resolve product from price");
    }

    const cleanDescription = description ? decodeHtmlEntities(description) : undefined;
    await stripe.products.update(productId, {
      name: fullProductName,
      description: cleanDescription || undefined,
    });

    console.log("Updated Stripe product:", productId, fullProductName);

    return new Response(
      JSON.stringify({ success: true, productId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update Stripe product";
    console.error("update-stripe-product error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
