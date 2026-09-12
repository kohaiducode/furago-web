import re

def restore_nice_names():
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # The display part
    old_display = r"allLocalFrVoices\.forEach\(\(v, index\) => \{[\s\S]*?audioVoiceSelect\.appendChild\(option\);\s*\}\);"
    
    new_display = """let femaleNames = ["Sophie", "Camille", "Léa", "Alice", "Emma"];
                  let maleNames = ["Thomas", "Lucas", "Hugo", "Paul", "Arthur"];
                  let fIdx = 0;
                  let mIdx = 0;
                  
                  allLocalFrVoices.forEach((v, index) => {
                      const option = document.createElement('option');
                      option.value = index;
                      
                      let identifier = (v.voiceURI || v.name || '').toLowerCase();
                      let isFemale = false;
                      let isMale = false;
                      
                      if (/vlf|vld|vla|fra|frc|female|femme/i.test(identifier)) {
                          isFemale = true;
                      } else if (/vle|vlc|vlb|frb|frd|male|homme/i.test(identifier)) {
                          isMale = true;
                      } else {
                          // Fallback basé sur votre retour exact
                          if (index === 0 || index === 1 || index === 3 || index === 5) {
                              isFemale = true;
                          } else {
                              isMale = true;
                          }
                      }
                      
                      let displayName = "";
                      if (isFemale) {
                          displayName = `(女) ${femaleNames[fIdx % femaleNames.length]}`;
                          fIdx++;
                      } else {
                          displayName = `(男) ${maleNames[mIdx % maleNames.length]}`;
                          mIdx++;
                      }
                      
                      option.textContent = displayName;
                      audioVoiceSelect.appendChild(option);
                  });"""

    js = re.sub(old_display, new_display, js)

    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

restore_nice_names()
