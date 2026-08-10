-- Backfill signature images into final_html for contracts signed before the
-- {{franchiseeSignature}} placeholder fix. Those contracts had the placeholder
-- replaced with "" at sign time, so insertSignatureImages had nothing to find.
--
-- Strategy: append a signatures block to the end of final_html for any contract
-- that has a franchisee_signature but no rendered signature image in the HTML.
-- Only created_at / franchisee_signed_at / counter_signed_at exist on this table
-- (no updated_at), so no timestamps are affected by this UPDATE.

UPDATE public.generated_contracts
SET final_html = final_html ||
  '<div style="margin-top: 60px; padding-top: 30px; border-top: 2px solid #333; page-break-inside: avoid;">' ||
    '<h3 style="font-size: 14px; font-weight: bold; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 0.05em;">Signatures</h3>' ||
    '<div style="display: flex; gap: 60px; flex-wrap: wrap;">' ||

      -- Franchisee signature block
      '<div style="min-width: 200px;">' ||
        '<p style="font-size: 11px; color: #666; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em;">Franchisee Signature</p>' ||
        '<img src="' || franchisee_signature || '" alt="Franchisee Signature" style="max-width: 220px; height: 70px; object-fit: contain; display: block; border-bottom: 1px solid #333;" />' ||
        '<p style="margin-top: 6px; font-size: 11px;">' ||
          COALESCE(to_char(franchisee_signed_at AT TIME ZONE 'UTC', 'Month FMDD, YYYY'), '') ||
        '</p>' ||
      '</div>' ||

      -- Counter signature block (only if counter-signed)
      CASE
        WHEN counter_signature IS NOT NULL THEN
          '<div style="min-width: 200px;">' ||
            '<p style="font-size: 11px; color: #666; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em;">Authorized Representative</p>' ||
            '<img src="' || counter_signature || '" alt="Counter Signature" style="max-width: 220px; height: 70px; object-fit: contain; display: block; border-bottom: 1px solid #333;" />' ||
            '<p style="margin-top: 6px; font-size: 11px;">' ||
              COALESCE(to_char(counter_signed_at AT TIME ZONE 'UTC', 'Month FMDD, YYYY'), '') ||
            '</p>' ||
          '</div>'
        ELSE ''
      END ||

    '</div>' ||
  '</div>'

WHERE
  -- Has a franchisee signature to inject
  franchisee_signature IS NOT NULL
  -- Placeholder was never preserved (the old broken behaviour)
  AND final_html NOT LIKE '%{{franchiseeSignature}}%'
  -- Not already patched by this migration
  AND final_html NOT LIKE '%Franchisee Signature%';
