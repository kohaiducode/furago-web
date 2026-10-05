import sys

with open("src/components/FuragoApp.tsx", "r", encoding="utf-8") as f:
    lines = f.read().split('\n')

content = '\n'.join(lines)

# Insert i18n states
i18n_states = """  // i18n States
  const [appLang, setAppLang] = useState<AppLanguage>("ja");
  const t = getTranslation(appLang);
  const [showTranslation, setShowTranslation] = useState<boolean>(false);
  const [translatedQuizIds, setTranslatedQuizIds] = useState<Record<string, boolean>>({});
"""
content = content.replace(
    '  const [activeView, setActiveView] = useState<"home" | "reading" | "words">("home");',
    '  const [activeView, setActiveView] = useState<"home" | "reading" | "words">("home");\n\n' + i18n_states
)

# Remove leadGender
content = content.replace('  const [leadGender, setLeadGender] = useState<string>("");\n', '')
content = content.replace('const [leadLevel, setLeadLevel] = useState<string>("A1");', 'const [leadLevel, setLeadLevel] = useState<string>("LVL_1");')
content = content.replace('const [globalLevel, setGlobalLevel] = useState<string>("A1");', 'const [globalLevel, setGlobalLevel] = useState<string>("LVL_1");')


with open("src/components/FuragoApp.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Done fixing states")
