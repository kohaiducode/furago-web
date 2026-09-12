import re

def implement_tap_and_translate():
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # 1. Modify renderArticleHTML to wrap words in spans
    # We replace the function entirely for safety
    old_render = r"function renderArticleHTML\(text, highlightStart = -1, highlightLength = 0\) \{[\s\S]*?updateProgressUI\(\);\s*\}"
    
    new_render = """function renderArticleHTML(text, highlightStart = -1, highlightLength = 0) {
        if (!text) return;
        
        // Fonction qui enveloppe chaque mot d'un span pour permettre le clic
        function wrapWords(str) {
            // [a-zA-ZÀ-ÿœŒæÆ]+ couvre tous les mots français classiques avec accents
            return str.replace(/([a-zA-ZÀ-ÿœŒæÆ]+)/g, '<span class="tap-word">$1</span>');
        }

        let html = '';
        let currentIndex = 0;
        
        const paragraphs = text.split('\\n');
        
        paragraphs.forEach(pText => {
            if (pText.trim() === '') {
                currentIndex += pText.length + 1; // +1 pour le retour à la ligne
                return;
            }
            
            const pStart = currentIndex;
            const pEnd = currentIndex + pText.length;
            
            if (highlightStart >= pStart && highlightStart < pEnd) {
                // Le surlignage se trouve dans ce paragraphe
                const localStart = highlightStart - pStart;
                const localLength = highlightLength;
                
                const before = wrapWords(pText.substring(0, localStart));
                const highlight = wrapWords(pText.substring(localStart, localStart + localLength));
                const after = wrapWords(pText.substring(localStart + localLength));
                
                html += `<p>${before}<span class="highlight">${highlight}</span>${after}</p>`;
            } else {
                html += `<p>${wrapWords(pText)}</p>`;
            }
            currentIndex += pText.length + 1;
        });
        
        articleContent.innerHTML = html;
        updateProgressUI();
    }"""
    
    js = re.sub(old_render, new_render, js)
    
    # 2. Modify the popup logic
    # Replace the whole pointerup listener and translation logic
    old_pointerup = r"document\.addEventListener\('pointerup', \(e\) => \{[\s\S]*?\}\);\s*// Écouter le bouton audio du dictionnaire"
    
    new_pointerup = """// Ne déclencher la traduction QUE lorsqu'on relâche la souris/le doigt, ou qu'on clique sur un mot
document.addEventListener('pointerup', (e) => {
    if (readingView.classList.contains('hidden')) return;
    if (dictPopup && dictPopup.contains(e.target)) return; // Ignorer les clics sur le popup

    setTimeout(async () => {
        let text = "";
        let rect = null;

        // 1. Vérifier si l'utilisateur a tapé sur un mot (Single Tap)
        let wordElement = e.target.closest('.tap-word');
        if (wordElement) {
            text = wordElement.textContent.trim();
            rect = wordElement.getBoundingClientRect();
        } else {
            // 2. Fallback: Vérifier si l'utilisateur a sélectionné manuellement du texte
            const selection = window.getSelection();
            text = selection.toString().trim();
            if (text && text.length > 0 && text.length <= 50) {
                const range = selection.getRangeAt(0);
                rect = range.getBoundingClientRect();
            }
        }

        if (!text || text.length === 0 || text.length > 50 || !rect || (rect.width === 0 && rect.height === 0)) {
            // Rien sélectionné
            return;
        }

        dictWord.textContent = text;
        currentDictText = text;
        dictPopup.classList.remove('hidden');
        
        let topPos = rect.top + window.scrollY - dictPopup.offsetHeight - 14;
        let leftPos = rect.left + window.scrollX + (rect.width / 2);
        
        const minLeft = (dictPopup.offsetWidth / 2) + 10;
        const maxLeft = window.innerWidth - (dictPopup.offsetWidth / 2) - 10;
        if(leftPos < minLeft) leftPos = minLeft;
        if(leftPos > maxLeft) leftPos = maxLeft;

        if (topPos < window.scrollY + 10) {
            topPos = rect.bottom + window.scrollY + 14;
            dictPopup.classList.add('arrow-top');
        } else {
            dictPopup.classList.remove('arrow-top');
        }

        dictPopup.style.top = `${topPos}px`;
        dictPopup.style.left = `${leftPos}px`;

        // Utilisation du cache
        const cacheKey = text.toLowerCase();
        if (translationCache.has(cacheKey)) {
            dictTranslation.textContent = translationCache.get(cacheKey);
            return;
        }

        dictTranslation.innerHTML = '<span style="color:#8E8E93; font-size:0.9rem;">翻訳中...</span>';

        try {
            let translationStr = "";

            // Tente d'utiliser Google ML Kit (Traduction native, hors-ligne et gratuite)
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Translation) {
                try {
                    const resML = await window.Capacitor.Plugins.Translation.translate({
                        text: text,
                        sourceLanguage: 'fr',
                        targetLanguage: 'ja'
                    });
                    if (resML && resML.text) {
                        translationStr = resML.text;
                    }
                } catch (mlErr) {
                    console.log("ML Kit unavailable or model not downloaded, falling back to API.", mlErr);
                }
            }

            // Fallback API Chrome Extension
            if (!translationStr) {
                const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=fr&tl=ja&dt=t&q=${encodeURIComponent(text)}`);
                if (!res.ok) throw new Error("API Limit");
                const data = await res.json();
                translationStr = data[0].map(item => item[0]).join('');
            }
            
            dictTranslation.textContent = translationStr;
            translationCache.set(cacheKey, translationStr); // Sauvegarde dans le cache
            
            if (!dictPopup.classList.contains('arrow-top')) {
                dictPopup.style.top = `${rect.top + window.scrollY - dictPopup.offsetHeight - 14}px`;
            }
        } catch (err) {
            dictTranslation.textContent = '一時的な制陁E(Trop de requêtes)';
        }
    }, 50); // Petit délai pour laisser le clic se résoudre
});

// Téléchargement des modèles ML Kit en arrière-plan à l'ouverture d'un article
function preloadMLKitModels() {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Translation) {
        window.Capacitor.Plugins.Translation.downloadModel({ language: 'fr' }).catch(() => {});
        window.Capacitor.Plugins.Translation.downloadModel({ language: 'ja' }).catch(() => {});
    }
}
// Écouter le bouton audio du dictionnaire"""
    
    js = re.sub(old_pointerup, new_pointerup, js)

    # Add preloadMLKitModels call to openArticle
    old_openArticle = r"// Réinitialiser Audio\s*if \(window\.speechSynthesis"
    new_openArticle = """// Précharger les modèles de traduction ML Kit (silencieux)
    if (typeof preloadMLKitModels === 'function') preloadMLKitModels();
    
    // Réinitialiser Audio
    if (window.speechSynthesis"""
    js = re.sub(old_openArticle, new_openArticle, js)

    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

implement_tap_and_translate()
