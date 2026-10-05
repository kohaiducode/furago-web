import sys

with open("src/components/FuragoApp.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Fix categories
def get_cat_str(cat_var):
    return f'(typeof {cat_var} === "string" ? {cat_var} : {cat_var}?.[appLang] || "")'

content = content.replace(
    'if (a.category) initCats.add(a.category.trim());',
    'if (a.category) initCats.add((typeof a.category === "string" ? a.category : a.category.fr).trim());'
)
content = content.replace(
    'if (a.category) freshCats.add(a.category.trim());',
    'if (a.category) freshCats.add((typeof a.category === "string" ? a.category : a.category.fr).trim());'
)
content = content.replace(
    'const cat = (article.category || "").trim();',
    'const cat = (typeof article.category === "string" ? article.category : article.category?.fr || "").trim();'
)

# Fix reading page Header title & Content
old_title = '<h2 lang="fr">{currentLevelData.title}</h2>'
new_title = '<h2 lang="fr">{typeof currentLevelData.title === "string" ? currentLevelData.title : (currentLevelData.title as any)?.fr}</h2>'
content = content.replace(old_title, new_title)

old_cat = '{currentArticle.category || "一般"}'
new_cat = '{typeof currentArticle.category === "string" ? currentArticle.category : (currentArticle.category as any)?.[appLang] || "General"}'
content = content.replace(old_cat, new_cat)

old_render = '{renderInteractiveContent(currentLevelData.content)}'
new_render = '{renderInteractiveContent(currentLevelData.paragraphs)}'
content = content.replace(old_render, new_render)


with open("src/components/FuragoApp.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Done fixing TS errors")
