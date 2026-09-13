import re

def apply_new_fixes():
    # 1. Update style.css to kill native text selection and add toast styles
    with open('www/style.css', 'r', encoding='utf-8') as f:
        css = f.read()

    # Disable text selection on article content
    old_article = r"\.article-content \{\s*font-size: 1\.15rem;\s*line-height: 1\.7;\s*color: #333333;\s*\}"
    new_article = """.article-content {
    font-size: 1.15rem;
    line-height: 1.7;
    color: #333333;
    -webkit-user-select: none;
    user-select: none;
}"""
    css = re.sub(old_article, new_article, css)
    
    with open('www/style.css', 'w', encoding='utf-8') as f:
        f.write(css)

    # 2. Update app.js
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # a. Fix TTS Highlighting to Word-by-Word using onboundary
    # We find where currentUtterance is created and add onboundary
    old_tts = r"currentUtterance\.onend = \(\) => \{"
    new_tts = """currentUtterance.onstart = () => {
      // Surligne toute la phrase par défaut au début
      if (currentArticleData) renderArticleHTML(currentArticleData.content, item.start, item.length);
    };

    currentUtterance.onboundary = (e) => {
      // Surligne mot par mot pendant la lecture (si supporté par le téléphone)
      if (e.name === "word") {
        const textRemaining = item.text.substring(e.charIndex);
        const match = textRemaining.match(/^[a-zA-ZÀ-ÿœŒæÆ]+/);
        const wordLength = match ? match[0].length : 1;
        if (currentArticleData) {
          renderArticleHTML(
            currentArticleData.content,
            item.start + e.charIndex,
            wordLength
          );
        }
      }
    };

    currentUtterance.onend = () => {"""
    js = re.sub(old_tts, new_tts, js)

    # Remove the old static highlight call before utterance:
    # "if (currentArticleData) renderArticleHTML(currentArticleData.content, item.start, item.length);"
    # We replace it with nothing since it's now in onstart
    old_static_highlight = r"if \(currentArticleData\) renderArticleHTML\(currentArticleData\.content, item\.start, item\.length\);\s*currentUtterance = new SpeechSynthesisUtterance\(item\.text\);"
    new_static_highlight = "currentUtterance = new SpeechSynthesisUtterance(item.text);"
    js = re.sub(old_static_highlight, new_static_highlight, js)

    # b. Add Toast notification for save
    # Insert toast function at the top
    toast_func = """function showToast(message) {
  let toast = document.getElementById('furago-toast');
  if (!toast) {
      toast = document.createElement('div');
      toast.id = 'furago-toast';
      toast.style.cssText = 'position:fixed; top: 100px; left:50%; transform:translateX(-50%); background: var(--green); color: white; padding: 12px 24px; border-radius: 24px; font-weight: bold; font-size: 1rem; z-index: 99999; opacity: 0; transition: opacity 0.3s; pointer-events: none; box-shadow: 0 10px 25px rgba(0,0,0,0.2); display: flex; align-items: center; gap: 10px;';
      document.body.appendChild(toast);
  }
  toast.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> ${message}`;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 2000);
}\n\n"""
    
    js = toast_func + js

    # Replace old animation with toast
    old_anim = r"// Animation visuelle de succès avec un check vert[\s\S]*?\}, 1500\);"
    new_anim = """// Animation visuelle de succès (TOAST CLAIR)
              showToast("保存しました ! (Sauvegardé)");"""
    js = re.sub(old_anim, new_anim, js)
    
    # We must also hide the list selector modal AFTER a list is clicked and saved
    # Wait, the code already does listSelectorModal.classList.add('hidden') ? Let's check!
    # If not, let's inject it.
    old_list_click = r"listSelectorContainer\.appendChild\(btn\);\s*\}\);\s*listSelectorModal\.classList\.remove\(\"hidden\"\);"
    new_list_click = """btn.addEventListener('click', () => { listSelectorModal.classList.add("hidden"); });
                  listSelectorContainer.appendChild(btn);
              });
              listSelectorModal.classList.remove("hidden");"""
    js = re.sub(old_list_click, new_list_click, js)


    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)
        
    # Update index.html version
    with open('www/index.html', 'r', encoding='utf-8') as f:
        html = f.read()
    html = html.replace('app.js?v=30', 'app.js?v=31')
    html = html.replace('style.css?v=6', 'style.css?v=7')
    with open('www/index.html', 'w', encoding='utf-8') as f:
        f.write(html)

apply_new_fixes()
