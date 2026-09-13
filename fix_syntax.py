import re

def fix_syntax_error():
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    old_syntax = r"\} \|\| text\.length === 0 \|\| !rect \|\| \(rect\.width === 0 && rect\.height === 0\)\) return;"
    js = re.sub(old_syntax, "", js)

    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

fix_syntax_error()
