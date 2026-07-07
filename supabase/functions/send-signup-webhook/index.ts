import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type SupportedEvent =
  | "signup.new"
  | "signup.ready_for_countersign"
  | "signup.completed"
  | "signup.payment_completed";

interface DeliveryRequest {
  contractId?: string;
  franchiseeId?: string;
  event?: SupportedEvent;
  replay_of_delivery_id?: string;
}

interface SignupPayload {
  version?: 2;
  event: string;
  timestamp: string;
  effective_date: string | null;
  portal: {
    id: string;
    name: string;
    subdomain: string;
  };
  brand: {
    id: string;
    name: string;
    logo_url: string | null;
  };
  plan: {
    id: string;
    name: string;
    monthly_price: number;
    setup_fee: number | null;
    includes_paid_media: boolean;
  };
  stripe: {
    customer_id: string | null;
    subscription_id: string | null;
  };
  franchisee: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    legal_business_name: string | null;
    legal_entity: string | null;
    franchise_location_name: string | null;
    address: string | null;
    business_phone: string | null;
    cell_phone: string | null;
    position_title: string | null;
    service_start_date: string | null;
    is_new_location: boolean;
    grand_opening_date: string | null;
    location_details: Record<string, unknown>;
    campaign_rep: {
      name: string | null;
      email: string | null;
      phone: string | null;
    };
    billing_rep: {
      name: string | null;
      email: string | null;
      phone: string | null;
    };
  };
  contract: {
    id: string;
    status: string;
    franchisee_signed_at: string | null;
    counter_signed_at: string | null;
    pdf_url: string | null;
    signed_pdf_url: string | null;
    counter_sign_url: string;
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COUNTER_SIGN_BASE_URL = "https://ignite-fagzedgsg8bdfhe7.southindia-01.azurewebsites.net/admin/pending-signatures";

const ENABLE_LEGACY_PORTAL_WEBHOOKS = Deno.env.get("ENABLE_LEGACY_PORTAL_WEBHOOKS") !== "false";
const ENABLE_CENTRALIZED_WEBHOOKS = Deno.env.get("ENABLE_CENTRALIZED_WEBHOOKS") !== "false";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseJsonRecord = (value: unknown): Record<string, unknown> => {
  if (!value) return {};
  if (isObject(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return isObject(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

const generateSignature = async (secret: string, payloadString: string): Promise<string> => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadString));
  const signatureHex = Array.from(new Uint8Array(signatureBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return `sha256=${signatureHex}`;
};

const sendWebhookAttempt = async ({
  webhookUrl,
  webhookSecret,
  payload,
  eventName,
  timestamp,
}: {
  webhookUrl: string;
  webhookSecret: string | null;
  payload: SignupPayload;
  eventName: string;
  timestamp: string;
}) => {
  const payloadString = JSON.stringify(payload);

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Webhook-Event": eventName,
    "X-Webhook-Timestamp": timestamp,
  };

  if (webhookSecret) {
    requestHeaders["X-Webhook-Signature"] = await generateSignature(webhookSecret, payloadString);
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: requestHeaders,
    body: payloadString,
  });

  const responseBody = await response.text();

  return {
    ok: response.ok,
    requestHeaders,
    responseStatus: response.status,
    responseBody,
  };
};

const getContextByContract = async (supabase: ReturnType<typeof createClient>, contractId: string) => {
  const { data: contract, error } = await supabase
    .from("generated_contracts")
    .select(`
      *,
      franchisees (
        *,
        brands (
          *,
          portals (*)
        ),
        plans (*)
      )
    `)
    .eq("id", contractId)
    .single();

  if (error || !contract) {
    throw new Error("Contract not found");
  }

  return {
    contract,
    franchisee: contract.franchisees,
    brand: contract.franchisees?.brands,
    portal: contract.franchisees?.brands?.portals,
    plan: contract.franchisees?.plans,
  };
};

const getContextByFranchisee = async (supabase: ReturnType<typeof createClient>, franchiseeId: string) => {
  const { data: franchisee, error } = await supabase
    .from("franchisees")
    .select(`
      *,
      brands (
        *,
        portals (*)
      ),
      plans (*)
    `)
    .eq("id", franchiseeId)
    .single();

  if (error || !franchisee) {
    throw new Error("Franchisee not found");
  }

  const { data: contract } = await supabase
    .from("generated_contracts")
    .select("id, status, franchisee_signed_at, counter_signed_at, pdf_url, signed_pdf_url")
    .eq("franchisee_id", franchiseeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    contract,
    franchisee,
    brand: franchisee.brands,
    portal: franchisee.brands?.portals,
    plan: franchisee.plans,
  };
};

const buildPayload = ({
  eventName,
  context,
  includeVersion,
}: {
  eventName: string;
  context: Awaited<ReturnType<typeof getContextByContract>> | Awaited<ReturnType<typeof getContextByFranchisee>>;
  includeVersion: boolean;
}): SignupPayload => {
  const timestamp = new Date().toISOString();
  const franchisee = context.franchisee;
  const contract = context.contract;
  const brand = context.brand;
  const portal = context.portal;
  const plan = context.plan;

  if (!franchisee || !brand || !portal) {
    throw new Error("Missing related data to build webhook payload");
  }

  const payload: SignupPayload = {
    event: eventName,
    timestamp,
    effective_date: franchisee.service_start_date || null,
    portal: {
      id: portal.id,
      name: portal.name,
      subdomain: portal.subdomain,
    },
    brand: {
      id: brand.id,
      name: brand.name,
      logo_url: brand.logo_url,
    },
    plan: {
      id: plan?.id || "",
      name: plan?.name || "",
      monthly_price: plan?.monthly_price || 0,
      setup_fee: plan?.setup_fee || null,
      includes_paid_media: franchisee?.include_paid_media || false,
    },
    stripe: {
      customer_id: franchisee.stripe_customer_id || null,
      subscription_id: franchisee.stripe_subscription_id || null,
    },
    franchisee: {
      id: franchisee.id,
      name: franchisee.name,
      email: franchisee.email,
      phone: franchisee.phone,
      legal_business_name: franchisee.legal_business_name,
      legal_entity: franchisee.legal_entity,
      franchise_location_name: franchisee.franchise_location_name,
      address: franchisee.address,
      business_phone: franchisee.business_phone,
      cell_phone: franchisee.cell_phone,
      position_title: franchisee.position_title,
      service_start_date: franchisee.service_start_date,
      is_new_location: franchisee.is_new_location || false,
      grand_opening_date: franchisee.grand_opening_date,
      location_details: parseJsonRecord(franchisee.location_details),
      campaign_rep: {
        name: franchisee.campaign_rep_name,
        email: franchisee.campaign_rep_email,
        phone: franchisee.campaign_rep_phone,
      },
      billing_rep: {
        name: franchisee.billing_rep_name,
        email: franchisee.billing_rep_email,
        phone: franchisee.billing_rep_phone,
      },
    },
    contract: {
      id: contract?.id || "",
      status: contract?.status || "not_created",
      franchisee_signed_at: contract?.franchisee_signed_at || null,
      counter_signed_at: contract?.counter_signed_at || null,
      pdf_url: contract?.pdf_url || null,
      signed_pdf_url: contract?.signed_pdf_url || null,
      counter_sign_url: contract?.id ? `${COUNTER_SIGN_BASE_URL}?contract=${contract.id}` : "",
    },
  };

  if (includeVersion) {
    payload.version = 2;
  }

  return payload;
};

const processReplay = async ({
  supabase,
  replayOfDeliveryId,
}: {
  supabase: ReturnType<typeof createClient>;
  replayOfDeliveryId: string;
}) => {
  const { data: originalDelivery, error: originalDeliveryError } = await supabase
    .from("webhook_deliveries")
    .select(`
      id,
      webhook_subscription_id,
      event_name,
      payload,
      attempt_number,
      webhook_subscriptions (id, webhook_url, webhook_secret)
    `)
    .eq("id", replayOfDeliveryId)
    .single();

  if (originalDeliveryError || !originalDelivery) {
    throw new Error("Replay source delivery not found");
  }

  const subscription = Array.isArray(originalDelivery.webhook_subscriptions)
    ? originalDelivery.webhook_subscriptions[0]
    : originalDelivery.webhook_subscriptions;

  if (!subscription?.webhook_url) {
    throw new Error("Replay subscription is missing webhook URL");
  }

  const nextAttempt = (originalDelivery.attempt_number || 1) + 1;
  const payload = originalDelivery.payload as SignupPayload;
  const timestamp = typeof payload.timestamp === "string" ? payload.timestamp : new Date().toISOString();

  const { data: insertedDelivery, error: insertError } = await supabase
    .from("webhook_deliveries")
    .insert({
      webhook_subscription_id: originalDelivery.webhook_subscription_id,
      event_name: originalDelivery.event_name,
      payload,
      status: "pending",
      replay_of_delivery_id: originalDelivery.id,
      attempt_number: nextAttempt,
    })
    .select("id")
    .single();

  if (insertError || !insertedDelivery) {
    throw new Error(`Failed to create replay delivery row: ${insertError?.message || "unknown"}`);
  }

  try {
    const attempt = await sendWebhookAttempt({
      webhookUrl: subscription.webhook_url,
      webhookSecret: subscription.webhook_secret,
      payload,
      eventName: originalDelivery.event_name,
      timestamp,
    });

    const status = attempt.ok ? "delivered" : "failed";

    await supabase
      .from("webhook_deliveries")
      .update({
        request_headers: attempt.requestHeaders,
        response_status: attempt.responseStatus,
        response_body: attempt.responseBody,
        status,
        delivered_at: attempt.ok ? new Date().toISOString() : null,
        error_message: attempt.ok ? null : `Webhook returned ${attempt.responseStatus}`,
      })
      .eq("id", insertedDelivery.id);

    return { replay_delivery_id: insertedDelivery.id, success: attempt.ok };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown replay error";

    await supabase
      .from("webhook_deliveries")
      .update({ status: "failed", error_message: message })
      .eq("id", insertedDelivery.id);

    return { replay_delivery_id: insertedDelivery.id, success: false, error: message };
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = (await req.json()) as DeliveryRequest;

    if (body.replay_of_delivery_id) {
      const replayResult = await processReplay({
        supabase,
        replayOfDeliveryId: body.replay_of_delivery_id,
      });

      return new Response(JSON.stringify({ success: replayResult.success, ...replayResult }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!body.contractId && !body.franchiseeId) {
      return new Response(JSON.stringify({ error: "contractId or franchiseeId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventName: SupportedEvent = body.event || "signup.completed";

    const context = body.contractId
      ? await getContextByContract(supabase, body.contractId)
      : await getContextByFranchisee(supabase, body.franchiseeId!);

    const portalWebhookUrl = context.portal?.webhook_url;
    const portalWebhookSecret = context.portal?.webhook_secret || null;

    const legacyPayload = buildPayload({ eventName, context, includeVersion: false });

    const legacyResults: Array<{ url: string; success: boolean; status: number; body: string }> = [];
    const centralizedResults: Array<{ subscription_id: string; success: boolean; status: number; delivery_id: string }> = [];

    if (ENABLE_LEGACY_PORTAL_WEBHOOKS && portalWebhookUrl) {
      const legacyAttempt = await sendWebhookAttempt({
        webhookUrl: portalWebhookUrl,
        webhookSecret: portalWebhookSecret,
        payload: legacyPayload,
        eventName,
        timestamp: legacyPayload.timestamp,
      });

      legacyResults.push({
        url: portalWebhookUrl,
        success: legacyAttempt.ok,
        status: legacyAttempt.responseStatus,
        body: legacyAttempt.responseBody,
      });
    }

    if (ENABLE_CENTRALIZED_WEBHOOKS) {
      const centralizedPayload = buildPayload({ eventName, context, includeVersion: true });

      const { data: subscriptions, error: subscriptionsError } = await supabase
        .from("webhook_subscriptions")
        .select("id, webhook_url, webhook_secret, events, is_enabled")
        .eq("is_enabled", true)
        .contains("events", [eventName]);

      if (subscriptionsError) {
        throw new Error(`Unable to load centralized subscriptions: ${subscriptionsError.message}`);
      }

      for (const subscription of subscriptions || []) {
        const { data: insertedDelivery, error: insertError } = await supabase
          .from("webhook_deliveries")
          .insert({
            webhook_subscription_id: subscription.id,
            event_name: eventName,
            payload: centralizedPayload,
            status: "pending",
          })
          .select("id")
          .single();

        if (insertError || !insertedDelivery) {
          console.error(`Failed to insert delivery row for subscription ${subscription.id}:`, insertError);
          continue;
        }

        try {
          const attempt = await sendWebhookAttempt({
            webhookUrl: subscription.webhook_url,
            webhookSecret: subscription.webhook_secret || null,
            payload: centralizedPayload,
            eventName,
            timestamp: centralizedPayload.timestamp,
          });

          const status = attempt.ok ? "delivered" : "failed";

          await supabase
            .from("webhook_deliveries")
            .update({
              request_headers: attempt.requestHeaders,
              response_status: attempt.responseStatus,
              response_body: attempt.responseBody,
              status,
              delivered_at: attempt.ok ? new Date().toISOString() : null,
              error_message: attempt.ok ? null : `Webhook returned ${attempt.responseStatus}`,
            })
            .eq("id", insertedDelivery.id);

          centralizedResults.push({
            subscription_id: subscription.id,
            success: attempt.ok,
            status: attempt.responseStatus,
            delivery_id: insertedDelivery.id,
          });
        } catch (deliveryError: unknown) {
          const message = deliveryError instanceof Error ? deliveryError.message : "Unknown delivery error";

          await supabase
            .from("webhook_deliveries")
            .update({ status: "failed", error_message: message })
            .eq("id", insertedDelivery.id);

          centralizedResults.push({
            subscription_id: subscription.id,
            success: false,
            status: 0,
            delivery_id: insertedDelivery.id,
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        event: eventName,
        legacy_enabled: ENABLE_LEGACY_PORTAL_WEBHOOKS,
        centralized_enabled: ENABLE_CENTRALIZED_WEBHOOKS,
        legacy_results: legacyResults,
        centralized_results: centralizedResults,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error sending webhook:", message);

    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
