import re

def debug_voices():
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    old_code = r"displayName = `\(他\) \$\{otherCount\}`;"
    new_code = r"displayName = `(他) ${v.name.replace('fr-FR', '').replace('fr-fr', '').substring(0, 12)}`;"

    js = re.sub(old_code, new_code, js)

    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

debug_voices()
