import { describe, expect, it } from "vitest";
import {
  extractUniqueCategories,
  getCategoryFilterLabel,
  getCategoryKey,
  getCategoryLabel,
  normalizeCategoryName,
} from "./category";

describe("category helpers", () => {
  describe("extractUniqueCategories", () => {
    it("trims categories, removes duplicates and ignores missing or empty values", () => {
      const articles = [
        { category: "  Tech  " },
        { category: "Culture" },
        { category: "Tech" },
        { category: null },
        {},
        { category: " \t " },
        { category: " Travel " },
      ];

      expect(extractUniqueCategories(articles)).toEqual(["Culture", "Tech", "Travel"]);
    });

    it("returns an empty array for an empty article list", () => {
      expect(extractUniqueCategories([])).toEqual([]);
    });

    it("sorts category keys deterministically regardless of article order", () => {
      const firstOrder = [{ category: "Zulu" }, { category: "Alpha" }, { category: "Média" }];
      const secondOrder = [...firstOrder].reverse();

      expect(extractUniqueCategories(firstOrder)).toEqual(["Alpha", "Média", "Zulu"]);
      expect(extractUniqueCategories(secondOrder)).toEqual(extractUniqueCategories(firstOrder));
    });

    it("uses the Japanese key for localized article categories", () => {
      expect(extractUniqueCategories([
        { category: { fr: "Culture", ja: "  文化  ", en: "Culture" } },
      ])).toEqual(["文化"]);
    });
  });

  describe("normalizeCategoryName", () => {
    it("trims, collapses whitespace and lowercases category names", () => {
      expect(normalizeCategoryName("  Science   &\n  Tech  ")).toBe("science & tech");
      expect(normalizeCategoryName("ÉCONOMIE")).toBe("économie");
      expect(normalizeCategoryName("旅行")).toBe("旅行");
    });
  });

  describe("category keys and labels", () => {
    it("keeps trimmed keys aligned with labels used by the filter", () => {
      const category = { fr: "Culture", ja: "  文化 ", en: "Culture" };

      expect(getCategoryKey(category)).toBe("文化");
      expect(getCategoryLabel(category, "fr")).toBe("Culture");
      expect(getCategoryLabel(category, "ja")).toBe("  文化 ");
      expect(getCategoryFilterLabel(category, "fr")).toBe("Culture");
      expect(getCategoryFilterLabel(category, "ja")).toBe("文化");
    });

    it("preserves plain string labels and uses Japanese as a translation fallback", () => {
      expect(getCategoryKey("  Tech ")).toBe("Tech");
      expect(getCategoryLabel("  Tech ", "fr")).toBe("  Tech ");
      expect(getCategoryFilterLabel("  Tech ", "fr")).toBe("Tech");
      expect(getCategoryFilterLabel({ ja: "旅行" }, "en")).toBe("旅行");
      expect(getCategoryLabel({ ja: "旅行" }, "en")).toBe("旅行");
    });
  });
});
