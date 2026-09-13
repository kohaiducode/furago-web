import re

def remove_french_from_html():
    with open('www/index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # 1. Remove " (Annuler)"
    html = html.replace('キャンセル (Annuler)', 'キャンセル')
    
    # 2. Change "Choisir une liste"
    html = html.replace('>Choisir une liste<', '>リストを選ぶ<')

    # Bump version
    html = html.replace('app.js?v=35', 'app.js?v=36')
    html = html.replace('style.css?v=8', 'style.css?v=9')

    with open('www/index.html', 'w', encoding='utf-8') as f:
        f.write(html)

remove_french_from_html()
