"use client";

import React, { useMemo, useEffect, useRef, useCallback } from "react";
import { UserState } from "@/lib/userState";
import { derivePedagogicalProgress } from "@/lib/progress";
import { getTranslation, AppLanguage, getGoalText, getCanDoText } from "@/lib/i18n";
import { getStreakStatus } from "@/lib/home";
import { trackEvent } from "@/lib/analytics";

export interface ProgressDashboardProps {
  userState: UserState;
  appLang: AppLanguage;
  onGoalClick: (category: string) => void;
}

export default function ProgressDashboard({ userState, appLang, onGoalClick }: ProgressDashboardProps) {
  const t = getTranslation(appLang);
  const progress = useMemo(() => derivePedagogicalProgress(userState), [userState]);

  const { vocabulary, reading, consistency, goal, canDos } = progress;
  const goalText = goal ? getGoalText(appLang, goal) : null;
  // Same display logic as the header/Home habit layer: a stale stored streak is never shown as current.
  const streakStatus = getStreakStatus(
    userState.currentStreak,
    userState.lastStreakDate,
    new Date().toLocaleDateString("en-CA")
  );

  const dashboardOpenedRef = useRef(false);
  const candoViewedRef = useRef(false);

  useEffect(() => {
    if (!dashboardOpenedRef.current) {
      dashboardOpenedRef.current = true;
      trackEvent("progress_dashboard_opened", {});
    }
  }, []);

  const handleCandoSectionView = useCallback(() => {
    if (candoViewedRef.current) return;
    candoViewedRef.current = true;
    const unlockedCount = canDos.filter(c => c.isUnlocked).length;
    trackEvent("cando_viewed", {
      unlocked_count: unlockedCount,
      total_count: canDos.length,
    });
  }, [canDos]);

  const candoSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = candoSectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            handleCandoSectionView();
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [handleCandoSectionView]);

  const handleGoalClick = (category: string) => {
    if (goal) {
      trackEvent("progress_goal_clicked", {
        goal_id: goal.id,
        goal_category: goal.category,
      });
    }
    onGoalClick(category);
  };

  // Render logic for dashboard
  return (
    <div className="view fade-in progress-dashboard" style={{ padding: "16px", paddingBottom: "100px" }}>
      <header style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0 0 8px 0" }}>
          {t.progress.title}
        </h2>
        <p style={{ color: "var(--text-muted)", margin: 0, fontSize: "0.95rem" }}>
          {t.progress.subtitle}
        </p>
      </header>

      {/* SECTION 1: OVERVIEW */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" }}>
        <div className="card" style={{ padding: "16px", borderRadius: "16px", background: "var(--surface)", border: "1px solid var(--border)", textAlign: "center" }}>
          <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--primary)" }}>{reading.completedArticles}</div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>
            {t.progress.articlesRead}
          </div>
        </div>
        <div className="card" style={{ padding: "16px", borderRadius: "16px", background: "var(--surface)", border: "1px solid var(--border)", textAlign: "center" }}>
          <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--success)" }}>{vocabulary.wordsConsolidated}</div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>
            {t.progress.consolidatedWords}
          </div>
        </div>
      </section>

      {/* SECTION 5: CURRENT GOAL */}
      {goal && (
        <section style={{ marginBottom: "24px" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: "12px" }}>
            {t.progress.currentGoal}
          </h3>
          <div style={{ padding: "16px", borderRadius: "16px", background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)", color: "white" }}>
            <h4 style={{ margin: "0 0 8px 0", fontSize: "1.1rem" }}>{goalText?.title}</h4>
            <p style={{ margin: "0 0 16px 0", fontSize: "0.9rem", opacity: 0.9 }}>{goalText?.description}</p>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ flex: 1, background: "rgba(255,255,255,0.3)", height: "8px", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ background: "white", width: `${goal.progressRatio * 100}%`, height: "100%", borderRadius: "4px" }} />
              </div>
              <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{goal.current} / {goal.target}</span>
            </div>
            <button 
              className="action-btn"
              onClick={() => handleGoalClick(goal.category)}
              style={{ marginTop: "16px", width: "100%", padding: "10px", borderRadius: "12px", background: "white", color: "var(--primary)", fontWeight: 800, border: "none" }}
            >
              {t.progress.continueLearning}
            </button>
          </div>
        </section>
      )}

      {/* SECTION 2: VOCABULARY */}
      <section style={{ marginBottom: "24px" }}>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: "12px" }}>
          {t.progress.vocabulary}
        </h3>
        <div style={{ padding: "16px", borderRadius: "16px", background: "var(--surface)", border: "1px solid var(--border)" }}>
          {vocabulary.wordsEncountered === 0 ? (
            <p style={{ color: "var(--text-muted)", margin: 0, fontSize: "0.9rem" }}>
              {t.progress.vocabularyEmpty}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <VocabRow label={t.progress.inStudy} count={vocabulary.wordsInStudy} total={vocabulary.wordsEncountered} color="var(--primary)" />
              <VocabRow label={t.progress.consolidating} count={vocabulary.wordsConsolidating} total={vocabulary.wordsEncountered} color="var(--accent)" />
              <VocabRow label={t.progress.consolidated} count={vocabulary.wordsConsolidated} total={vocabulary.wordsEncountered} color="var(--success)" />
            </div>
          )}
        </div>
      </section>

      {/* SECTION 3: READING */}
      <section style={{ marginBottom: "24px" }}>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: "12px" }}>
          {t.progress.readingLog}
        </h3>
        <div style={{ padding: "16px", borderRadius: "16px", background: "var(--surface)", border: "1px solid var(--border)" }}>
          {reading.completedArticles === 0 ? (
            <p style={{ color: "var(--text-muted)", margin: 0, fontSize: "0.9rem" }}>
              {t.progress.readingLogEmpty}
            </p>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", paddingBottom: "12px", borderBottom: "1px solid var(--border)" }}>
                <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>{t.progress.perfectQuizzes}</span>
                <span style={{ fontWeight: 800 }}>{reading.perfectQuizResults}</span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "8px" }}>
                  {t.progress.completedByLevel}
                </span>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {Object.entries(reading.completedByLevel).map(([lvl, count]) => {
                    if (!lvl || lvl === "undefined" || lvl === "null") return null;
                    return (
                      <div key={lvl} style={{ background: "var(--bg-main)", padding: "6px 12px", borderRadius: "20px", fontSize: "0.85rem", fontWeight: 600, border: "1px solid var(--border)" }}>
                        {t.levels?.[lvl as keyof typeof t.levels] || lvl}: {count}
                      </div>
                    );
                  })}
                  {/* Calculate unknown levels */}
                  {(() => {
                    const knownCount = Object.entries(reading.completedByLevel).reduce((sum, [lvl, count]) => {
                      if (!lvl || lvl === "undefined" || lvl === "null") return sum;
                      return sum + count;
                    }, 0);
                    const unknownCount = reading.completedArticles - knownCount;
                    if (unknownCount > 0) {
                      return (
                        <div style={{ background: "var(--bg-main)", padding: "6px 12px", borderRadius: "20px", fontSize: "0.85rem", fontWeight: 600, border: "1px solid var(--border)" }}>
                          {t.progress.unknownLevel}: {unknownCount}
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* SECTION 6: CONSISTENCY */}
      <section style={{ marginBottom: "24px" }}>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: "12px" }}>
          {t.progress.learningHabit}
        </h3>
        <div style={{ display: "flex", gap: "12px" }}>
          <div style={{ flex: 1, padding: "16px", borderRadius: "16px", background: "var(--surface)", border: "1px solid var(--border)", textAlign: "center" }}>
            <div style={{ fontSize: "1.8rem", margin: "0 0 4px 0" }}>🔥</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 900 }}>{streakStatus.display} {t.progress.days}</div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>{t.progress.currentStreak}</div>
          </div>
          <div style={{ flex: 1, padding: "16px", borderRadius: "16px", background: "var(--surface)", border: "1px solid var(--border)", textAlign: "center" }}>
            <div style={{ fontSize: "1.8rem", margin: "0 0 4px 0" }}>🏆</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 900 }}>{consistency.longestStreak} {t.progress.days}</div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>{t.progress.bestStreak}</div>
          </div>
        </div>
      </section>

      {/* SECTION 4: CAN-DO SKILLS */}
      <section ref={candoSectionRef} style={{ marginBottom: "24px" }}>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: "12px" }}>
          {t.progress.canDo}
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {canDos.map(skill => (
            <div 
              key={skill.id} 
              style={{ 
                padding: "16px", 
                borderRadius: "16px", 
                background: skill.isUnlocked ? "var(--surface)" : "var(--bg-main)", 
                border: `1px solid ${skill.isUnlocked ? "var(--primary)" : "var(--border)"}`,
                opacity: skill.isUnlocked ? 1 : 0.6,
                display: "flex",
                gap: "12px",
                alignItems: "flex-start"
              }}
            >
              <div style={{ 
                width: "24px", 
                height: "24px", 
                borderRadius: "50%", 
                background: skill.isUnlocked ? "var(--primary)" : "var(--border)",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: "2px"
              }}>
                {skill.isUnlocked ? "✓" : "🔒"}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: "0.95rem", marginBottom: "4px", color: skill.isUnlocked ? "var(--text-main)" : "var(--text-muted)" }}>
                  {getCanDoText(appLang, skill).title}
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  {getCanDoText(appLang, skill).criteria}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function VocabRow({ label, count, total, color }: { label: string, count: number, total: number, color: string }) {
  const percent = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "0.85rem", fontWeight: 600 }}>
        <span style={{ color: "var(--text-muted)" }}>{label}</span>
        <span>{count}</span>
      </div>
      <div style={{ height: "6px", background: "var(--bg-main)", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ width: `${percent}%`, height: "100%", background: color, borderRadius: "3px" }} />
      </div>
    </div>
  );
}
