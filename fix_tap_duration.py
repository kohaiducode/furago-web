import re

def fix_tap_duration():
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # We need to capture touchStartTime to measure tap duration
    old_block = r"let isScrolling = false;\s*document\.addEventListener\('touchstart', \(e\) => \{"
    new_block = """let isScrolling = false;
  let tapStartTime = 0;

  document.addEventListener('touchstart', (e) => {
      tapStartTime = Date.now();
      isScrolling = false;"""
    js = re.sub(old_block, new_block, js)

    old_touchend = r"if \(!isScrolling\) \{"
    new_touchend = """const touchDuration = Date.now() - tapStartTime;
      
      // Si c'est un Tap rapide (moins de 350ms) et sans défilement
      if (!isScrolling && touchDuration < 350) {"""
    js = re.sub(old_touchend, new_touchend, js)

    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

    # 2. Update CSS for .tap-word
    with open('www/style.css', 'r', encoding='utf-8') as f:
        css = f.read()

    old_css = r"\/\* Contenu de l'article \*\/"
    new_css = """/* Contenu de l'article */
.tap-word {
    cursor: pointer;
    touch-action: manipulation;
    -webkit-touch-callout: none;
}"""
    css = re.sub(old_css, new_css, css)

    with open('www/style.css', 'w', encoding='utf-8') as f:
        f.write(css)

fix_tap_duration()
