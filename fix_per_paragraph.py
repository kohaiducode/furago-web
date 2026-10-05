import sys
import re

with open("src/components/FuragoApp.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Change showTranslation state to record
content = content.replace(
    'const [showTranslation, setShowTranslation] = useState<boolean>(false);',
    'const [showTranslation, setShowTranslation] = useState<Record<number, boolean>>({});'
)

# 2. Remove the global translation toggle from article header
reading_header_old = """          <div className="article-header" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                <h2 lang="fr" style={{ margin: 0, flex: 1 }}>{typeof currentLevelData.title === "string" ? currentLevelData.title : (currentLevelData.title as any)?.fr}</h2>
                <button
                    onClick={() => setShowTranslation(!showTranslation)}
                    style={{
                        background: showTranslation ? "var(--primary-light)" : "transparent",
                        color: showTranslation ? "var(--primary)" : "var(--primary)",
                        border: "1px solid var(--primary)",
                        padding: "6px 12px",
                        borderRadius: "12px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        flexShrink: 0
                    }}
                >
                    {showTranslation ? t.reading.hideTranslation : t.reading.showTranslation}
                </button>
            </div>"""

reading_header_new = """          <div className="article-header" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                <h2 lang="fr" style={{ margin: 0, flex: 1 }}>{typeof currentLevelData.title === "string" ? currentLevelData.title : (currentLevelData.title as any)?.fr}</h2>
            </div>"""

if reading_header_old in content:
    content = content.replace(reading_header_old, reading_header_new)

# 3. Add per-paragraph translation toggle in renderInteractiveContent
render_old = """      const transText = appLang === 'ja' ? p.ja : p.en;
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
      );"""

render_new = """      const transText = appLang === 'ja' ? p.ja : p.en;
      const isTranslated = !!showTranslation[pIdx];
      allElements.push(
        <div key={p.id || pIdx} style={{ marginBottom: "1.2rem", position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
            <p lang="fr" style={{ flex: 1, margin: 0 }}>
               {elements}
            </p>
            {transText && (
              <button
                onClick={() => setShowTranslation(prev => ({...prev, [pIdx]: !prev[pIdx]}))}
                style={{
                  background: isTranslated ? "var(--primary-light)" : "transparent",
                  color: isTranslated ? "var(--primary)" : "var(--primary)",
                  border: "1px solid var(--primary)",
                  padding: "2px 8px",
                  borderRadius: "8px",
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  marginTop: "4px"
                }}
              >
                {isTranslated ? t.reading.hideTranslation : t.reading.showTranslation}
              </button>
            )}
          </div>
          {isTranslated && transText && (
            <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", marginTop: "8px", paddingLeft: "8px", borderLeft: "3px solid var(--border)" }}>
              {transText}
            </p>
          )}
        </div>
      );"""

if render_old in content:
    content = content.replace(render_old, render_new)
else:
    print("Could not find render_old in content!")

with open("src/components/FuragoApp.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Done fixing per-paragraph translation")
