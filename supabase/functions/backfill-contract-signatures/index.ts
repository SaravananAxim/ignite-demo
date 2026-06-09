import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Helpers (mirrors src/lib/pdfGenerator.ts) ───────────────────────────────

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replacePlaceholders(html: string, values: Record<string, string>): string {
  let result = html;
  for (const [key, value] of Object.entries(values)) {
    const pattern = new RegExp(`\\{\\{${escapeRegExp(key)}\\}\\}`, "gi");
    result = result.replace(pattern, value);
  }
  return result;
}

function sanitizeContractHtml(html: string): string {
  // Strip unreplaced placeholders EXCEPT signature ones — they're replaced below
  let result = html.replace(
    /\{\{(?!(franchiseeSignature|counterSignature|franchiseeSignedDate|counterSignedDate)\}\})[^}]*\}\}/g,
    ""
  );
  // Strip leftover section markers
  result = result.replace(/<!--\s*\/?section_[A-Za-z]+\s*-->/gi, "");
  return result;
}

function insertSignatureImages(
  html: string,
  franchiseeSignature: string | null,
  counterSignature: string | null,
  franchiseeSignedDate: string | null,
  counterSignedDate: string | null
): string {
  let result = html;

  if (franchiseeSignature) {
    const img = `<img src="${franchiseeSignature}" alt="Franchisee Signature" style="max-width: 220px; height: 70px; object-fit: contain; display: block;" />`;
    result = result.replace(/\{\{franchiseeSignature\}\}/gi, img);
  } else {
    result = result.replace(/\{\{franchiseeSignature\}\}/gi, "");
  }

  if (franchiseeSignedDate) {
    result = result.replace(/\{\{franchiseeSignedDate\}\}/gi, franchiseeSignedDate);
  } else {
    result = result.replace(/\{\{franchiseeSignedDate\}\}/gi, "");
  }

  if (counterSignature) {
    const img = `<img src="${counterSignature}" alt="Authorized Signature" style="max-width: 220px; height: 70px; object-fit: contain; display: block;" />`;
    result = result.replace(/\{\{counterSignature\}\}/gi, img);
  } else {
    result = result.replace(/\{\{counterSignature\}\}/gi, "");
  }

  if (counterSignedDate) {
    result = result.replace(/\{\{counterSignedDate\}\}/gi, counterSignedDate);
  } else {
    result = result.replace(/\{\{counterSignedDate\}\}/gi, "");
  }

  return result;
}

/** Format a date string as "Month D, YYYY" matching date-fns format(date, "MMMM d, yyyy") */
function formatDateLong(dateStr: string | null): string {
  if (!dateStr) return "";
  // Append T00:00:00 for date-only strings so they parse as local time, not UTC midnight
  const d = dateStr.includes("T") ? new Date(dateStr) : new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const dryRun: boolean = body.dry_run === true;

    console.log(`Starting backfill-contract-signatures (dry_run=${dryRun})`);

    // ── 1. Fetch all contracts that need fixing ──────────────────────────────
    // Affected = has a franchisee signature but final_html no longer contains
    // the {{franchiseeSignature}} placeholder (it was overwritten with "")
    const { data: contracts, error: fetchError } = await supabase
      .from("generated_contracts")
      .select(`
        id,
        final_html,
        franchisee_signature,
        counter_signature,
        franchisee_signed_at,
        counter_signed_at,
        template_id,
        franchisee_id,
        franchisees (
          id, name, email, phone, address,
          legal_business_name, legal_entity, franchise_location_name,
          position_title, business_phone, cell_phone,
          include_paid_media, is_new_location,
          service_start_date, grand_opening_date,
          campaign_rep_name, campaign_rep_email, campaign_rep_phone,
          billing_rep_name, billing_rep_email, billing_rep_phone,
          location_details,
          brands (name),
          plans (
            name, monthly_price, monthly_price_with_media,
            setup_fee
          )
        ),
        contract_templates (html_content)
      `)
      .not("franchisee_signature", "is", null);

    if (fetchError || !contracts) {
      throw new Error(`Failed to fetch contracts: ${fetchError?.message}`);
    }

    // Filter in memory: only contracts where the placeholder is gone
    const affected = contracts.filter(
      (c) => c.final_html && !c.final_html.includes("{{franchiseeSignature}}")
    );

    console.log(`Found ${affected.length} contracts to backfill out of ${contracts.length} total`);

    const results: { id: string; status: string; error?: string }[] = [];

    // ── 2. Re-generate final_html for each affected contract ─────────────────
    for (const contract of affected) {
      try {
        const franchisee = contract.franchisees as any;
        const template = contract.contract_templates as any;

        if (!franchisee || !template?.html_content) {
          results.push({ id: contract.id, status: "skipped", error: "Missing franchisee or template" });
          continue;
        }

        const locationDetails = (franchisee.location_details as Record<string, string>) || {};
        const plan = franchisee.plans as any;
        const brand = franchisee.brands as any;

        const monthlyPrice = Number(plan?.monthly_price) || 0;
        const paidMediaFee = Number(plan?.monthly_price_with_media) || 0;
        const setupFee = Number(plan?.setup_fee) || 0;
        const totalMonthly = franchisee.include_paid_media
          ? monthlyPrice + paidMediaFee
          : monthlyPrice;

        const fullAddress = [
          locationDetails.streetAddress,
          locationDetails.city,
          locationDetails.state,
          locationDetails.zipCode,
        ].filter(Boolean).join(", ");

        // Mirror ContractReview.tsx placeholderValues exactly
        const placeholderValues: Record<string, string> = {
          legalBusinessName: franchisee.legal_business_name || "",
          legalEntity: franchisee.legal_entity || "",
          franchiseLocationName: franchisee.franchise_location_name || "",
          firstName: locationDetails.firstName || "",
          lastName: locationDetails.lastName || "",
          fullName:
            [locationDetails.firstName, locationDetails.lastName].filter(Boolean).join(" ") ||
            franchisee.name || "",
          email: franchisee.email || "",
          positionTitle: franchisee.position_title || "",
          businessPhone: franchisee.business_phone || "",
          cellPhone: franchisee.cell_phone || "",
          streetAddress: locationDetails.streetAddress || franchisee.address || "",
          city: locationDetails.city || "",
          state: locationDetails.state || "",
          zipCode: locationDetails.zipCode || "",
          fullAddress: fullAddress || franchisee.address || "",
          brandName: brand?.name || "",
          portalName: "Ignite Visibility",
          planName: plan?.name || "",
          monthlyPrice: `$${monthlyPrice.toLocaleString("en-US")}`,
          setupFee: setupFee ? `$${setupFee.toLocaleString("en-US")}` : "$0",
          paidMediaFee: paidMediaFee ? `$${paidMediaFee.toLocaleString("en-US")}` : "$0",
          totalMonthlyPrice: `$${totalMonthly.toLocaleString("en-US")}`,
          effectiveDate: formatDateLong(franchisee.service_start_date),
          signatureDate: new Date().toLocaleDateString("en-US"),
          currentDate: new Date().toLocaleDateString("en-US"),
          grandOpeningDate: formatDateLong(franchisee.grand_opening_date),
          campaignRepName: franchisee.campaign_rep_name || "",
          campaignRepEmail: franchisee.campaign_rep_email || "",
          campaignRepPhone: franchisee.campaign_rep_phone || "",
          billingRepName: franchisee.billing_rep_name || "",
          billingRepEmail: franchisee.billing_rep_email || "",
          billingRepPhone: franchisee.billing_rep_phone || "",
          // Legacy
          franchiseeName: franchisee.name || "",
          franchiseeEmail: franchisee.email || "",
          franchiseeAddress: fullAddress || franchisee.address || "",
          // Signature placeholders intentionally omitted — preserved below
        };

        // Mirror conditional section logic from ContractReview.tsx
        let html = template.html_content;

        // Normalize legacy entity-encoded markers (Quill insertText escapes < and >)
        html = html
          .replace(/&lt;!--\s*section_PaidMedia\s*--&gt;/gi, "{{#section:PaidMedia}}")
          .replace(/&lt;!--\s*\/section_PaidMedia\s*--&gt;/gi, "{{/section:PaidMedia}}")
          .replace(/&lt;!--\s*section_NewLocation\s*--&gt;/gi, "{{#section:NewLocation}}")
          .replace(/&lt;!--\s*\/section_NewLocation\s*--&gt;/gi, "{{/section:NewLocation}}");

        if (!franchisee.include_paid_media) {
          html = html.replace(/\{\{#section:PaidMedia\}\}[\s\S]*?\{\{\/section:PaidMedia\}\}/gi, "");
          html = html.replace(/<!--\s*section_PaidMedia\s*-->[\s\S]*?<!--\s*\/section_PaidMedia\s*-->/gi, "");
        } else {
          html = html.replace(/\{\{[#/]?section:PaidMedia\}\}/gi, "");
          html = html.replace(/<!--\s*\/?section_PaidMedia\s*-->/gi, "");
        }

        if (!franchisee.is_new_location) {
          html = html.replace(/\{\{#section:NewLocation\}\}[\s\S]*?\{\{\/section:NewLocation\}\}/gi, "");
          html = html.replace(/<!--\s*section_NewLocation\s*-->[\s\S]*?<!--\s*\/section_NewLocation\s*-->/gi, "");
        } else {
          html = html.replace(/\{\{[#/]?section:NewLocation\}\}/gi, "");
          html = html.replace(/<!--\s*\/?section_NewLocation\s*-->/gi, "");
        }

        // Replace all non-signature placeholders
        html = replacePlaceholders(html, placeholderValues);
        // Strip any other unreplaced placeholders, preserve signature ones
        html = sanitizeContractHtml(html);

        // Now inject the actual signatures into their correct positions
        const franchiseeDate = contract.franchisee_signed_at
          ? new Date(contract.franchisee_signed_at).toLocaleDateString("en-US", {
              year: "numeric", month: "long", day: "numeric",
            })
          : null;
        const counterDate = contract.counter_signed_at
          ? new Date(contract.counter_signed_at).toLocaleDateString("en-US", {
              year: "numeric", month: "long", day: "numeric",
            })
          : null;

        html = insertSignatureImages(
          html,
          contract.franchisee_signature,
          contract.counter_signature,
          franchiseeDate,
          counterDate
        );

        if (dryRun) {
          results.push({ id: contract.id, status: "dry_run_ok" });
          console.log(`[DRY RUN] Would update contract ${contract.id}`);
          continue;
        }

        // ── 3. Update ONLY final_html — no other fields touched ──────────────
        const { error: updateError } = await supabase
          .from("generated_contracts")
          .update({ final_html: html })
          .eq("id", contract.id);

        if (updateError) {
          results.push({ id: contract.id, status: "error", error: updateError.message });
          console.error(`Failed to update contract ${contract.id}:`, updateError);
        } else {
          results.push({ id: contract.id, status: "updated" });
          console.log(`Updated contract ${contract.id}`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ id: contract.id, status: "error", error: msg });
        console.error(`Error processing contract ${contract.id}:`, msg);
      }
    }

    const summary = {
      total_checked: contracts.length,
      affected: affected.length,
      updated: results.filter((r) => r.status === "updated").length,
      dry_run_ok: results.filter((r) => r.status === "dry_run_ok").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      errors: results.filter((r) => r.status === "error").length,
      dry_run: dryRun,
      details: results,
    };

    console.log("Backfill complete:", summary);

    return new Response(JSON.stringify(summary, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Backfill error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
