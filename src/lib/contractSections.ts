export const normalizeSectionName = (name: string) => name.replace(/[^a-z0-9]/gi, "").toLowerCase();

export const buildSelectedCategorySet = (categories: string[]) =>
  new Set(categories.map((category) => normalizeSectionName(category)));

export const applyConditionalSections = (
  html: string,
  selectedCategorySet: Set<string>,
  isNewLocation: boolean,
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

      return selectedCategorySet.has(normalizedSectionName) ? content : "";
    },
  );

  return result.replace(/\{\{[#/]section:[^}]+\}\}/gi, "");
};
