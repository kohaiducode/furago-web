import sys

with open("src/components/FuragoApp.tsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    'a.category?.[appLang]).trim()',
    '(a.category?.[appLang] || "")).trim()'
)

with open("src/components/FuragoApp.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Done fixing runtime safety")
