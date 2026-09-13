import re

def update_app_js_step3():
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # 1. Update push logic
    old_push = r"savedWords\.push\(\{\s*fr: currentDictText,\s*ja: translationText,\s*listId: selectedListId,\s*date: new Date\(\)\.toISOString\(\),\s*\}\);"
    new_push = """savedWords.push({
              fr: currentDictData ? currentDictData.mot : currentDictText,
              ja: currentDictData ? currentDictData.traductionPhrase : translationText,
              nature: currentDictData ? currentDictData.nature : '',
              phraseOriginale: currentDictData ? currentDictData.phraseOriginale : '',
              definitions: currentDictData ? currentDictData.definitions : [],
              listId: selectedListId,
              date: new Date().toISOString(),
            });"""
    js = re.sub(old_push, new_push, js)

    # 2. Update renderSavedWords
    start_idx = js.find('function renderSavedWords(listId)')
    if start_idx != -1:
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
        
        new_func = """function renderSavedWords(listId) {
  const container = document.getElementById("saved-words-container");
  if (!container) return;
  container.innerHTML = "";

  const wordsInList = savedWords.filter((w) => w.listId === listId);

  if (wordsInList.length === 0) {
    container.innerHTML = `
            <div style="text-align:center; padding: 40px 20px; color: var(--text-muted);">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.5; margin-bottom:16px;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                <p>このリストは空です。<br>記事内で単語を選択して追加してください！</p>
            </div>`;
    return;
  }

  const reversedWords = [...wordsInList].reverse();

  reversedWords.forEach((word) => {
    const card = document.createElement("div");
    card.className = "quiz-card fade-in";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.gap = "12px";

    const realIndex = savedWords.findIndex(
      (w) => w.fr === word.fr && w.listId === word.listId,
    );
    
    // Header (Word + POS + Buttons)
    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "flex-start";
    
    let natureHtml = word.nature ? `<span style="background: var(--primary-light); color: var(--primary); padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; margin-bottom: 4px; display: inline-block;">${word.nature}</span>` : '';
    
    header.innerHTML = `
      <div>
          ${natureHtml}
          <h3 style="color:var(--primary); margin:0; font-size:1.2rem;">${word.fr}</h3>
      </div>
      <div style="display:flex; gap:8px;">
          <button class="btn-play-word" data-word="${word.fr.replace(/"/g, "&quot;")}" style="background:var(--bg); border:1px solid var(--border); color:var(--green); border-radius:50%; width:36px; height:36px; display:flex; align-items:center; justify-content:center; cursor:pointer;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
          </button>
          <button class="btn-delete-word" data-index="${realIndex}" style="background:var(--bg); border:1px solid var(--border); color:var(--red); border-radius:50%; width:36px; height:36px; display:flex; align-items:center; justify-content:center; cursor:pointer;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
      </div>
    `;
    
    // Body (Context Translation)
    const body = document.createElement("div");
    
    let contextHtml = '';
    if (word.phraseOriginale && word.traductionPhrase) {
        contextHtml = `
        <div style="background: var(--surface-light); padding: 8px; border-radius: 8px; border-left: 3px solid var(--primary); margin-bottom: 8px;">
            <div style="font-size: 0.85rem; color: var(--text-main); font-style: italic; margin-bottom: 4px;">"${word.phraseOriginale}"</div>
            <div style="font-size: 0.95rem; font-weight: 600; color: var(--text-main);">${word.traductionPhrase}</div>
        </div>
        `;
    } else {
        contextHtml = `<p style="font-weight:600; color:var(--text-main); font-size: 1rem; margin:0;">${word.ja}</p>`;
    }
    
    // Definitions Accordion
    let defsHtml = '';
    if (word.definitions && word.definitions.length > 0) {
        defsHtml = `
        <details style="margin-top: 4px; cursor: pointer;">
            <summary style="font-size: 0.85rem; color: var(--text-muted); outline: none;">辞書を見る (Voir dictionnaire)</summary>
            <ul style="margin: 8px 0 0 0; padding-left: 16px; font-size: 0.9rem; color: var(--text-main);">
                ${word.definitions.map(d => `<li style="margin-bottom:4px;">${d}</li>`).join('')}
            </ul>
        </details>
        `;
    }
    
    body.innerHTML = contextHtml + defsHtml;
    
    card.appendChild(header);
    card.appendChild(body);
    container.appendChild(card);
  });

  // Attach event listeners for delete and play
  const deleteBtns = container.querySelectorAll(".btn-delete-word");
  deleteBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"));
      if (confirm("この単語を削除しますか？")) {
        savedWords.splice(idx, 1);
        localStorage.setItem("furago_words", JSON.stringify(savedWords));
        renderSavedWords(listId);
      }
    });
  });

  const playBtns = container.querySelectorAll(".btn-play-word");
  playBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const text = btn.getAttribute("data-word");
      if (text) {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "fr-FR";
        u.rate = 0.9;
        const voices = speechSynthesis.getVoices();
        const localVoices = voices.filter(
          (v) => v.lang.startsWith("fr") && v.localService,
        );
        if (localVoices.length > 0) u.voice = localVoices[0];
        speechSynthesis.speak(u);
      }
    });
  });
}
"""
        js = js.replace(old_func, new_func)

    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

update_app_js_step3()
