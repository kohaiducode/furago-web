import re

def refactor_popup_logic():
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # The block to replace starts with: document.addEventListener('pointerdown', (e) => {
    # and ends right before: // Téléchargement des modèles ML Kit
    
    old_block_pattern = r"// Fermer le popup si on clique ailleurs[\s\S]*?// Téléchargement des modèles ML Kit"
    
    new_block = """// Fermer le popup si on clique ailleurs
  document.addEventListener('pointerdown', (e) => {
      if (dictPopup && !dictPopup.contains(e.target)) {
          dictPopup.classList.add('hidden');
      }
  });
  
  // 1. Gérer le clic simple sur un mot (tap-word) pour Android et Web
  document.addEventListener('click', (e) => {
      if (readingView.classList.contains('hidden')) return;
      if (dictPopup && dictPopup.contains(e.target)) return;
      
      let targetElement = e.target;
      if (targetElement && targetElement.nodeType === 3) targetElement = targetElement.parentElement;
      
      let wordElement = targetElement ? (targetElement.closest ? targetElement.closest('.tap-word') : null) : null;
      if (wordElement) {
          let text = wordElement.textContent.trim();
          let rect = wordElement.getBoundingClientRect();
          showDictionaryPopup(text, rect);
      }
  });

  // 2. Gérer la sélection manuelle de texte (glisser ou appui long)
  document.addEventListener('pointerup', (e) => {
      if (readingView.classList.contains('hidden')) return;
      if (dictPopup && dictPopup.contains(e.target)) return;

      setTimeout(() => {
          const selection = window.getSelection();
          const text = selection.toString().trim();
          if (text && text.length > 0 && text.length <= 50) {
              const range = selection.getRangeAt(0);
              const rect = range.getBoundingClientRect();
              showDictionaryPopup(text, rect);
          }
      }, 100);
  });

  // Fonction commune pour afficher le popup et traduire
  async function showDictionaryPopup(text, rect) {
      if (!text || text.length === 0 || !rect || (rect.width === 0 && rect.height === 0)) return;

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

      const cacheKey = text.toLowerCase();
      if (translationCache.has(cacheKey)) {
          dictTranslation.textContent = translationCache.get(cacheKey);
          return;
      }

      dictTranslation.innerHTML = '<span style="color:#8E8E93; font-size:0.9rem;">翻訳中...</span>';

      try {
          let translationStr = "";

          if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Translation) {
              try {
                  const resML = await window.Capacitor.Plugins.Translation.translate({
                      text: text,
                      sourceLanguage: 'fr',
                      targetLanguage: 'ja'
                  });
                  if (resML && resML.text) translationStr = resML.text;
              } catch (mlErr) {
                  console.log("ML Kit error", mlErr);
              }
          }

          if (!translationStr) {
              const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=fr&tl=ja&dt=t&q=${encodeURIComponent(text)}`);
              if (!res.ok) throw new Error("API Limit");
              const data = await res.json();
              translationStr = data[0].map(item => item[0]).join('');
          }
          
          dictTranslation.textContent = translationStr;
          translationCache.set(cacheKey, translationStr);
          
          if (!dictPopup.classList.contains('arrow-top')) {
              dictPopup.style.top = `${rect.top + window.scrollY - dictPopup.offsetHeight - 14}px`;
          }
      } catch (err) {
          dictTranslation.textContent = '一時的な制陁E(Trop de requêtes)';
      }
  }

  // Téléchargement des modèles ML Kit"""

    js = re.sub(old_block_pattern, new_block, js)

    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

refactor_popup_logic()
