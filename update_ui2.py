import re

def update():
    with open('www/index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # 1. Remove fab-audio
    html = re.sub(r'<!-- Bouton Flottant Audio -->\s*<button id="fab-audio" class="fab-audio">.*?</button>', '', html, flags=re.DOTALL)

    # 2. Update audio-panel header
    html = html.replace('<h4>読み上げ</h4>', '<h4>音声読み上げ</h4>')

    # 3. Update audio controls
    old_controls = """<div class="audio-controls">
                    <button id="btn-play-pause" class="btn-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                        再生
                    </button>
                    <button id="btn-restart" class="btn-icon hidden">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v6h6"></path><path d="M3 8A9 9 0 1 1 12 21a9 9 0 0 1-9-9"></path></svg>
                        最初から
                    </button>
                </div>"""
                
    new_controls = """<div class="audio-controls" style="display: flex; gap: 10px; justify-content: center; align-items: center; width: 100%;">
                    <button id="btn-restart" class="btn-icon" style="flex: 1; padding: 10px 5px; flex-direction: column; align-items: center;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v6h6"></path><path d="M3 8A9 9 0 1 1 12 21a9 9 0 0 1-9-9"></path></svg>
                        最初から
                    </button>
                    <button id="btn-prev-sentence" class="btn-icon" style="flex: 1; padding: 10px 5px; flex-direction: column; align-items: center;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>
                        -1 文
                    </button>
                    <button id="btn-play-pause" class="btn-icon" style="flex: 1; padding: 10px 5px; background: var(--primary); color: white; border-radius: 12px; flex-direction: column; align-items: center;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                        再生
                    </button>
                    <button id="btn-next-sentence" class="btn-icon" style="flex: 1; padding: 10px 5px; flex-direction: column; align-items: center;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
                        +1 文
                    </button>
                </div>"""

    # We use regex
    html = re.sub(r'<div class="audio-controls">.*?</div>', new_controls, html, count=1, flags=re.DOTALL)

    # 4. Remove btn-close-audio entirely so it stays sticky!
    html = re.sub(r'<button id="btn-close-audio" class="btn-close-audio">.*?</button>', '', html, flags=re.DOTALL)

    with open('www/index.html', 'w', encoding='utf-8') as f:
        f.write(html)

    # Now app.js
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # Hide nav and Show audio panel when opening article
    # In function renderArticle
    js = js.replace('function renderArticle(article) {', 
                    "function renderArticle(article) {\n    document.querySelector('.bottom-nav').classList.add('hidden');\n    audioPanel.classList.add('visible');")
    
    # Show nav and Hide audio panel when returning to home
    js = js.replace("backBtn.addEventListener('click', () => {", 
                    "backBtn.addEventListener('click', () => {\n    document.querySelector('.bottom-nav').classList.remove('hidden');\n    audioPanel.classList.remove('visible');")

    # Date
    js = js.replace("<span>Ajouté le XX/XX/XXXX</span>", 
                    "<span>Ajouté le ${article.date || 'Récemment'}</span>")

    # Clean up fabAudio variables
    lines = js.split('\n')
    new_lines = []
    skip = False
    for i, line in enumerate(lines):
        if "const fabAudio =" in line:
            continue
        if "fabAudio.style" in line:
            continue
        if "fabAudio.addEventListener('click'" in line:
            skip = True
            continue
        if skip and "});" in line:
            skip = False
            continue
        if skip:
            continue
        
        # Remove btn-close-audio listener
        if "btnCloseAudio.addEventListener('click'" in line:
            skip = True
            continue
            
        new_lines.append(line)
        
    js = '\n'.join(new_lines)

    # Add btn doms
    new_doms = """const btnPrevSentence = document.getElementById('btn-prev-sentence');
const btnNextSentence = document.getElementById('btn-next-sentence');"""
    js = js.replace("const btnRestart = document.getElementById('btn-restart');", "const btnRestart = document.getElementById('btn-restart');\n" + new_doms)

    # Add Logic for prev next
    logic = """
if (btnPrevSentence) {
    btnPrevSentence.addEventListener('click', () => {
        if (currentQueueIndex > 0) {
            currentQueueIndex--;
            if (isPlaying) {
                if(window.speechSynthesis) window.speechSynthesis.cancel();
                playNextInQueue();
            } else {
                updateProgressUI();
                highlightCurrentSentence();
            }
        }
    });
}
if (btnNextSentence) {
    btnNextSentence.addEventListener('click', () => {
        if (currentQueueIndex < ttsQueue.length - 1) {
            currentQueueIndex++;
            if (isPlaying) {
                if(window.speechSynthesis) window.speechSynthesis.cancel();
                playNextInQueue();
            } else {
                updateProgressUI();
                highlightCurrentSentence();
            }
        }
    });
}
"""
    js += logic
    
    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

update()
