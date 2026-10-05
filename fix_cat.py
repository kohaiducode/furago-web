import sys

with open("src/components/FuragoApp.tsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    'a.category.fr',
    'a.category?.[appLang]'
)
content = content.replace(
    'article.category?.fr',
    'article.category?.[appLang]'
)

with open("src/components/FuragoApp.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Done fixing category lang")
