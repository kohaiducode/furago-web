import re

def remove_alice():
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # The display part
    old_display = r"allLocalFrVoices\.forEach\(\(v, index\) => \{\s*const option = document\.createElement\('option'\);"
    
    new_display = """allLocalFrVoices.forEach((v, index) => {
                      // Retire la voix d'Alice (index 5) car c'est un doublon
                      if (index === 5) return;
                      
                      const option = document.createElement('option');"""

    js = re.sub(old_display, new_display, js)

    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

remove_alice()
