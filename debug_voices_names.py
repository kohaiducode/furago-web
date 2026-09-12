import re

def fix_duplicates_and_debug():
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # Deduplicate voices right after filtering
    old_filter = r"allLocalFrVoices = voices\.filter\(v => \{[\s\S]*?return l\.startsWith\('fr'\);\s*\}\);\s*\}"
    new_filter = """allLocalFrVoices = voices.filter(v => {
                const l = (v.lang || '').toLowerCase();
                const n = (v.name || '').toLowerCase();
                if (l.includes('fr-ca') || l.includes('canada') || n.includes('canada') || n.includes('canadien')) return false;
                // Retire les voix réseau (souvent des doublons des voix locales)
                if (n.includes('network') || n.includes('réseau')) return false;
                return l.startsWith('fr');
            });
            
            // Dédoublonnage basé sur l'identifiant de la voix
            const uniqueVoices = [];
            const seenUris = new Set();
            allLocalFrVoices.forEach(v => {
                let identifier = (v.voiceURI || v.name || '').toLowerCase().replace(/-local/g, '').replace(/-network/g, '').trim();
                if (!seenUris.has(identifier)) {
                    seenUris.add(identifier);
                    uniqueVoices.push(v);
                }
            });
            allLocalFrVoices = uniqueVoices;"""
            
    js = re.sub(old_filter, new_filter, js)
    
    # Change the UI display to show the ACTUAL name so the user can tell me what it is
    old_display = r"let femaleNames = \[\"Sophie\"[\s\S]*?audioVoiceSelect\.appendChild\(option\);\s*\}\);"
    new_display = """allLocalFrVoices.forEach((v, index) => {
                      const option = document.createElement('option');
                      option.value = index;
                      let vName = v.name || v.voiceURI || "Inconnu";
                      
                      // On affiche temporairement le VRAI nom système pour pouvoir les mapper
                      option.textContent = `🎤 ${vName.substring(0, 30)}`;
                      audioVoiceSelect.appendChild(option);
                  });"""

    js = re.sub(old_display, new_display, js)

    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

fix_duplicates_and_debug()
