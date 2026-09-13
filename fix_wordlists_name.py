import re

def fix_wordlists_name():
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    old_logic = r"let wordLists = JSON\.parse\(localStorage\.getItem\(\"furago_lists\"\)\) \|\| \[\s*\{ id: \"default\", name: \".*?\" \},\s*\];\s*if \(!Array\.isArray\(wordLists\) \|\| wordLists\.length === 0\) \{\s*wordLists = \[\{ id: \"default\", name: \".*?\" \}\];\s*localStorage\.setItem\(\"furago_lists\", JSON\.stringify\(wordLists\)\);\s*\}"

    new_logic = """let wordLists = JSON.parse(localStorage.getItem("furago_lists")) || [
    { id: "default", name: "デフォルト" },
  ];
  if (!Array.isArray(wordLists) || wordLists.length === 0) {
    wordLists = [{ id: "default", name: "デフォルト" }];
    localStorage.setItem("furago_lists", JSON.stringify(wordLists));
  }
  wordLists.forEach((l) => {
    if (l.id === "default" && l.name.includes("Tous les mots")) {
      l.name = "デフォルト";
    }
  });
  localStorage.setItem("furago_lists", JSON.stringify(wordLists));"""
    
    js = re.sub(old_logic, new_logic, js)

    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

fix_wordlists_name()
