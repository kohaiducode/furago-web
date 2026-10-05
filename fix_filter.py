import sys
import re

with open("src/components/FuragoApp.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Fix 1: Filter Modal Levels Translation
content = content.replace(
    """                      <button
                      key={lvl}
                      className="quiz-option"
                      style={{
                        borderColor:
                          globalLevel === lvl ? "var(--primary)" : "transparent",
                        background:
                          globalLevel === lvl ? "var(--primary-light)" : "var(--bg)",
                      }}
                      onClick={() => {
                        stopAudio();
                        setGlobalLevel(lvl);
                        if (currentArticle && currentArticle.levels[lvl]) {
                          buildQueueForText(currentArticle.levels[lvl].paragraphs);
                        }
                        setFilterModalType(null);
                      }}
                    >
                      {lvl}
                    </button>""",
    """                      <button
                      key={lvl}
                      className="quiz-option"
                      style={{
                        borderColor:
                          globalLevel === lvl ? "var(--primary)" : "transparent",
                        background:
                          globalLevel === lvl ? "var(--primary-light)" : "var(--bg)",
                      }}
                      onClick={() => {
                        stopAudio();
                        setGlobalLevel(lvl);
                        if (currentArticle && currentArticle.levels[lvl]) {
                          buildQueueForText(currentArticle.levels[lvl].paragraphs);
                        }
                        setFilterModalType(null);
                      }}
                    >
                      {t.levels[lvl as keyof typeof t.levels] || lvl}
                    </button>"""
)

# Fix 2: When appLang changes, reset selectedCategories
effect_old = """  useEffect(() => {
    const freshCats = new Set<string>();
    articles.forEach((a) => {
      if (a.category) freshCats.add((typeof a.category === "string" ? a.category : (a.category as any)?.[appLang] || "").trim());
    });
    setAllCategories(Array.from(freshCats));
  }, [articles, appLang]);"""

effect_new = """  useEffect(() => {
    const freshCats = new Set<string>();
    articles.forEach((a) => {
      if (a.category) freshCats.add((typeof a.category === "string" ? a.category : (a.category as any)?.[appLang] || "").trim());
    });
    setAllCategories(Array.from(freshCats));
    setSelectedCategories([]); // Clear selected categories when language changes so it doesn't break filter
  }, [articles, appLang]);"""

content = content.replace(effect_old, effect_new)

with open("src/components/FuragoApp.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Done fixing filter modal")
