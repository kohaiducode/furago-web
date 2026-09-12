import re

def set_random_names():
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # The old block
    old_block_pattern = r"let maleCount = 0;[\s\S]*?audioVoiceSelect\.appendChild\(option\);\s*\}\);"

    new_block = """let femaleNames = ["Sophie", "Camille", "Léa", "Alice", "Emma"];
                  let maleNames = ["Thomas", "Lucas", "Hugo", "Paul", "Arthur"];
                  let fIdx = 0;
                  let mIdx = 0;
                  
                  allLocalFrVoices.forEach((v, index) => {
                      const option = document.createElement('option');
                      option.value = index;
                      let vName = v.name.toLowerCase();
                      let isFemale = false;
                      let isMale = false;
                      
                      if (/hortense|julie|amelie|audrey|aurelie|alice|léa|roxane|carmit|vlf|vld|vla|female|femme/i.test(vName)) {
                          isFemale = true;
                      } else if (/paul|thomas|nicolas|david|henri|martin|claude|bernard|vle|vlc|vlb|male|homme/i.test(vName)) {
                          isMale = true;
                      } else {
                          // Si le système ne donne pas d'indice, on alterne Femme/Homme (typiquement Android)
                          if (index % 2 === 0) isFemale = true;
                          else isMale = true;
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

    js = re.sub(old_block_pattern, new_block, js)

    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

set_random_names()
