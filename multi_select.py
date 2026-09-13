import re

def implement_category_multi_select():
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # 1. Replace globalCategory with selectedCategories
    js = js.replace('let globalCategory = "ALL";', 'let selectedCategories = [];')
    
    # 2. In initApp, initialize selectedCategories
    old_init = r"categories\.add\(a\.category\.trim\(\)\);\s*\}\);\s*renderHome\(\);"
    new_init = """categories.add(a.category.trim());
    });
    selectedCategories = Array.from(categories);
    globalCategoryBtn.textContent = "カテゴリー";
    renderHome();"""
    js = re.sub(old_init, new_init, js)

    # 3. Update filterModalTitle and button text for levels
    js = js.replace('filterModalTitle.textContent = "レベルを選ぶ(Choisir un niveau)";', 'filterModalTitle.textContent = "レベルを選ぶ";')
    # Because of encoding/previous replace, it might be:
    js = js.replace('filterModalTitle.textContent = "レベルを選抁E(Choisir un niveau)";', 'filterModalTitle.textContent = "レベルを選ぶ";')
    # Let's use regex for safety
    js = re.sub(r'filterModalTitle\.textContent = "レベルを選.*?;', 'filterModalTitle.textContent = "レベルを選ぶ";', js)

    # 4. Update Category Modal Logic
    old_cat_modal = r'\} else if \(type === "category"\) \{[\s\S]*?\}\s*\}'
    new_cat_modal = """} else if (type === "category") {
    filterModalTitle.textContent = "カテゴリーを選ぶ";
    filterOptionsContainer.classList.add("filter-grid");
    
    const cats = Array.from(categories);
    cats.forEach((cat) => {
      const btn = document.createElement("button");
      btn.className = "quiz-option";
      btn.style.textAlign = "center";
      
      const updateStyle = () => {
        if (selectedCategories.includes(cat)) {
          btn.style.borderColor = "var(--primary)";
          btn.style.background = "var(--primary-light)";
        } else {
          btn.style.borderColor = "#E5E5EA";
          btn.style.background = "var(--surface)";
        }
      };
      
      updateStyle();
      btn.textContent = cat;
      
      btn.onclick = () => {
        if (selectedCategories.includes(cat)) {
          if (selectedCategories.length > 1) {
            selectedCategories = selectedCategories.filter(c => c !== cat);
          }
        } else {
          selectedCategories.push(cat);
        }
        updateStyle();
        
        if (selectedCategories.length === categories.size) {
            globalCategoryBtn.textContent = "カテゴリー";
        } else {
            globalCategoryBtn.textContent = `カテゴリー (${selectedCategories.length})`;
        }
        
        renderHome();
      };
      filterOptionsContainer.appendChild(btn);
    });
  }
}"""
    js = re.sub(old_cat_modal, new_cat_modal, js)

    # 5. Update renderHome logic for categories
    old_render = r'if \(globalCategory !== "ALL" && article\.category\.trim\(\) !== globalCategory\)\s*return false;'
    new_render = """if (!selectedCategories.includes(article.category.trim())) return false;"""
    js = re.sub(old_render, new_render, js)

    # 6. Remove French from Toast
    js = js.replace('showToast("保存しました ! (Sauvegardé)");', 'showToast("保存しました !");')

    # 7. Update Default List Name
    # We find the localStorage logic
    old_storage = r"let wordLists = JSON\.parse\(localStorage\.getItem\('furago_lists'\)\) \|\| \[\{id: 'default', name: '.*?Tout.*?'\}\];\s*if \(!Array\.isArray\(wordLists\) \|\| wordLists\.length === 0\) \{\s*wordLists = \[\{id: 'default', name: '.*?Tout.*?'\}\];\s*localStorage\.setItem\('furago_lists', JSON\.stringify\(wordLists\)\);\s*\}"
    
    # Wait, the string was mangled in powershell earlier ('チEォルチE(Tous les mots)'). Let's just use a loose regex.
    old_storage_loose = r"let wordLists = JSON\.parse\(localStorage\.getItem\('furago_lists'\)\) \|\| \[.*?\];\s*if \(!Array\.isArray\(wordLists\) \|\| wordLists\.length === 0\) \{\s*wordLists = \[.*?\];\s*localStorage\.setItem\('furago_lists', JSON\.stringify\(wordLists\)\);\s*\}"
    
    new_storage = """let wordLists = JSON.parse(localStorage.getItem('furago_lists')) || [{id: 'default', name: 'デフォルト'}];
if (!Array.isArray(wordLists) || wordLists.length === 0) {
    wordLists = [{id: 'default', name: 'デフォルト'}];
    localStorage.setItem('furago_lists', JSON.stringify(wordLists));
}
// Mise à jour rétroactive pour enlever "(Tous les mots)" chez les utilisateurs existants
wordLists.forEach(l => {
    if (l.id === 'default' && l.name.includes('(Tous les mots)')) {
        l.name = 'デフォルト';
    }
});
localStorage.setItem('furago_lists', JSON.stringify(wordLists));"""
    
    js = re.sub(old_storage_loose, new_storage, js)

    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

    # Update HTML button text
    with open('www/index.html', 'r', encoding='utf-8') as f:
        html = f.read()
    
    html = re.sub(r'カチEリー \(すべて\)', 'カテゴリー', html)
    html = re.sub(r'カテゴリー \(すべて\)', 'カテゴリー', html)
    # The actual text might be "カテゴリー (すべて)", let's just replace it broadly
    html = re.sub(r'<button id="global-category-btn" class="filter-btn">[\s\S]*?</button>', '<button id="global-category-btn" class="filter-btn">カテゴリー</button>', html)

    html = html.replace('app.js?v=33', 'app.js?v=34')

    with open('www/index.html', 'w', encoding='utf-8') as f:
        f.write(html)

implement_category_multi_select()
