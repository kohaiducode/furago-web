import re

def fix_icons():
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # Change sizes
    js = js.replace('<svg width="20" height="20"', '<svg width="36" height="36"')
    
    # Do not hide btnRestart
    js = js.replace("btnRestart.classList.add('hidden');", "")
    js = js.replace("btnRestart.classList.remove('hidden');", "")

    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

fix_icons()
