import sys

with open("src/components/FuragoApp.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# We will just replace the modal block directly with regex or str.replace, but it's large.
modal_start = '{/* Newsletter 3-Step Profile Registration Modal */}'
modal_end = '      {/* End of Lead Modal */}' # Wait, there is no end comment.

lines = content.split('\\n')
start_idx = -1
for i, l in enumerate(lines):
    if modal_start in l:
        start_idx = i
        break

new_modal = """      {/* Newsletter 3-Step Profile Registration Modal */}
      {leadModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setLeadModalOpen(false)}
        >
          <form
            className="modal-sheet"
            style={{ maxWidth: "440px" }}
            onSubmit={handleLeadProfileSubmit}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header + Close Button */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
              }}
            >
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--primary)" }}>
                {t.newsletter.title}
              </h3>
              <button
                type="button"
                onClick={() => setLeadModalOpen(false)}
                style={{
                  background: "var(--bg)",
                  border: "none",
                  borderRadius: "50%",
                  width: "30px",
                  height: "30px",
                  cursor: "pointer",
                  fontWeight: 700,
                  color: "var(--text-muted)",
                }}
              >
                ×
              </button>
            </div>

            {/* Barre de progression 3 etapes */}
            <div style={{ marginBottom: "18px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  marginBottom: "6px",
                }}
              >
                <span>Step {leadStep} / 3</span>
                <span>
                  {leadStep === 1
                    ? t.newsletter.step1
                    : leadStep === 2
                      ? t.newsletter.step2
                      : t.newsletter.step3}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "6px",
                }}
              >
                {[1, 2, 3].map((step) => (
                  <div
                    key={step}
                    style={{
                      flex: 1,
                      height: "5px",
                      borderRadius: "3px",
                      background:
                        step <= leadStep ? "var(--primary)" : "var(--border)",
                      transition: "background 0.25s ease",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Message d'erreur */}
            {leadError && (
              <div
                style={{
                  background: "rgba(255, 59, 48, 0.1)",
                  border: "1px solid #FF3B30",
                  color: "#D70015",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  fontSize: "0.86rem",
                  fontWeight: 700,
                  marginBottom: "14px",
                  textAlign: "center",
                }}
              >
                {leadError}
              </div>
            )}

            {/* ETAPE 1 : Prenom, Email */}
            {leadStep === 1 && (
              <div className="fade-in">
                <label
                  style={{
                    display: "block",
                    fontSize: "0.84rem",
                    fontWeight: 700,
                    marginBottom: "6px",
                  }}
                >
                  {t.newsletter.name}
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={leadFirstName}
                  onChange={(e) => {
                    setLeadFirstName(e.target.value);
                    setLeadError(null);
                  }}
                  placeholder={appLang === 'ja' ? "例: 太郎 / Taro" : "e.g. Taro"}
                  style={{
                    width: "100%",
                    padding: "11px 12px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    fontSize: "0.95rem",
                    marginBottom: "14px",
                    outline: "none",
                  }}
                />

                <label
                  style={{
                    display: "block",
                    fontSize: "0.84rem",
                    fontWeight: 700,
                    marginBottom: "6px",
                  }}
                >
                  {t.newsletter.email}
                </label>
                <input
                  type="email"
                  required
                  value={leadEmail}
                  onChange={(e) => {
                    setLeadEmail(e.target.value);
                    setLeadError(null);
                  }}
                  placeholder="example@mail.com"
                  style={{
                    width: "100%",
                    padding: "11px 12px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    fontSize: "0.95rem",
                    marginBottom: "22px",
                    outline: "none",
                  }}
                />

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setLeadModalOpen(false)}
                    style={{
                      flex: 1,
                      padding: "12px",
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      color: "var(--text-main)",
                    }}
                  >
                    {t.newsletter.cancel}
                  </button>
                  <button
                    type="submit"
                    style={{
                      flex: 1,
                      padding: "12px",
                      background: "var(--primary)",
                      color: "white",
                      border: "none",
                      borderRadius: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {leadCheckingEmail ? (appLang === 'ja' ? "確認中..." : "Checking...") : "Next"}
                  </button>
                </div>
              </div>
            )}

            {/* ETAPE 2 : Niveau de francais */}
            {leadStep === 2 && (
              <div className="fade-in">
                <p
                  style={{
                    fontSize: "0.95rem",
                    marginBottom: "14px",
                    color: "var(--text-main)",
                    fontWeight: 600,
                  }}
                >
                  {appLang === 'ja' ? '現在のフランス語レベルを教えてください。' : 'What is your current French level?'}
                </p>
                <div
                  style={{
                    display: "grid",
                    gap: "8px",
                    marginBottom: "22px",
                  }}
                >
                  {[
                    { code: "LVL_1", desc: "Absolute Beginner" },
                    { code: "LVL_2", desc: "Beginner" },
                    { code: "LVL_3", desc: "Intermediate" },
                    { code: "LVL_4", desc: "Advanced" }
                  ].map((item) => (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => {
                        setLeadLevel(item.code);
                        setLeadError(null);
                      }}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "12px",
                        border:
                          leadLevel === item.code
                            ? "2px solid var(--primary)"
                            : "2px solid var(--border)",
                        background:
                          leadLevel === item.code
                            ? "var(--primary-light)"
                            : "var(--surface)",
                        textAlign: "left",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>
                        {t.levels[item.code as keyof typeof t.levels]}
                      </span>
                      {leadLevel === item.code && <span>✔️</span>}
                    </button>
                  ))}
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setLeadStep(1)}
                    style={{
                      flex: 1,
                      padding: "12px",
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      color: "var(--text-main)",
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    style={{
                      flex: 1,
                      padding: "12px",
                      background: "var(--primary)",
                      color: "white",
                      border: "none",
                      borderRadius: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* ETAPE 3 : Categories preferees */}
            {leadStep === 3 && (
              <div className="fade-in">
                <p
                  style={{
                    fontSize: "0.95rem",
                    marginBottom: "14px",
                    color: "var(--text-main)",
                    fontWeight: 600,
                  }}
                >
                  {appLang === 'ja' ? '興味のあるカテゴリーを選んでください' : 'Select the categories you are interested in'}
                  <br />
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 400 }}>
                    {appLang === 'ja' ? '（1つ以上タップして選択）' : '(Tap to select one or more)'}
                  </span>
                </p>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    marginBottom: "22px",
                    maxHeight: "220px",
                    overflowY: "auto",
                    paddingBottom: "10px",
                  }}
                >
                  {newsletterCategoryOptions.map((cat) => {
                    const isSelected = leadCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setLeadError(null);
                          if (isSelected) {
                            setLeadCategories((prev) =>
                              prev.filter((c) => c !== cat)
                            );
                          } else {
                            setLeadCategories((prev) => [...prev, cat]);
                          }
                        }}
                        style={{
                          padding: "8px 14px",
                          borderRadius: "20px",
                          border: isSelected
                            ? "2px solid var(--primary)"
                            : "1px solid var(--border)",
                          background: isSelected
                            ? "var(--primary-light)"
                            : "var(--surface)",
                          color: isSelected
                            ? "var(--primary)"
                            : "var(--text-main)",
                          fontWeight: 600,
                          fontSize: "0.85rem",
                          cursor: "pointer",
                          transition: "all 0.2s",
                        }}
                      >
                        {isSelected ? `✓ ${cat}` : cat}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setLeadStep(2)}
                    style={{
                      flex: 1,
                      padding: "12px",
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      color: "var(--text-main)",
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={leadSubmitting}
                    style={{
                      flex: 1,
                      padding: "12px",
                      background: leadSubmitting ? "var(--border)" : "var(--primary)",
                      color: "white",
                      border: "none",
                      borderRadius: "12px",
                      fontWeight: 700,
                      cursor: leadSubmitting ? "not-allowed" : "pointer",
                    }}
                  >
                    {leadSubmitting ? (appLang === 'ja' ? "送信中..." : "Submitting...") : t.newsletter.submit}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
"""

if start_idx != -1:
    lines = lines[:start_idx] + new_modal.split('\\n')
    content = '\\n'.join(lines)

    content = content.replace('if (!leadFirstName.trim() || !leadEmail.trim() || !leadGender) {', 'if (!leadFirstName.trim() || !leadEmail.trim()) {')
    content = content.replace('gender: leadGender,', 'gender: "Not specified",')
    
    with open("src/components/FuragoApp.tsx", "w", encoding="utf-8") as f:
        f.write(content)
    print("Done refactoring modal safely")
else:
    print("Modal block not found")
