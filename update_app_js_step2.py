import re

def replace_function():
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    start_idx = js.find('async function showDictionaryPopup(text, rect)')
    if start_idx == -1:
        print("Function not found!")
        return

    # Find the matching closing brace for this function
    brace_count = 0
    end_idx = -1
    in_function = False
    
    for i in range(start_idx, len(js)):
        if js[i] == '{':
            if not in_function:
                in_function = True
            brace_count += 1
        elif js[i] == '}':
            brace_count -= 1
            if in_function and brace_count == 0:
                end_idx = i
                break
                
    old_func = js[start_idx:end_idx+1]

    new_show = """let currentDictData = null;

async function showDictionaryPopup(text, surroundingSentence, rect) {
    if (!text || text.length === 0 || !rect || (rect.width === 0 && rect.height === 0)) return;

    if (dictSaveBtn) {
      dictSaveBtn.style.color = "";
      dictSaveBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
    }
    
    dictWord.textContent = text;
    dictTranslation.innerHTML = '<div style="font-size:0.9rem; color:var(--text-muted);">翻訳中...</div>';
    
    dictPopup.classList.remove("hidden");

    let topPos = rect.top + window.scrollY - dictPopup.offsetHeight - 14;
    let leftPos = rect.left + window.scrollX + rect.width / 2;

    const minLeft = dictPopup.offsetWidth / 2 + 10;
    const maxLeft = window.innerWidth - dictPopup.offsetWidth / 2 - 10;
    if (leftPos < minLeft) leftPos = minLeft;
    if (leftPos > maxLeft) leftPos = maxLeft;

    if (topPos < window.scrollY + 10) {
      topPos = rect.bottom + window.scrollY + 14;
      dictPopup.classList.add("bottom-mode");
    } else {
      dictPopup.classList.remove("bottom-mode");
    }

    dictPopup.style.top = topPos + "px";
    dictPopup.style.left = leftPos + "px";

    const data = await DictionaryService.lookupWord(text, surroundingSentence);
    currentDictData = data;
    currentDictText = data.mot;

    let html = `
      <div style="margin-bottom: 8px;">
        <span style="background: var(--primary-light); color: var(--primary); padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; margin-right: 8px;">${data.nature}</span>
        <span style="font-weight: bold; font-size: 1.1rem;">${data.mot}</span>
      </div>
      <div style="background: var(--surface); padding: 8px; border-radius: 8px; margin-bottom: 8px; border-left: 3px solid var(--primary); font-size: 0.95rem; color: var(--text-main);">
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px; text-transform: uppercase;">文脈 (Contexte)</div>
        ${data.traductionPhrase}
      </div>
    `;

    if (data.definitions.length > 0) {
        html += `<div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px; margin-top: 12px; text-transform: uppercase;">辞書 (Dictionnaire)</div>`;
        html += `<ul style="margin: 0; padding-left: 16px; font-size: 0.9rem; color: var(--text-main);">`;
        data.definitions.forEach(d => {
            html += `<li style="margin-bottom: 4px;">${d}</li>`;
        });
        html += `</ul>`;
    } else {
        html += `<div style="font-size: 0.85rem; color: var(--text-muted); font-style: italic; margin-top: 12px;">辞書に定義が見つかりませんでした。</div>`;
    }

    dictTranslation.innerHTML = html;
    
    setTimeout(() => {
        if (!dictPopup.classList.contains("bottom-mode")) {
            let newTop = rect.top + window.scrollY - dictPopup.offsetHeight - 14;
            if (newTop > window.scrollY + 10) dictPopup.style.top = newTop + "px";
        }
    }, 50);
}
"""

    js = js.replace(old_func, new_show)
    
    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

replace_function()
