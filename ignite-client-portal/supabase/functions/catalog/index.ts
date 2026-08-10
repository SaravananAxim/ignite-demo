import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── CORS ─────────────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

// ─── Supabase client (service role — bypasses RLS) ────────────────────────────

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// ─── Response helpers ─────────────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function ok(data: unknown, count?: number): Response {
  return json({
    data,
    meta: {
      count: count != null
        ? count
        : Array.isArray(data)
        ? (data as unknown[]).length
        : 1,
      timestamp: new Date().toISOString(),
    },
  });
}

function apiErr(message: string, status: number): Response {
  return json({ error: message, code: status }, status);
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

interface ApiKeyRow {
  id: string;
  permissions: string[];
}

async function authenticate(
  req: Request,
): Promise<{ authErr: Response | null; apiKey?: ApiKeyRow }> {
  const key = req.headers.get("x-api-key");
  if (!key) return { authErr: apiErr("Missing X-API-Key header", 401) };

  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key),
  );
  const hexHash = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const { data: apiKey, error: dbErr } = await supabase
    .from("api_keys")
    .select("id, permissions")
    .eq("key_hash", hexHash)
    .eq("is_active", true)
    .single<ApiKeyRow>();

  if (dbErr || !apiKey) {
    return { authErr: apiErr("Invalid or inactive API key", 401) };
  }

  // Update last_used_at — fire and forget, do not block the response
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", apiKey.id)
    .then(() => {/* noop */});

  return { authErr: null, apiKey };
}

function checkWritePermission(apiKey: ApiKeyRow, method: string): Response | null {
  const writeMethods = ["POST", "PUT", "PATCH", "DELETE"];
  if (writeMethods.includes(method)) {
    if (!Array.isArray(apiKey.permissions) || !apiKey.permissions.includes("write")) {
      return apiErr("Write access not permitted", 403);
    }
  }
  return null;
}

// ─── Pagination helpers ───────────────────────────────────────────────────────

function getLimit(params: URLSearchParams, max = 500): number {
  const raw = parseInt(params.get("limit") ?? "100", 10);
  return Math.min(isNaN(raw) || raw < 1 ? 100 : raw, max);
}

function getOffset(params: URLSearchParams): number {
  const raw = parseInt(params.get("offset") ?? "0", 10);
  return isNaN(raw) || raw < 0 ? 0 : raw;
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleSkus(
  method: string,
  id: string | null,
  params: URLSearchParams,
  _req: Request,
): Promise<Response> {
  if (method === "GET" && id) {
    const { data, error } = await supabase
      .from("skus")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) return apiErr("SKU not found", 404);
    return ok(data);
  }

  if (method === "GET") {
    const limit = getLimit(params);
    const offset = getOffset(params);

    // deno-lint-ignore no-explicit-any
    let query: any = supabase.from("skus").select("*", { count: "exact" });

    const category = params.get("category");
    const status = params.get("status");
    const billingType = params.get("billing_type");
    const search = params.get("search");

    if (category) query = query.eq("mapped_category", category);
    if (status) query = query.eq("status", status);
    if (billingType) query = query.eq("billing_type", billingType);
    if (search) query = query.ilike("source_product", `%${search}%`);

    const { data, error, count } = await query
      .order("source_product")
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return ok(data, count ?? undefined);
  }

  return apiErr("Method not allowed", 405);
}

async function handleProducts(
  method: string,
  id: string | null,
  params: URLSearchParams,
  req: Request,
): Promise<Response> {
  const fullSelect =
    "*, product_skus(*, skus(id, source_product, mapped_category, std_list_price))";

  if (method === "GET" && id) {
    const { data, error } = await supabase
      .from("products")
      .select(fullSelect)
      .eq("id", id)
      .single();
    if (error || !data) return apiErr("Product not found", 404);
    return ok(data);
  }

  if (method === "GET") {
    const limit = getLimit(params);
    const offset = getOffset(params);

    // deno-lint-ignore no-explicit-any
    let query: any = supabase.from("products").select(fullSelect, { count: "exact" });

    const productLine = params.get("product_line");
    const status = params.get("status");

    if (productLine) query = query.eq("product_line", productLine);
    if (status) query = query.eq("status", status);

    const { data, error, count } = await query
      .order("name")
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return ok(data, count ?? undefined);
  }

  if (method === "PUT" && id) {
    const body = await req.json();
    const ALLOWED = [
      "name",
      "price_monthly",
      "price_one_time",
      "price_unit",
      "billing_type",
      "rollup_logic",
      "status",
    ];
    const update: Record<string, unknown> = {};
    for (const key of ALLOWED) {
      if (key in body) update[key] = body[key];
    }
    if (Object.keys(update).length === 0) {
      return apiErr("No valid fields provided", 400);
    }

    const { data, error } = await supabase
      .from("products")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !data) return apiErr("Product not found or update failed", 404);
    return ok(data);
  }

  return apiErr("Method not allowed", 405);
}

async function handlePackages(
  method: string,
  id: string | null,
  params: URLSearchParams,
  req: Request,
): Promise<Response> {
  const fullSelect =
    "*, package_products(*, products(id, name, product_id, price_monthly)), " +
    "package_skus(*, skus(id, source_product, mapped_category, std_list_price))";

  if (method === "GET" && id) {
    const { data, error } = await supabase
      .from("packages")
      .select(fullSelect)
      .eq("id", id)
      .single();
    if (error || !data) return apiErr("Package not found", 404);
    return ok(data);
  }

  if (method === "GET") {
    const limit = getLimit(params);
    const offset = getOffset(params);

    // deno-lint-ignore no-explicit-any
    let query: any = supabase.from("packages").select(fullSelect, { count: "exact" });

    const productLine = params.get("product_line");
    const tier = params.get("tier");
    const status = params.get("status");

    if (productLine) query = query.eq("product_line", productLine);
    if (tier) query = query.eq("tier", tier);
    if (status) query = query.eq("status", status);

    const { data, error, count } = await query
      .order("name")
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return ok(data, count ?? undefined);
  }

  if (method === "POST") {
    const body = await req.json();
    const {
      package_id,
      name,
      product_line,
      tier,
      monthly_price,
      one_time_price,
      pillar_coverage,
      intended_fit,
      product_ids,
      sku_ids,
    } = body;

    if (!package_id || !name) {
      return apiErr("package_id and name are required", 400);
    }

    const { data: created, error: insertErr } = await supabase
      .from("packages")
      .insert({
        package_id,
        name,
        product_line: product_line ?? null,
        tier: tier ?? null,
        monthly_price: monthly_price ?? null,
        one_time_price: one_time_price ?? null,
        pillar_coverage: pillar_coverage ?? null,
        intended_fit: intended_fit ?? null,
      })
      .select("id")
      .single();

    if (insertErr || !created) throw insertErr ?? new Error("Package insert failed");

    const pkgId = (created as { id: string }).id;

    if (Array.isArray(product_ids) && product_ids.length > 0) {
      await supabase
        .from("package_products")
        .insert(product_ids.map((pid: string) => ({ package_id: pkgId, product_id: pid })));
    }
    if (Array.isArray(sku_ids) && sku_ids.length > 0) {
      await supabase
        .from("package_skus")
        .insert(sku_ids.map((sid: string) => ({ package_id: pkgId, sku_id: sid })));
    }

    const { data: full } = await supabase
      .from("packages")
      .select(fullSelect)
      .eq("id", pkgId)
      .single();

    return json({ data: full, meta: { count: 1, timestamp: new Date().toISOString() } }, 201);
  }

  if (method === "PUT" && id) {
    const body = await req.json();
    const ALLOWED = [
      "name",
      "monthly_price",
      "one_time_price",
      "pillar_coverage",
      "intended_fit",
      "status",
    ];
    const update: Record<string, unknown> = {};
    for (const key of ALLOWED) {
      if (key in body) update[key] = body[key];
    }

    if (Object.keys(update).length > 0) {
      const { error: updateErr } = await supabase
        .from("packages")
        .update(update)
        .eq("id", id);
      if (updateErr) throw updateErr;
    }

    if ("product_ids" in body && Array.isArray(body.product_ids)) {
      await supabase.from("package_products").delete().eq("package_id", id);
      if (body.product_ids.length > 0) {
        await supabase.from("package_products").insert(
          body.product_ids.map((pid: string) => ({ package_id: id, product_id: pid })),
        );
      }
    }

    if ("sku_ids" in body && Array.isArray(body.sku_ids)) {
      await supabase.from("package_skus").delete().eq("package_id", id);
      if (body.sku_ids.length > 0) {
        await supabase.from("package_skus").insert(
          body.sku_ids.map((sid: string) => ({ package_id: id, sku_id: sid })),
        );
      }
    }

    const { data: full, error: fetchErr } = await supabase
      .from("packages")
      .select(fullSelect)
      .eq("id", id)
      .single();

    if (fetchErr || !full) return apiErr("Package not found", 404);
    return ok(full);
  }

  return apiErr("Method not allowed", 405);
}

async function handlePrograms(
  method: string,
  id: string | null,
  params: URLSearchParams,
  req: Request,
): Promise<Response> {
  const fullSelect =
    "*, program_packages(*, packages(id, name, package_id, monthly_price, tier))";

  if (method === "GET" && id) {
    const { data, error } = await supabase
      .from("programs")
      .select(fullSelect)
      .eq("id", id)
      .single();
    if (error || !data) return apiErr("Program not found", 404);
    return ok(data);
  }

  if (method === "GET") {
    const limit = getLimit(params);
    const offset = getOffset(params);

    // deno-lint-ignore no-explicit-any
    let query: any = supabase.from("programs").select(fullSelect, { count: "exact" });

    const tier = params.get("tier");
    const status = params.get("status");

    if (tier) query = query.eq("tier", tier);
    if (status) query = query.eq("status", status);

    const { data, error, count } = await query
      .order("monthly_price")
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return ok(data, count ?? undefined);
  }

  if (method === "PUT" && id) {
    const body = await req.json();
    const ALLOWED = [
      "name",
      "monthly_price",
      "one_time_price",
      "client_fit",
      "optional_accelerators",
      "status",
    ];
    const update: Record<string, unknown> = {};
    for (const key of ALLOWED) {
      if (key in body) update[key] = body[key];
    }
    if (Object.keys(update).length === 0) {
      return apiErr("No valid fields provided", 400);
    }

    const { data, error } = await supabase
      .from("programs")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !data) return apiErr("Program not found or update failed", 404);
    return ok(data);
  }

  return apiErr("Method not allowed", 405);
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // Parse path segments after /catalog
  const segments = url.pathname.split("/").filter(Boolean);
  const catalogIdx = segments.indexOf("catalog");
  const pathParts = catalogIdx >= 0 ? segments.slice(catalogIdx + 1) : [];
  const resource = pathParts[0] ?? "";
  const id = pathParts[1] ?? null;
  const params = url.searchParams;

  // Authenticate every request
  const { authErr, apiKey } = await authenticate(req);
  if (authErr) return authErr;

  // Check write permissions for mutating methods
  const permErr = checkWritePermission(apiKey!, req.method);
  if (permErr) return permErr;

  // Route to resource handler — each handler has its own internal try/catch
  // but we wrap the dispatch itself for belt-and-suspenders coverage.
  try {
    switch (resource) {
      case "skus":
        return await handleSkus(req.method, id, params, req);
      case "products":
        return await handleProducts(req.method, id, params, req);
      case "packages":
        return await handlePackages(req.method, id, params, req);
      case "programs":
        return await handlePrograms(req.method, id, params, req);
      default:
        return apiErr("Unknown endpoint", 404);
    }
  } catch (e) {
    console.error(`[catalog] Unhandled error on ${url.pathname}:`, e);
    return apiErr("Internal server error", 500);
  }
});
