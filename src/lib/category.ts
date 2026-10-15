export type CategoryValue =
  | string
  | {
      fr?: string | null;
      ja?: string | null;
      en?: string | null;
    }
  | null
  | undefined;

type CategoryArticle = { category?: CategoryValue };

/** Returns the stable key used by category filters (Japanese label for localized categories). */
export const getCategoryKey = (category: CategoryValue): string =>
  (typeof category === "string" ? category : category?.ja || "").trim();

/** Returns the category label for a language, matching the existing UI fallbacks. */
export const getCategoryLabel = (
  category: CategoryValue,
  language: "fr" | "ja" | "en"
): string =>
  typeof category === "string" ? category : category?.[language] || category?.ja || "";

/** Returns the translated label for a category filter, falling back to its stable key. */
export const getCategoryFilterLabel = (
  category: CategoryValue,
  language: "fr" | "ja" | "en"
): string => {
  const key = getCategoryKey(category);
  if (language === "ja" || typeof category === "string") return key;
  return category?.[language] || key;
};

/** Extracts trimmed, non-empty category keys in deterministic lexical order. */
export const extractUniqueCategories = (
  articles: ReadonlyArray<CategoryArticle>
): string[] => {
  const categories = new Set<string>();

  articles.forEach(({ category }) => {
    const key = getCategoryKey(category);
    if (key) categories.add(key);
  });

  return Array.from(categories).sort();
};

/** Normalizes a category name for case- and whitespace-insensitive comparisons. */
export const normalizeCategoryName = (category: string): string =>
  category.trim().replace(/\s+/gu, " ").toLowerCase();
