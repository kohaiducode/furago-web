import re

def fix_highlight():
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    old_start = r"currentUtterance\.onstart = \(\) => \{"
    new_start = """// Surlignage synchrone immédiat (au cas où onstart bug sur Android)
    if (currentArticleData) renderArticleHTML(currentArticleData.content, item.start, item.length);
    
    currentUtterance.onstart = () => {"""
    js = re.sub(old_start, new_start, js)
    
    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

fix_highlight()
