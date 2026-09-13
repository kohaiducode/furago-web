import re

def rewrite_tap():
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # The block starts at: // Cacher le popup si on touche l'écran ailleurs (pointerdown)
    # and ends at the end of the click listener.
    # We will replace the entire logic.
    
    # Let's find the boundaries using regex
    old_logic = r"// --- GESTION DU CLIC / TAP SIMPLE SUR UN MOT ---[\s\S]*?\}\);\s*// Cacher le popup si on touche l'écran ailleurs \(pointerdown\)[\s\S]*?\}\s*\}\);"
    
    new_logic = """// --- GESTION DU CLIC / TAP SIMPLE SUR UN MOT ---
  let tapStartX = 0;
  let tapStartY = 0;

  document.addEventListener("pointerdown", (e) => {
    tapStartX = e.clientX;
    tapStartY = e.clientY;
    
    if (
      dictPopup &&
      !dictPopup.contains(e.target) &&
      !e.target.closest(".tap-word")
    ) {
      dictPopup.classList.add("hidden");
    }
  });

  document.addEventListener("pointerup", (e) => {
    if (readingView.classList.contains("hidden")) return;
    if (dictPopup && dictPopup.contains(e.target)) return;

    // Si l'utilisateur a fait défiler l'écran de plus de 10 pixels, on annule le Tap
    if (Math.abs(e.clientX - tapStartX) > 10 || Math.abs(e.clientY - tapStartY) > 10) {
        return;
    }

    let targetElement = e.target;
    if (targetElement && targetElement.nodeType === 3)
      targetElement = targetElement.parentElement;

    let wordElement = targetElement
      ? targetElement.closest
        ? targetElement.closest(".tap-word")
        : null
      : null;

    if (wordElement) {
      if(e.cancelable) e.preventDefault();
      let text = wordElement.textContent.trim();
      let rect = wordElement.getBoundingClientRect();
      showDictionaryPopup(text, rect);
    }
  });"""
  
    js = re.sub(old_logic, new_logic, js)

    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

rewrite_tap()
