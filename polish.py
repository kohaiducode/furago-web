import re

def polish_player():
    with open('www/index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    old_controls_pattern = r'<div class="audio-controls".*?</div>'
    
    new_controls = """<div class="audio-controls" style="display: flex; gap: 20px; justify-content: center; align-items: center; width: 100%; padding: 10px 0;">
                    <button id="btn-restart" class="btn-icon" style="background: none; border: none; color: var(--text-main); cursor: pointer; padding: 10px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v6h6"></path><path d="M3 8A9 9 0 1 1 12 21a9 9 0 0 1-9-9"></path></svg>
                    </button>
                    <button id="btn-prev-sentence" class="btn-icon" style="background: none; border: none; color: var(--text-main); cursor: pointer; padding: 10px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>
                    </button>
                    <button id="btn-play-pause" class="btn-icon" style="background: var(--primary); border: none; color: white; cursor: pointer; padding: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    </button>
                    <button id="btn-next-sentence" class="btn-icon" style="background: none; border: none; color: var(--text-main); cursor: pointer; padding: 10px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
                    </button>
                </div>"""
                
    html = re.sub(old_controls_pattern, new_controls, html, count=1, flags=re.DOTALL)
    
    with open('www/index.html', 'w', encoding='utf-8') as f:
        f.write(html)
        
    # Update app.js so it only injects icons (no text)
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()
        
    # Find btnPlayPause.innerHTML assignments and remove the text
    # Usually: btnPlayPause.innerHTML = `${iconPause} 一時停止`;
    # or btnPlayPause.innerHTML = `${iconPlay} 再生`;
    
    # We can just replace `${iconPause} .*?` with `${iconPause}`
    # using regex on the specific lines:
    js = re.sub(r'btnPlayPause\.innerHTML = `\$\{iconPause\}[^`]*`;', 'btnPlayPause.innerHTML = `${iconPause}`;', js)
    js = re.sub(r'btnPlayPause\.innerHTML = `\$\{iconPlay\}[^`]*`;', 'btnPlayPause.innerHTML = `${iconPlay}`;', js)
    
    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

polish_player()
