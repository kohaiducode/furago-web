import re

def update_app_js():
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    dict_service_code = """
// -----------------------------------------------------
// 0. DICTIONARY SERVICE (OFFLINE)
// -----------------------------------------------------
const DictionaryService = {
  db: null,
  isLoaded: false,

  async init() {
    try {
      console.log("Loading offline dictionary...");
      const res = await fetch("assets/dict.json");
      this.db = await res.json();
      this.isLoaded = true;
      console.log("Offline dictionary loaded successfully.");
    } catch (e) {
      console.error("Failed to load offline dictionary", e);
    }
  },

  async lookupWord(word, surroundingSentence) {
    let cleanWord = word.toLowerCase().replace(/[.,!?:;"'()[\]]/g, '').trim();
    cleanWord = cleanWord.replace(/^(l'|d'|qu'|j'|m'|t'|s'|n'|c'|ç')/, '');

    let definitions = [];
    let posTags = [];
    
    if (this.isLoaded && this.db && this.db[cleanWord]) {
      const entries = this.db[cleanWord];
      entries.forEach(entry => {
         let jpWords = [...(entry.k || []), ...(entry.r || [])].filter(x => x);
         let jpTitle = jpWords.join(" / ");
         let gloss = (entry.g || []).join(", ");
         definitions.push(`【${jpTitle}】 ${gloss}`);
         if (entry.p) posTags.push(...entry.p);
      });
    }

    posTags = [...new Set(posTags)];
    let nature = posTags.length > 0 ? posTags.join(", ") : "inconnu";

    let traductionPhrase = "翻訳中...";
    try {
      const result = await Capacitor.Plugins.Translation.translate({
        text: surroundingSentence,
        sourceLanguage: "fr",
        targetLanguage: "ja"
      });
      traductionPhrase = result.translatedText;
    } catch (e) {
      console.error("ML Kit Error", e);
      traductionPhrase = "文脈の翻訳エラー";
    }

    return {
      mot: cleanWord,
      phraseOriginale: surroundingSentence,
      traductionPhrase: traductionPhrase,
      nature: nature,
      definitions: definitions,
      originalWord: word
    };
  }
};
"""
    if "DictionaryService = {" not in js:
        js = js.replace('// --- GESTION DU CLIC / TAP SIMPLE SUR UN MOT ---', dict_service_code + '\n// --- GESTION DU CLIC / TAP SIMPLE SUR UN MOT ---')

    if "DictionaryService.init();" not in js:
        js = re.sub(r"initVoices\(\);", "initVoices();\n    DictionaryService.init();", js)
    
    old_tap = """if (wordElement) {
      if(e.cancelable) e.preventDefault();
      let text = wordElement.textContent.trim();
      let rect = wordElement.getBoundingClientRect();
      showDictionaryPopup(text, rect);
    }"""
    
    new_tap = """if (wordElement) {
      if(e.cancelable) e.preventDefault();
      let text = wordElement.textContent.trim();
      let rect = wordElement.getBoundingClientRect();
      
      const paragraphText = wordElement.parentElement.textContent || "";
      const sentences = paragraphText.split(/(?<=[.!?])\\s+/);
      let surroundingSentence = sentences.find(s => s.includes(text)) || paragraphText;
      
      showDictionaryPopup(text, surroundingSentence, rect);
    }"""
    
    # We must format string replacing correctly to avoid whitespace issues
    # Just use regex with DOTALL to match the old block
    old_tap_re = r"if \(wordElement\) \{\s*if\s*\(e\.cancelable\)\s*e\.preventDefault\(\);\s*let text = wordElement\.textContent\.trim\(\);\s*let rect = wordElement\.getBoundingClientRect\(\);\s*showDictionaryPopup\(text,\s*rect\);\s*\}"
    js = re.sub(old_tap_re, new_tap.replace('\\', '\\\\'), js) # escape backslash for re.sub
    
    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

update_app_js()
