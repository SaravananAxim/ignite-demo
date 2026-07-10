export const normalizeSectionName = (name: string) => name.replace(/[^a-z0-9]/gi, "").toLowerCase();

export const buildSelectedCategorySet = (categories: string[]) =>
  new Set(categories.map((category) => normalizeSectionName(category)));

type SectionPlaceholderValues = Record<string, Record<string, string>>;

export const buildSectionPlanNamePlaceholders = (
  selectedPlans: Array<{ plan: { name: string | null }; category: string | null | undefined }>,
) => {
  return selectedPlans.reduce<SectionPlaceholderValues>((values, { plan, category }) => {
    const normalizedCategory = normalizeSectionName(category || "Other");
    const planName = plan.name || "";

    values[normalizedCategory] = {
      ...values[normalizedCategory],
      planName: values[normalizedCategory]?.planName
        ? [values[normalizedCategory].planName, planName].filter(Boolean).join(", ")
        : planName,
    };

    return values;
  }, {});
};

export const applyConditionalSections = (
  html: string,
  selectedCategorySet: Set<string>,
  isNewLocation: boolean,
  sectionPlaceholderValues: SectionPlaceholderValues = {},
) => {
  let result = html
    .replace(
      /&lt;!--\s*(\/?)section_([^&]+?)\s*--&gt;/gi,
      (_match, closing, sectionName) => `{{${closing ? "/" : "#"}section:${sectionName.trim()}}}`,
    )
    .replace(
      /<!--\s*(\/?)section_([^>]+?)\s*-->/gi,
      (_match, closing, sectionName) => `{{${closing ? "/" : "#"}section:${sectionName.trim()}}}`,
    );

  result = result.replace(
    /\{\{#section:([^}]+)\}\}([\s\S]*?)\{\{\/section:\1\}\}/gi,
    (_match, sectionName, content) => {
      const normalizedSectionName = normalizeSectionName(sectionName.trim());

      if (normalizedSectionName === "newlocation") {
        return isNewLocation ? content : "";
      }

      if (!selectedCategorySet.has(normalizedSectionName)) {
        return "";
      }

      return Object.entries(sectionPlaceholderValues[normalizedSectionName] || {}).reduce(
        (sectionContent, [placeholder, value]) => {
          const pattern = new RegExp(`\\{\\{${escapeRegExp(placeholder)}\\}\\}`, "gi");
          return sectionContent.replace(pattern, value);
        },
        content,
      );
    },
  );

  return result.replace(/\{\{[#/]section:[^}]+\}\}/gi, "");
};

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
