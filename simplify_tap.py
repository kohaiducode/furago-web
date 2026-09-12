import re

def simplify_tap_logic():
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # The block to replace starts with: // --- GESTION DU CLIC / TAP SUR MOBILE (100% FIABLE) ---
    # and ends before: // Gérer la sélection manuelle de texte (Glisser ou Appui long)
    
    old_block_pattern = r"// --- GESTION DU CLIC / TAP SUR MOBILE \(100% FIABLE\) ---[\s\S]*?\}\s*\n  \}\);\s*"
    
    new_block = """// --- GESTION DU CLIC / TAP SIMPLE SUR UN MOT ---
  document.addEventListener('pointerup', (e) => {
      if (readingView.classList.contains('hidden')) return;
      if (dictPopup && dictPopup.contains(e.target)) return;

      // Si du texte est déjà sélectionné nativement, on ne fait rien ici (laissé à selectionchange)
      const sel = window.getSelection();
      if (sel && sel.toString().trim().length > 0) {
          return;
      }

      // S'il n'y a pas de sélection, c'est un Tap pur !
      let targetElement = e.target;
      if (targetElement && targetElement.nodeType === 3) targetElement = targetElement.parentElement;
      
      let wordElement = targetElement ? (targetElement.closest ? targetElement.closest('.tap-word') : null) : null;
      if (wordElement) {
          let text = wordElement.textContent.trim();
          let rect = wordElement.getBoundingClientRect();
          showDictionaryPopup(text, rect);
      }
  });

  // Cacher le popup si on touche l'écran ailleurs (pointerdown)
  document.addEventListener('pointerdown', (e) => {
      if (dictPopup && !dictPopup.contains(e.target) && !e.target.closest('.tap-word')) {
          dictPopup.classList.add('hidden');
      }
  });\n\n  """

    js = re.sub(old_block_pattern, new_block, js)
    
    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

simplify_tap_logic()
