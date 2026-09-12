import re

def fix():
    with open('www/index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # 1. Update the header and controls layout
    # First, let's remove the old audio-controls block entirely
    html = re.sub(r'<div class="audio-controls".*?</div>', '', html, flags=re.DOTALL)
    
    # Now, let's replace the header to include the new controls layout on the right
    old_header = r'<div class="audio-panel-header">\s*<h4>音声読み上げ</h4>\s*</div>'
    new_header = """<div class="audio-panel-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <h4 style="margin: 0; font-size: 1.1rem; white-space: nowrap;">音声読み上げ</h4>
                    <div class="audio-controls" style="display: flex; gap: 4px; align-items: center;">
                        <button id="btn-restart" class="btn-icon" style="background: none; border: none; color: var(--text-main); cursor: pointer; padding: 6px; display: flex; align-items: center; justify-content: center;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v6h6"></path><path d="M3 8A9 9 0 1 1 12 21a9 9 0 0 1-9-9"></path></svg>
                        </button>
                        <button id="btn-prev-sentence" class="btn-icon" style="background: none; border: none; color: var(--text-main); cursor: pointer; padding: 6px; display: flex; align-items: center; justify-content: center;">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>
                        </button>
                        <button id="btn-play-pause" class="btn-icon" style="background: var(--primary); border: none; color: white; cursor: pointer; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.15); padding: 0; flex-shrink: 0;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                        </button>
                        <button id="btn-next-sentence" class="btn-icon" style="background: none; border: none; color: var(--text-main); cursor: pointer; padding: 6px; display: flex; align-items: center; justify-content: center;">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
                        </button>
                    </div>
                </div>"""
                
    html = re.sub(old_header, new_header, html)
    
    with open('www/index.html', 'w', encoding='utf-8') as f:
        f.write(html)

    # 2. Update app.js
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # Change icons sizes back to 20x20 in app.js for the dynamic updates!
    js = js.replace('<svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>', '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>')
    js = js.replace('<svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>', '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>')

    # Update Capacitor speak to pass voice parameter
    # We will find the speak block and inject voice
    old_speak = """                    await window.Capacitor.Plugins.TextToSpeech.speak({
                        text: utterance.text,
                        lang: utterance.lang || 'fr-FR',
                        rate: utterance.rate || 1.0,
                    });"""
    new_speak = """                    let opts = {
                        text: utterance.text,
                        lang: utterance.lang || 'fr-FR',
                        rate: utterance.rate || 1.0,
                    };
                    if (utterance.voice && utterance.voice._originalIndex !== undefined) {
                        opts.voice = utterance.voice._originalIndex;
                    }
                    await window.Capacitor.Plugins.TextToSpeech.speak(opts);"""
    js = js.replace(old_speak, new_speak)

    # Add _originalIndex to voices array in initVoices
    js = js.replace('if (res && res.voices) voices = res.voices;', 'if (res && res.voices) voices = res.voices;\n                  voices.forEach((v, i) => v._originalIndex = i);')

    # Update regex and names for voices
    old_fem = r'/hortense|julie|amelie|audrey|aurelie|alice|léa|roxane|carmit/i.test(vName)'
    new_fem = r'/hortense|julie|amelie|audrey|aurelie|alice|léa|roxane|carmit|vlf|vld|vla|female/i.test(vName)'
    js = js.replace(old_fem, new_fem)
    
    old_mal = r'/paul|thomas|nicolas|david|henri|martin|claude|bernard/i.test(vName)'
    new_mal = r'/paul|thomas|nicolas|david|henri|martin|claude|bernard|vle|vlc|vlb|male/i.test(vName)'
    js = js.replace(old_mal, new_mal)
    
    js = js.replace('displayName = `女性 ${femaleCount}`;', 'displayName = `(女) ${femaleCount}`;')
    js = js.replace('displayName = `男性 ${maleCount}`;', 'displayName = `(男) ${maleCount}`;')
    js = js.replace('displayName = `音声 ${otherCount}`;', 'displayName = `(他) ${otherCount}`;')

    # To be extremely safe with Capacitor plugin not catching all voices
    # Ensure allLocalFrVoices fallback still gets indexes assigned
    js = js.replace('voices = (window.speechSynthesis && window.speechSynthesis.getVoices) ? window.speechSynthesis.getVoices() : [];', 'voices = (window.speechSynthesis && window.speechSynthesis.getVoices) ? window.speechSynthesis.getVoices() : [];\n          voices.forEach((v, i) => v._originalIndex = i);')

    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

fix()
