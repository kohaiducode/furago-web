import re

def fix_init_app():
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    old_logic = r"currentArticles\.forEach\(\(a\) => \{\s*if \(a\.category\) categories\.add\(a\.category\.trim\(\)\);\s*\}\);\s*// Categories are populated dynamically when modal opens\s*renderHome\(\);"
    
    new_logic = """currentArticles.forEach((a) => {
        if (a.category) categories.add(a.category.trim());
      });
  
      selectedCategories = Array.from(categories);
      globalCategoryBtn.textContent = "カテゴリー";
      
      renderHome();"""
      
    js = re.sub(old_logic, new_logic, js)

    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

fix_init_app()
