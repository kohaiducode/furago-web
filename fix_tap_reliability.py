import re

def fix_tap_reliability():
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # The block to replace starts with: // 1. Gérer le clic simple sur un mot (tap-word) pour Android et Web
    # and ends before: // Fonction commune pour afficher le popup et traduire
    
    old_block_pattern = r"// 1\. Gérer le clic simple sur un mot[\s\S]*?// Fonction commune pour afficher le popup et traduire"
    
    new_block = """// Gestion avancée du "Tap" pour éviter les conflits avec la sélection native Android
  let tapStartX = 0;
  let tapStartY = 0;
  let tapStartTime = 0;

  document.addEventListener('pointerdown', (e) => {
      tapStartX = e.clientX;
      tapStartY = e.clientY;
      tapStartTime = Date.now();
      
      // Fermer le popup si on clique ailleurs
      if (dictPopup && !dictPopup.contains(e.target) && !e.target.closest('.tap-word')) {
          dictPopup.classList.add('hidden');
      }
  });

  document.addEventListener('pointerup', (e) => {
      if (readingView.classList.contains('hidden')) return;
      if (dictPopup && dictPopup.contains(e.target)) return;

      const tapEndTime = Date.now();
      const distance = Math.hypot(e.clientX - tapStartX, e.clientY - tapStartY);
      const timeElapsed = tapEndTime - tapStartTime;

      // 1. Détection d'un "Tap" intentionnel (rapide et sans défilement)
      if (timeElapsed < 450 && distance < 15) {
          let targetElement = e.target;
          if (targetElement && targetElement.nodeType === 3) targetElement = targetElement.parentElement;
          
          let wordElement = targetElement ? (targetElement.closest ? targetElement.closest('.tap-word') : null) : null;
          if (wordElement) {
              // C'est un tap ! On annule la sélection native d'Android pour cacher le menu "Copy/Share"
              window.getSelection().removeAllRanges();
              
              let text = wordElement.textContent.trim();
              let rect = wordElement.getBoundingClientRect();
              showDictionaryPopup(text, rect);
              return; // On arrête ici pour ne pas déclencher le mode sélection manuelle
          }
      }

      // 2. Détection de la sélection manuelle (Glisser ou Appui long)
      setTimeout(() => {
          const selection = window.getSelection();
          const text = selection.toString().trim();
          
          // Si l'utilisateur a vraiment surligné du texte (ex: 2 mots)
          if (text && text.length > 0 && text.length <= 50) {
              const range = selection.getRangeAt(0);
              const rect = range.getBoundingClientRect();
              showDictionaryPopup(text, rect);
          }
      }, 150);
  });

  // Fonction commune pour afficher le popup et traduire"""

    js = re.sub(old_block_pattern, new_block, js)
    
    # We also need to remove the previous pointerdown listener that was closing the popup
    old_pointerdown = r"// Fermer le popup si on clique ailleurs\s*document\.addEventListener\('pointerdown', \(e\) => \{\s*if \(dictPopup && !dictPopup\.contains\(e\.target\)\) \{\s*dictPopup\.classList\.add\('hidden'\);\s*\}\s*\}\);"
    js = re.sub(old_pointerdown, "", js)

    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

fix_tap_reliability()
