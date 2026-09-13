import re

def use_click_for_tap():
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    old_pointerup = r"// --- GESTION DU CLIC / TAP SIMPLE SUR UN MOT ---\s*document\.addEventListener\('pointerup', \(e\) => \{"
    new_click = """// --- GESTION DU CLIC / TAP SIMPLE SUR UN MOT ---
  document.addEventListener('click', (e) => {"""
    js = re.sub(old_pointerup, new_click, js)
    
    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

use_click_for_tap()
