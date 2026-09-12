import re

def fix_pointerup():
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    old_code = r"document\.addEventListener\('pointerup', \(e\) => \{\s*if \(readingView\.classList\.contains\('hidden'\)\) return;\s*if \(dictPopup && dictPopup\.contains\(e\.target\)\) return; // Ignorer les clics sur le popup\s*setTimeout\(async \(\) => \{\s*let text = \"\";\s*let rect = null;\s*// 1\. Vérifier si l'utilisateur a tapé sur un mot \(Single Tap\)\s*let wordElement = e\.target\.closest\('\.tap-word'\);"

    new_code = """document.addEventListener('pointerup', (e) => {
    if (readingView.classList.contains('hidden')) return;
    if (dictPopup && dictPopup.contains(e.target)) return; // Ignorer les clics sur le popup

    // Capturer la cible AVANT le setTimeout pour éviter qu'elle soit perdue
    let targetElement = e.target;
    // Si c'est un noeud de texte (nodeType 3), on prend le parent (le span)
    if (targetElement && targetElement.nodeType === 3) {
        targetElement = targetElement.parentElement;
    }

    setTimeout(async () => {
        let text = "";
        let rect = null;

        // 1. Vérifier si l'utilisateur a tapé sur un mot (Single Tap)
        let wordElement = targetElement ? (targetElement.closest ? targetElement.closest('.tap-word') : null) : null;"""

    js = re.sub(old_code, new_code, js)

    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

fix_pointerup()
