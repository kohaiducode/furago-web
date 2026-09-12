import re

def remove_canada():
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    old_code = r"allLocalFrVoices = voices\.filter\(v => v\.lang\.startsWith\('fr'\) && !v\.name\.includes\('Google'\)\);\s*if \(allLocalFrVoices\.length === 0\) \{\s*allLocalFrVoices = voices\.filter\(v => v\.lang\.startsWith\('fr'\)\);\s*\}"

    new_code = """allLocalFrVoices = voices.filter(v => {
              const l = (v.lang || '').toLowerCase();
              const n = (v.name || '').toLowerCase();
              if (l.includes('fr-ca') || l.includes('canada') || n.includes('canada') || n.includes('canadien')) return false;
              return l.startsWith('fr') && !v.name.includes('Google');
          });
          if (allLocalFrVoices.length === 0) {
              allLocalFrVoices = voices.filter(v => {
                  const l = (v.lang || '').toLowerCase();
                  const n = (v.name || '').toLowerCase();
                  if (l.includes('fr-ca') || l.includes('canada') || n.includes('canada') || n.includes('canadien')) return false;
                  return l.startsWith('fr');
              });
          }"""

    js = re.sub(old_code, new_code, js)

    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

remove_canada()
