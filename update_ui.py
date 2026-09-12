import re

def update_html():
    with open('www/index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # 1. Remove fab-audio
    fab_pattern = r'<!-- Bouton Flottant Audio -->\s*<button id="fab-audio" class="fab-audio">.*?</button>\s*'
    html = re.sub(fab_pattern, '', html, flags=re.DOTALL)

    # 2. Update audio-panel header
    # From: <h4>読み上げ</h4> to <h4>音声読み上げ</h4>
    html = html.replace('<h4>読み上げ</h4>', '<h4>音声読み上げ</h4>')
    html = html.replace('<h4>読み上げ</h4>', '<h4>音声読み上げ</h4>') # Just in case

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
                    <button id="btn-restart" class="btn-icon" style="flex: 1; padding: 10px 5px;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v6h6"></path><path d="M3 8A9 9 0 1 1 12 21a9 9 0 0 1-9-9"></path></svg>
                        最初から
                    </button>
                    <button id="btn-prev-sentence" class="btn-icon" style="flex: 1; padding: 10px 5px;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>
                        -1 文
                    </button>
                    <button id="btn-play-pause" class="btn-icon" style="flex: 1; padding: 10px 5px; background: var(--primary); color: white; border-radius: 12px;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                        再生
                    </button>
                    <button id="btn-next-sentence" class="btn-icon" style="flex: 1; padding: 10px 5px;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
                        +1 文
                    </button>
                </div>"""

    # Replace using regex because whitespace might differ
    # We will search for <div class="audio-controls">...</div> using dotall
    pattern = r'<div class="audio-controls">.*?</div>'
    html = re.sub(pattern, new_controls, html, count=1, flags=re.DOTALL)

    with open('www/index.html', 'w', encoding='utf-8') as f:
        f.write(html)

def update_app_js():
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # Date replacement in renderArticle
    # We will search for: <span>Ajouté le XX/XX/XXXX</span>
    js = js.replace('<span>Ajouté le XX/XX/XXXX</span>', '<span>Ajouté le ${article.date || \'Récemment\'}</span>')

    # Remove fabAudio DOM reference and listeners
    js = re.sub(r'const fabAudio = document\.getElementById\(\'fab-audio\'\);\s*', '', js)
    js = re.sub(r'fabAudio\.addEventListener\(\'click\'.*?\}\);\s*', '', js, flags=re.DOTALL)
    
    # Hide bottom nav on article page
    js = js.replace('function renderArticle(article) {', "function renderArticle(article) {\n    document.querySelector('.bottom-nav').classList.add('hidden');")
    
    # Show bottom nav when returning home
    js = js.replace('backBtn.addEventListener(\'click\', () => {', "backBtn.addEventListener('click', () => {\n    document.querySelector('.bottom-nav').classList.remove('hidden');")

    # The user wants the audio panel to be shown by default or ALWAYS?
    # If the FAB is gone, and the close button is still there, closing it means it's GONE forever!
    # So we should REMOVE the close button from the audio panel, OR just make it stick to the bottom.
    # The audio panel is initially hidden by CSS (transform: translateY(120%)).
    # We should make it appear when opening an article!
    js = js.replace("audioPanel.classList.remove('visible');", "")
    js = js.replace("audioPanel.classList.add('visible');", "")
    
    # Instead, when renderArticle is called, make it visible.
    # When going back, hide it.
    js = js.replace('function renderArticle(article) {', "function renderArticle(article) {\n    audioPanel.classList.add('visible');")
    js = js.replace("backBtn.addEventListener('click', () => {", "backBtn.addEventListener('click', () => {\n    audioPanel.classList.remove('visible');")
    
    # Add logic for Prev / Next buttons
    # Note: we need to find where the DOM variables are declared.
    new_doms = """const btnPrevSentence = document.getElementById('btn-prev-sentence');
const btnNextSentence = document.getElementById('btn-next-sentence');"""
    js = js.replace("const btnRestart = document.getElementById('btn-restart');", "const btnRestart = document.getElementById('btn-restart');\n" + new_doms)

    # Add listeners for Prev / Next
    new_listeners = """
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
    # Append listeners
    js += new_listeners

    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

update_html()
update_app_js()
