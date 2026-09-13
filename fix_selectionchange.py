import re

def fix_selectionchange():
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # Find the selectionchange block
    start_str = 'document.addEventListener("selectionchange"'
    start_idx = js.find(start_str)
    
    if start_idx == -1:
        print("Not found")
        return
        
    brace_count = 0
    in_block = False
    end_idx = -1
    
    for i in range(start_idx, len(js)):
        if js[i] == '{':
            in_block = True
            brace_count += 1
        elif js[i] == '}':
            brace_count -= 1
            if in_block and brace_count == 0:
                end_idx = i + 1
                break
                
    if js[end_idx] == ';':
        end_idx += 1
        
    old_block = js[start_idx:end_idx]
    
    new_block = """document.addEventListener("selectionchange", () => {
  if (readingView.classList.contains("hidden")) return;

  const selection = window.getSelection();
  const text = selection.toString().trim();

  if (text && text.length > 0 && text.length <= 50) {
    setTimeout(() => {
      const currentSelection = window.getSelection();
      const latestText = currentSelection.toString().trim();
      if (latestText === text && currentSelection.rangeCount > 0) {
        let range = currentSelection.getRangeAt(0);
        let rect = range.getBoundingClientRect();
        
        let container = range.commonAncestorContainer;
        if (container.nodeType === 3) container = container.parentElement;
        
        // Find surrounding sentence
        const paragraphText = container.textContent || "";
        const sentences = paragraphText.split(/(?<=[.!?])\\s+/);
        let surroundingSentence = sentences.find(s => s.includes(latestText)) || paragraphText;
        
        showDictionaryPopup(latestText, surroundingSentence, rect);
      }
    }, 400);
  } else if (!text || text.length === 0) {
    dictPopup.classList.add("hidden");
  }
});"""
    
    js = js.replace(old_block, new_block)
    
    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

fix_selectionchange()
