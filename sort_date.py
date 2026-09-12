import re

def sort_articles():
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    old_code = r"currentArticles = data.articles.filter\(a => Object.keys\(a.levels\).length > 0\);"
    new_code = """currentArticles = data.articles.filter(a => Object.keys(a.levels).length > 0);
        
        // Sort articles by date descending (newest first)
        currentArticles.sort((a, b) => {
            const dateA = a.date ? new Date(a.date).getTime() : 0;
            const dateB = b.date ? new Date(b.date).getTime() : 0;
            return dateB - dateA;
        });"""

    js = re.sub(old_code, new_code, js)

    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

sort_articles()
