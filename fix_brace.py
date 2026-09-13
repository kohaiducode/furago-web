import re

def fix_dict_save_btn():
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # The broken block:
    old_block = r"const dictSaveBtn = document\.getElementById\('dict-save-btn'\);\s*if \(dictSaveBtn\) \{\s*dictSaveBtn\.style\.color = '';\s*dictSaveBtn\.innerHTML = `<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><line x1=\"12\" y1=\"5\" x2=\"12\" y2=\"19\"></line><line x1=\"5\" y1=\"12\" x2=\"19\" y2=\"12\"></line></svg>`;\s*"
    
    new_block = """if (dictSaveBtn) {
          dictSaveBtn.style.color = '';
          dictSaveBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
      }\n"""

    js = re.sub(old_block, new_block, js)
    
    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

fix_dict_save_btn()
