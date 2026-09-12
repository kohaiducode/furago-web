import re

def bulletproof_tap():
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # The block to replace starts with: // Gestion avancée du "Tap"
    # and ends before: // Fonction commune
    
    old_block_pattern = r"// Gestion avancée du \"Tap\"[\s\S]*?// 2\. Détection de la sélection manuelle[\s\S]*?\}, 150\);\s*\}\);"
    
    new_block = """// --- GESTION DU CLIC / TAP SUR MOBILE (100% FIABLE) ---
  let isScrolling = false;

  document.addEventListener('touchstart', (e) => {
      isScrolling = false;
      // Fermer le popup si on touche ailleurs
      if (dictPopup && !dictPopup.contains(e.target) && !e.target.closest('.tap-word')) {
          dictPopup.classList.add('hidden');
      }
  }, { passive: true });

  document.addEventListener('touchmove', () => {
      isScrolling = true;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
      if (readingView.classList.contains('hidden')) return;
      if (dictPopup && dictPopup.contains(e.target)) return;

      // Si l'utilisateur n'a pas fait défiler l'écran, c'est un Tap !
      if (!isScrolling) {
          let targetElement = e.target;
          if (targetElement && targetElement.nodeType === 3) targetElement = targetElement.parentElement;
          
          let wordElement = targetElement ? (targetElement.closest ? targetElement.closest('.tap-word') : null) : null;
          if (wordElement) {
              // C'est un tap direct sur un mot
              
              // On annule la sélection native
              const sel = window.getSelection();
              if (sel) sel.removeAllRanges();
              
              let text = wordElement.textContent.trim();
              let rect = wordElement.getBoundingClientRect();
              
              showDictionaryPopup(text, rect);
              
              // Empêche le comportement par défaut (comme la sélection native indésirable)
              if (e.cancelable) e.preventDefault();
              return;
          }
      }
  });

  // Gérer la sélection manuelle de texte (Glisser ou Appui long)
  // On utilise selectionchange qui est beaucoup plus fiable sur mobile
  document.addEventListener('selectionchange', () => {
      if (readingView.classList.contains('hidden')) return;
      
      const selection = window.getSelection();
      const text = selection.toString().trim();
      
      // Si l'utilisateur a vraiment surligné du texte (ex: 2 mots)
      if (text && text.length > 0 && text.length <= 50) {
          // Petit délai pour s'assurer que la sélection est finie
          setTimeout(() => {
              const latestText = window.getSelection().toString().trim();
              if (latestText === text) {
                  const range = window.getSelection().getRangeAt(0);
                  const rect = range.getBoundingClientRect();
                  showDictionaryPopup(latestText, rect);
              }
          }, 400);
      }
  });"""

    js = re.sub(old_block_pattern, new_block, js)
    
    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

bulletproof_tap()
