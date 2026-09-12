import re

def fix():
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # Hide nav and Show audio panel when opening article
    if "document.querySelector('.bottom-nav').classList.add('hidden');" not in js:
        js = js.replace('function openArticle(article, levelData) {', 
                        "function openArticle(article, levelData) {\n    document.querySelector('.bottom-nav').classList.add('hidden');\n    document.getElementById('audio-panel').classList.add('visible');")
    
    # Show nav and Hide audio panel when returning to home
    if "document.querySelector('.bottom-nav').classList.remove('hidden');" not in js:
        js = js.replace("backBtn.addEventListener('click', () => {", 
                        "backBtn.addEventListener('click', () => {\n    document.querySelector('.bottom-nav').classList.remove('hidden');\n    document.getElementById('audio-panel').classList.remove('visible');")

    # Date
    if "Ajouté le XX/XX/XXXX" in js:
        js = js.replace("<span>Ajouté le XX/XX/XXXX</span>", 
                        "<span>Ajouté le ${article.date || 'Récemment'}</span>")

    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

fix()
