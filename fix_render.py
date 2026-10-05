import sys

with open("src/components/FuragoApp.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1

for i, l in enumerate(lines):
    if 'const renderInteractiveContent = (text: string) => {' in l:
        start_idx = i
    if start_idx != -1 and 'return elements;' in l and i > start_idx:
        end_idx = i + 1 # include the closing brace line which is next line usually, wait.
        
# Let's just do it dynamically: count braces
brace_count = 0
if start_idx != -1:
    for i in range(start_idx, len(lines)):
        brace_count += lines[i].count('{')
        brace_count -= lines[i].count('}')
        if brace_count == 0 and i > start_idx:
            end_idx = i
            break

if start_idx != -1 and end_idx != -1:
    render_new = """  const renderInteractiveContent = (paragraphs: Paragraph[]) => {
    let globalOffset = 0;
    const allElements: React.ReactNode[] = [];

    const sentenceItem = ttsQueue[queueIndex];
    let sentenceStart = -1;
    let sentenceEnd = -1;
    if (sentenceItem) {
      sentenceStart = sentenceItem.start;
      sentenceEnd = sentenceItem.start + sentenceItem.length;
    }

    paragraphs.forEach((p, pIdx) => {
      const text = p.fr;
      const elements: React.ReactNode[] = [];
      const tokenRegex = /([a-zA-ZÀ-ÿœæŒÆ]+(?:['’][a-zA-ZÀ-ÿœæŒÆ]+)?)|([^a-zA-ZÀ-ÿœæŒÆ]+)/g;
      let match;

      while ((match = tokenRegex.exec(text)) !== null) {
        const token = match[0];
        const startIdx = globalOffset;
        const endIdx = globalOffset + token.length;

        const isWord = /[a-zA-ZÀ-ÿœæŒÆ]/.test(token);
        let isHighlighted = false;
        let isDimmed = false;

        if (sentenceStart !== -1 && sentenceEnd !== -1) {
          if (startIdx >= sentenceStart && startIdx < sentenceEnd) {
            isHighlighted = true;
          } else {
            isDimmed = true;
          }
        }

        if (isWord) {
          elements.push(
            <span
              key={startIdx}
              onClick={() => handleWordClick(token)}
              style={{
                cursor: "pointer",
                transition: "all 0.15s",
                color: isHighlighted ? "var(--primary)" : isDimmed ? "var(--text-muted)" : "inherit",
                opacity: isDimmed ? 0.6 : 1,
                backgroundColor:
                  isHighlighted &&
                  highlightRange.length > 0 &&
                  startIdx >= sentenceStart + highlightRange.start &&
                  startIdx < sentenceStart + highlightRange.start + highlightRange.length
                    ? "rgba(0, 122, 255, 0.15)"
                    : "transparent",
                borderRadius: "4px",
              }}
              className="hover-word"
            >
              {token}
            </span>
          );
        } else {
          elements.push(
            <span
              key={startIdx}
              style={{
                color: isHighlighted ? "inherit" : isDimmed ? "var(--text-muted)" : "inherit",
                opacity: isDimmed ? 0.6 : 1,
              }}
            >
              {token}
            </span>
          );
        }

        globalOffset += token.length;
      }
      
      const transText = appLang === 'ja' ? p.ja : p.en;
      allElements.push(
        <div key={p.id || pIdx} style={{ marginBottom: "1.2rem" }}>
          <p lang="fr">
             {elements}
          </p>
          {showTranslation && transText && (
            <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", marginTop: "4px", paddingLeft: "8px", borderLeft: "3px solid var(--border)" }}>
              {transText}
            </p>
          )}
        </div>
      );
      
      globalOffset += 1;
    });
    
    return allElements;
  };\n"""

    new_lines = lines[:start_idx] + [render_new] + lines[end_idx+1:]
    with open("src/components/FuragoApp.tsx", "w", encoding="utf-8") as f:
        f.writelines(new_lines)
    print("Replaced renderInteractiveContent successfully")
else:
    print(f"Could not find function bounds. start: {start_idx}, end: {end_idx}")
