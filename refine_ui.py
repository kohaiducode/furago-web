import re

def refine_ui():
    # 1. Update index.html
    with open('www/index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # Change audio-panel-header layout and remove the "音声読み上げ" text
    old_header = r'<div class="audio-panel-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">\s*<h4 style="margin: 0; font-size: 1.1rem; white-space: nowrap;">音声読み上げ</h4>\s*<div class="audio-controls" style="display: flex; gap: 4px; align-items: center;">'
    new_header = '<div class="audio-panel-header" style="display: flex; justify-content: center; align-items: center; margin-bottom: 0px;">\n                    <div class="audio-controls" style="display: flex; gap: 16px; align-items: center;">'
    html = re.sub(old_header, new_header, html)

    # Change version to 25
    html = html.replace('app.js?v=24', 'app.js?v=25')
    html = html.replace('style.css?v=5', 'style.css?v=6')

    with open('www/index.html', 'w', encoding='utf-8') as f:
        f.write(html)

    # 2. Update style.css
    with open('www/style.css', 'r', encoding='utf-8') as f:
        css = f.read()

    # Reduce gap in .audio-panel to make it more compact
    css = css.replace('gap: 16px;', 'gap: 10px;')
    # Ensure audio-panel padding is a bit smaller at the top
    css = css.replace('padding: 16px 20px 30px;', 'padding: 12px 20px 24px;')

    # Add extra padding-bottom to #reading-view so users can scroll
    # Let's insert it after `.view { ... }`
    old_view = r'\.view \{\s*padding: 16px;\s*max-width: 600px;\s*margin: 0 auto;\s*\}'
    new_view = """.view {
    padding: 16px;
    max-width: 600px;
    margin: 0 auto;
}

#reading-view {
    padding-bottom: 140px; /* Espace supplémentaire pour scroller au-dessus du lecteur audio */
}"""
    css = re.sub(old_view, new_view, css)

    with open('www/style.css', 'w', encoding='utf-8') as f:
        f.write(css)

refine_ui()
