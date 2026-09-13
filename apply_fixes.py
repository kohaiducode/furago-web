import re

def apply_fixes():
    # 1. Update app.js
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # a. Fix TTS Highlighting
    js = js.replace('<span class="highlight">', '<span class="tts-highlight">')

    # b. Bottom nav hardware back button
    old_back = r"if \(!readingView\.classList\.contains\('hidden'\)\) \{\s*if \(window\.speechSynthesis && window\.speechSynthesis\.cancel\) window\.speechSynthesis\.cancel\(\);\s*if \(currentArticleData\) renderArticleHTML\(currentArticleData\.content, -1, 0\);\s*renderHome\(\);\s*\}"
    new_back = """if (!readingView.classList.contains('hidden')) {
              if (window.speechSynthesis && window.speechSynthesis.cancel) window.speechSynthesis.cancel();
              if (currentArticleData) renderArticleHTML(currentArticleData.content, -1, 0);
              document.querySelector('.bottom-nav').classList.remove('hidden');
              audioPanel.classList.remove('visible');
              renderHome();
          }"""
    js = re.sub(old_back, new_back, js)

    # c. Change prompt
    js = js.replace('prompt("Nouveau nom de liste (ex: Verbes, Chapitre 1) :");', 'prompt("新しいリストの名前を入力してください：");')

    # d. Fix save button reset state in showDictionaryPopup
    old_show = r"async function showDictionaryPopup\(text, rect\) \{\s*if \(!text"
    new_show = """async function showDictionaryPopup(text, rect) {
      if (!text || text.length === 0 || !rect || (rect.width === 0 && rect.height === 0)) return;

      const dictSaveBtn = document.getElementById('dict-save-btn');
      if (dictSaveBtn) {
          dictSaveBtn.style.color = '';
          dictSaveBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
      }"""
    js = re.sub(old_show, new_show, js)

    # e. Animate save button with green checkmark
    old_save_anim = r"// Animation visuelle de succès\s*dictSaveBtn\.style\.color = '#FF9500'; // Orange\s*dictSaveBtn\.innerHTML = `<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"currentColor\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z\"></path></svg>`;"
    new_save_anim = """// Animation visuelle de succès avec un check vert
                          dictSaveBtn.style.color = 'var(--green)';
                          dictSaveBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                          setTimeout(() => {
                              dictSaveBtn.style.color = '';
                              dictSaveBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
                          }, 1500);"""
    js = re.sub(old_save_anim, new_save_anim, js)
    
    # Optional code cleanup (minor formatting)
    js = js.replace('\n\n\n', '\n\n')

    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)


    # 2. Update index.html
    with open('www/index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # Add 0.4 speed option
    old_speed = r'<option value="0.6">速度 : とても遅い \(0.6x\)</option>'
    new_speed = '<option value="0.6">速度 : とても遅い (0.6x)</option>\n                        <option value="0.4">速度 : 最も遅い (0.4x)</option>'
    html = re.sub(old_speed, new_speed, html)
    
    html = html.replace('app.js?v=28', 'app.js?v=29')

    with open('www/index.html', 'w', encoding='utf-8') as f:
        f.write(html)


apply_fixes()
