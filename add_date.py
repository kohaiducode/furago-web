import re

def update_date():
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # 1. Update renderHome
    old_card_html = r"""        li\.innerHTML = `\s*\$\{imgHtml\}\s*<div class="article-card-content">\s*<h3>\$\{displayTitle\}</h3>\s*<p class="meta">\s*<span class="badge">\$\{globalLevel\}</span> \s*<span class="badge" style="background:#F2F2F7; color:#8E8E93;">\$\{article\.category \|\| '一般'\}</span>\s*</p>\s*</div>\s*`;"""
    
    new_card_html = """        const dateFormatted = article.date ? new Date(article.date).toLocaleDateString('ja-JP') : '';
        const dateHtml = dateFormatted ? `<span style="color:#8E8E93; font-size: 0.8rem; margin-left: auto;">${dateFormatted}</span>` : '';
        
        li.innerHTML = `
            ${imgHtml}
            <div class="article-card-content">
                <h3 style="margin-bottom: 8px;">${displayTitle}</h3>
                <p class="meta" style="display:flex; align-items:center; gap:6px; margin: 0;">
                    <span class="badge">${globalLevel}</span> 
                    <span class="badge" style="background:#F2F2F7; color:#8E8E93;">${article.category || '一般'}</span>
                    ${dateHtml}
                </p>
            </div>
        `;"""
    
    js = re.sub(old_card_html, new_card_html, js)
    
    # 2. Update openArticle
    old_meta = r"    articleMeta\.innerHTML = `<span class=\"badge\" style=\"font-size:0\.9rem;\">\$\{globalLevel\}</span> <span class=\"badge\" style=\"background:#F2F2F7; color:#8E8E93; font-size:0\.9rem;\">\$\{article\.category \|\| '一般'\}</span>`;"
    
    new_meta = """    const dateFormatted = article.date ? new Date(article.date).toLocaleDateString('ja-JP') : '';
    const dateHtml = dateFormatted ? `<span style="color:#8E8E93; font-size: 0.85rem; margin-left: auto;">${dateFormatted}</span>` : '';
    articleMeta.style.display = 'flex';
    articleMeta.style.alignItems = 'center';
    articleMeta.style.gap = '8px';
    articleMeta.style.marginTop = '12px';
    articleMeta.innerHTML = `<span class="badge" style="font-size:0.9rem;">${globalLevel}</span> <span class="badge" style="background:#F2F2F7; color:#8E8E93; font-size:0.9rem;">${article.category || '一般'}</span>${dateHtml}`;"""
    
    js = re.sub(old_meta, new_meta, js)

    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

update_date()
