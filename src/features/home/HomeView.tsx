"use client";

import React from "react";
import type { Article } from "@/types/article";
import { AppLanguage, getTranslation, getGoalText } from "@/lib/i18n";
import { derivePedagogicalProgress } from "@/lib/progress";
import { trackEvent } from "@/lib/analytics";
import { extractDriveId, formatDriveUrl } from "@/lib/image";
import { completedArticleId, StreakState } from "@/lib/home";
import type { SavedWord, LearnedWord, UserState } from "@/lib/userState";

export interface HomeViewProps {
  t: ReturnType<typeof getTranslation>;
  appLang: AppLanguage;
  globalLevel: string;
  onOpenFilterModal: (type: "level" | "category", trigger: HTMLButtonElement | null) => void;
  selectedCategories: string[];
  allCategories: string[];
  catalogStatus: "loading" | "success" | "offline" | "error";
  filteredArticles: Article[];
  articles: Article[];
  openArticle: (
    article: Article,
    skipHistory?: boolean,
    source?: "home_continue" | "home_mission" | "catalog" | "recommendation" | "home_progress_widget"
  ) => void;
  startVocabReview: (source: "saved" | "learned") => void;
  dueReviewCount: number;
  nextReviewOffset: number | null;
  continueTarget: Article | null;
  continueArticle: Article | null;
  continuePercent: number;
  dailyArticle: Article | null;
  isMissionCompletedToday: boolean;
  missionIsContinue: boolean;
  nextBestActionType: "review" | "continue" | "mission" | "explore";
  recommendedArticles: Article[];
  streakStatus: { display: number; state: StreakState };
  lastStreakDate: string;
  todayStr: string;
  isVocabReviewCompletedToday: boolean;
  savedWords: SavedWord[];
  learnedWords: LearnedWord[];
  userState: UserState;
  navigateTo: (view: "home" | "reading" | "words" | "vocab_review" | "progress") => void;
  completedArticleIds: string[];
  getArticleTitle: (a: Article) => string;
  getCategoryLabel: (a: Article) => string;
}

export default function HomeView({
  t,
  appLang,
  globalLevel,
  onOpenFilterModal,
  selectedCategories,
  allCategories,
  catalogStatus,
  filteredArticles,
  articles,
  openArticle,
  startVocabReview,
  dueReviewCount,
  nextReviewOffset,
  continueTarget,
  continueArticle,
  continuePercent,
  dailyArticle,
  isMissionCompletedToday,
  missionIsContinue,
  nextBestActionType,
  recommendedArticles,
  streakStatus,
  lastStreakDate,
  todayStr,
  isVocabReviewCompletedToday,
  savedWords,
  learnedWords,
  userState,
  navigateTo,
  completedArticleIds,
  getArticleTitle,
  getCategoryLabel,
}: HomeViewProps) {
  const homeCard: React.CSSProperties = { background: "var(--surface)", borderRadius: "18px", border: "1px solid var(--border)", padding: "14px", marginBottom: "4px", boxSizing: "border-box", maxWidth: "100%" };
  const homeSectionLabel: React.CSSProperties = { fontSize: "0.95rem", fontWeight: 800, color: "var(--text-main)", margin: "0 0 10px" };
  const homeMeta: React.CSSProperties = { margin: "4px 0 0", color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600, overflowWrap: "anywhere" };
  const homeTitle: React.CSSProperties = { margin: 0, fontSize: "1.02rem", fontWeight: 700, lineHeight: 1.3, color: "var(--text-main)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" };
  const homeCompactLine: React.CSSProperties = { margin: 0, padding: "12px 14px", borderRadius: "14px", background: "var(--surface)", border: "1px solid var(--border)", fontSize: "0.9rem", fontWeight: 600, color: "var(--text-muted)", overflowWrap: "anywhere" };
  const homeCtaPrimary: React.CSSProperties = { width: "100%", minHeight: "48px", padding: "12px 16px", borderRadius: "14px", border: "none", background: "var(--primary)", color: "white", fontSize: "1.02rem", fontWeight: 800, cursor: "pointer" };
  const homeCtaSecondary: React.CSSProperties = { ...homeCtaPrimary, background: "var(--primary-light)", color: "var(--primary)" };
  const homeThumb = (size: number): React.CSSProperties => ({ width: size, height: size, borderRadius: "12px", overflow: "hidden", flexShrink: 0, background: "var(--bg)" });

  const renderHomeProgressWidget = () => {
    const progressInfo = derivePedagogicalProgress(userState);

    if (!progressInfo) {
      return (
        <section aria-labelledby="home-progress-widget" style={{ ...homeCard, padding: "16px", marginBottom: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 id="home-progress-widget" style={{ fontSize: "1.2rem", fontWeight: 800, margin: 0, color: "var(--text-main)" }}>
              {t.progress.title}
            </h2>
          </div>
          <div style={{ textAlign: "center", padding: "12px", background: "var(--bg)", borderRadius: "12px" }}>
            <span style={{ fontSize: "0.9rem", color: "var(--text-muted)", fontWeight: 600 }}>
              {t.progress.empty}
            </span>
          </div>
        </section>
      );
    }

    const goal = progressInfo.goal;
    const goalText = goal ? getGoalText(appLang, goal) : null;

    return (
      <section aria-labelledby="home-progress-widget" style={{ ...homeCard, padding: "16px", marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h2 id="home-progress-widget" style={{ fontSize: "1.2rem", fontWeight: 800, margin: 0, color: "var(--text-main)" }}>
            {t.progress.title}
          </h2>
          <button
            onClick={() => navigateTo("progress")}
            className="reset-button"
            style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--primary)", cursor: "pointer" }}
          >
            {t.progress.viewDetails}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
          <div style={{ background: "var(--bg)", padding: "12px", borderRadius: "12px" }}>
            <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "var(--primary)" }}>{progressInfo.vocabulary.wordsConsolidated}</div>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>
              {t.progress.consolidatedWords}
            </div>
          </div>
          <div style={{ background: "var(--bg)", padding: "12px", borderRadius: "12px" }}>
            <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "var(--text-main)" }}>
              {progressInfo.reading.highestCompletedContentLevel ? (t.levels[progressInfo.reading.highestCompletedContentLevel as keyof typeof t.levels] || progressInfo.reading.highestCompletedContentLevel) : t.progress.levelNotSet}
            </div>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>
              {t.progress.currentLevel}
            </div>
          </div>
        </div>

        {goal ? (
          <div style={{ background: "var(--bg)", padding: "16px", borderRadius: "12px", color: "var(--text-main)" }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: "4px" }}>
              {t.progress.currentGoal}
            </div>
            <div style={{ fontSize: "1.05rem", fontWeight: 800, marginBottom: "12px" }}>
              {goalText?.title}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div style={{ flex: 1, background: "var(--border)", height: "6px", borderRadius: "3px", overflow: "hidden" }}>
                <div style={{ width: `${Math.round(goal.progressRatio * 100)}%`, height: "100%", background: "var(--primary)", borderRadius: "3px" }} />
              </div>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-muted)" }}>
                {goal.current} / {goal.target}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                if (goal.category === "VOCABULARY" || goal.category === "CONSOLIDATION") {
                  navigateTo("words");
                } else if (goal.category === "READING" || goal.category === "QUIZ") {
                  let targetArticle = recommendedArticles[0];
                  if (goal.category === "QUIZ") {
                    targetArticle = articles.find(a => !completedArticleIds.some((entry) => completedArticleId(entry) === String(a.id)) && a.levels[globalLevel]?.quiz && a.levels[globalLevel]?.quiz!.length > 0) || targetArticle;
                  }
                  if (targetArticle) {
                    openArticle(targetArticle, false, "home_progress_widget");
                  } else {
                    const el = document.getElementById("home-reco") || document.getElementById("home-catalog") || window.document.body;
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }
                }
              }}
              style={{ width: "100%", padding: "12px", borderRadius: "12px", background: "var(--surface)", color: "var(--primary)", fontWeight: 800, border: "1px solid var(--border)", cursor: "pointer" }}
            >
              {goal.category === "VOCABULARY" || goal.category === "CONSOLIDATION"
                ? t.progress.goalCtaReview
                : t.progress.goalCtaRead}
            </button>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "12px", background: "var(--bg)", borderRadius: "12px" }}>
            <span style={{ fontSize: "0.9rem", color: "var(--text-muted)", fontWeight: 600 }}>
              {t.progress.goalEmpty}
            </span>
          </div>
        )}
      </section>
    );
  };

  return (
    <main className="view fade-in">
      {/* B. PRIMARY LEARNING ACTION — one dominant card */}
      <section aria-labelledby="home-primary-title" className="home-primary-action">
        {(() => {
          if (nextBestActionType === "review") {
            return (
              <div className="primary-card">
                <p id="home-primary-title" style={{ margin: "0 0 4px", fontSize: "0.85rem", fontWeight: 800, color: "var(--primary)" }}>
                  {t.home.reviewTitle}
                </p>
                <p style={{ margin: "0 0 12px", fontSize: "1.05rem", fontWeight: 800, color: "var(--text-main)" }}>
                  {(dueReviewCount === 1 ? t.home.reviewDueOne : t.home.reviewDue).replace("{count}", String(dueReviewCount))}
                </p>
                <p style={{ ...homeMeta, marginBottom: "16px" }}>{t.home.reviewBeforeForget}</p>
                <button
                  type="button"
                  onClick={() => {
                    trackEvent("home_cta_clicked", { cta_type: "srs", position: 0 });
                    startVocabReview("learned");
                  }}
                  style={homeCtaPrimary}
                >
                  {t.home.reviewCta}
                </button>
              </div>
            );
          }

          const article = nextBestActionType === "continue" ? continueTarget
            : nextBestActionType === "mission" ? dailyArticle
            : filteredArticles.find(a => !completedArticleIds.some((entry) => completedArticleId(entry) === String(a.id))) || filteredArticles[0];

          if (!article) {
            return (
              <div className="primary-card" style={{ textAlign: "center", padding: "24px 16px", color: "var(--text-muted)" }}>
                <p id="home-primary-title" style={{ margin: 0, fontWeight: 600 }}>{t.home.emptyResult}</p>
              </div>
            );
          }

          const isContinue = nextBestActionType === "continue";
          const isMission = nextBestActionType === "mission";
          const isExplore = nextBestActionType === "explore";
          const titleLabel = isContinue ? (continueArticle ? t.home.continueTitle : t.home.continueSeriesTitle)
            : isMission ? t.home.missionSection
            : t.home.nextUp;
          const labelColor = isMission ? "var(--primary)" : "var(--text-muted)";
          const buttonLabel = isContinue ? (continueArticle ? t.home.continueCta : t.home.nextEpisodeCta)
            : t.reading.read;
          const source: "home_continue" | "home_mission" | "recommendation" = isContinue ? "home_continue" : isMission ? "home_mission" : "recommendation";
          const ctaType = isContinue ? "continue" : isMission ? "mission" : "recommendation";

          return (
            <div className="primary-card">
              <div style={{ display: "flex", gap: "14px", alignItems: "center", minWidth: 0 }}>
                {article.imageUrl && (
                  <div style={homeThumb(72)}>
                    <img src={formatDriveUrl(article.imageUrl)} alt="" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p id="home-primary-title" style={{ margin: "0 0 4px", fontSize: "0.85rem", fontWeight: 800, color: labelColor }}>
                    {titleLabel}
                  </p>
                  <h3 lang="fr" style={{ ...homeTitle, fontSize: "1.08rem" }}>{getArticleTitle(article)}</h3>
                  <p style={homeMeta}>
                    {[
                      t.levels[globalLevel as keyof typeof t.levels],
                      getCategoryLabel(article),
                      isContinue && !continueArticle && article.seriesOrder ? t.home.episode.replace("{n}", String(article.seriesOrder)) : "",
                    ].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
              {isContinue && continueArticle && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "12px" }}>
                  <div
                    role="progressbar"
                    aria-label={t.home.readingProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={continuePercent}
                    style={{ flex: 1, height: "6px", borderRadius: "6px", background: "var(--bg)", overflow: "hidden" }}
                  >
                    <div style={{ width: `${continuePercent}%`, height: "100%", background: "var(--primary)" }} />
                  </div>
                  <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--primary)", minWidth: "4ch", textAlign: "right" }}>
                    {continuePercent}%
                  </span>
                </div>
              )}
              {isContinue && missionIsContinue && !isMissionCompletedToday && (
                <p style={{ ...homeMeta, color: "var(--primary)", fontWeight: 700, marginTop: "10px" }}>
                  {t.home.missionTag}
                </p>
              )}
              {isExplore && (
                <p style={{ ...homeMeta, marginTop: "10px", marginBottom: 0 }}>
                  {t.home.exploreBody}
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  trackEvent("home_cta_clicked", { cta_type: ctaType, position: 0 });
                  openArticle(article, false, source);
                }}
                style={{ ...homeCtaPrimary, marginTop: "14px" }}
              >
                {buttonLabel}
              </button>
            </div>
          );
        })()}
      </section>

      {/* C. ARTICLE CATALOGUE — filters sit directly above the list */}
      <section id="home-catalog" className="home-catalog" aria-label={t.home.allArticles}>
        <div className="home-catalog-header">
          <h2>{t.home.allArticles}</h2>
          <div className="filters-bar">
            <button
              className="filter-btn"
              onClick={(e) => onOpenFilterModal("level", e.currentTarget)}
            >
              {t.nav.level} : {t.levels[globalLevel as keyof typeof t.levels] || globalLevel}
            </button>
            <button
              className="filter-btn"
              onClick={(e) => onOpenFilterModal("category", e.currentTarget)}
            >
              {selectedCategories.length === allCategories.length || selectedCategories.length === 0
                ? t.nav.category
                : `${t.nav.category} (${selectedCategories.length})`}
            </button>
          </div>
        </div>

        {catalogStatus === "loading" ? (
          <p style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
            {t.home.loading}
          </p>
        ) : catalogStatus === "error" ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <p style={{ color: "var(--text-muted)", marginBottom: "16px" }}>
              {t.home.loadError}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: "10px 20px", background: "var(--primary)", color: "white", borderRadius: "10px", border: "none", fontWeight: "bold", cursor: "pointer" }}
            >
              {t.home.retry}
            </button>
          </div>
        ) : filteredArticles.length === 0 ? (
          <p style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
            {t.home.emptyResult}
          </p>
        ) : (
          <ul className="article-list">
            {filteredArticles.map((article, index) => {
              const levelData = article.levels[globalLevel];
              const displayTitle = levelData?.title || article.originalTitle;
              const imgUrl = formatDriveUrl(article.imageUrl);
              const dateFormatted = article.date
                ? new Date(article.date).toLocaleDateString(appLang === "ja" ? "ja-JP" : "en-US")
                : "";

              return (
                <li key={article.id || index} style={{ padding: 0, margin: 0 }}>
                  <button
                    type="button"
                    onClick={() => openArticle(article, false, "catalog")}
                    className={`article-card fade-in reset-button ${index === 0 ? "hero-format" : "list-format"}`}
                    style={{ width: "100%", textAlign: "left", display: "flex" }}
                  >
                    {imgUrl && (
                      <div className="article-image-container">
                        <img
                          src={imgUrl}
                          alt={typeof displayTitle === "string" ? displayTitle : displayTitle?.fr || ""}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            const id = extractDriveId(article.imageUrl);
                            const fallback = id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1000` : "";
                            if (fallback && e.currentTarget.src !== fallback) {
                              e.currentTarget.src = fallback;
                            }
                          }}
                        />
                      </div>
                    )}
                    <div className="article-card-content">
                      <h3 lang="fr">{typeof displayTitle === "string" ? displayTitle : displayTitle?.fr}</h3>
                      <p style={{ display: "flex", alignItems: "center", gap: "6px", margin: 0, flexWrap: "wrap" }}>
                        <span className="badge">{globalLevel}</span>
                        <span
                          className="badge"
                          style={{ background: "var(--bg)", color: "var(--text-muted)", textTransform: "capitalize" }}
                        >
                          {typeof article.category === "string" ? article.category : (article.category?.[appLang] || article.category?.ja || "General")}
                        </span>
                        {dateFormatted && (
                          <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginLeft: "auto" }}>
                            {dateFormatted}
                          </span>
                        )}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* D. SECONDARY LEARNING FEATURES — condensed, below the catalogue */}
      <section className="home-secondary" aria-label={t.home.moreForYou}>
        {/* Compact habit status + streak */}
        <section aria-label={t.habit.title}>
          {streakStatus.state !== "none" && streakStatus.state !== "done_today" && (
            <div
              data-testid="habit-nudge"
              data-state={streakStatus.state}
              aria-live="polite"
              className="habit-nudge-compact"
            >
              <span aria-hidden="true" style={{ fontSize: "1rem", lineHeight: 1.4 }}>🔥</span>
              <p style={{ margin: 0, fontWeight: 700 }}>
                {(streakStatus.state === "broken"
                  ? t.habit.brokenBody
                  : t.habit.atRiskBody
                ).replace("{streak}", String(streakStatus.display))}
              </p>
            </div>
          )}
          <div
            data-testid="habit-summary"
            className="habit-status-compact"
            aria-label={t.habit.title}
          >
            {streakStatus.display > 0 && (
              <span className="habit-streak">
                <span aria-hidden="true">🔥</span>
                <span>{streakStatus.display} {t.progress.days}</span>
              </span>
            )}
            <span
              className="habit-pill"
              data-habit="mission"
              data-done={isMissionCompletedToday ? "true" : "false"}
              aria-label={`${t.habit.mission}: ${isMissionCompletedToday ? t.habit.statusDone : t.habit.statusPending}`}
            >
              <span aria-hidden="true">{isMissionCompletedToday ? "✓" : "○"}</span>
              {t.habit.mission}
            </span>
            <span
              className="habit-pill"
              data-habit="review"
              data-done={isVocabReviewCompletedToday ? "true" : "false"}
              aria-label={`${t.habit.review}: ${isVocabReviewCompletedToday ? t.habit.statusDone : t.habit.statusPending}`}
            >
              <span aria-hidden="true">{isVocabReviewCompletedToday ? "✓" : "○"}</span>
              {t.habit.review}
            </span>
            <span
              className="habit-pill"
              data-habit="learningDay"
              data-done={lastStreakDate === todayStr ? "true" : "false"}
              aria-label={`${t.habit.learningDay}: ${lastStreakDate === todayStr ? t.habit.statusDone : t.habit.statusPending}`}
            >
              <span aria-hidden="true">{lastStreakDate === todayStr ? "✓" : "○"}</span>
              {t.habit.learningDay}
            </span>
          </div>
        </section>

        {/* Review (when not the primary action) */}
        {nextBestActionType !== "review" && (dueReviewCount > 0 || savedWords.length > 0) && (
          <section aria-labelledby="home-review">
            <h2 id="home-review" style={homeSectionLabel}>{t.home.reviewSection}</h2>
            {dueReviewCount > 0 ? (
              <div style={{ ...homeCard, display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 150px", minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--text-main)" }}>
                    {(dueReviewCount === 1 ? t.home.reviewDueOne : t.home.reviewDue).replace("{count}", String(dueReviewCount))}
                  </p>
                  <p style={homeMeta}>{t.home.reviewBeforeForget}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    trackEvent("home_cta_clicked", { cta_type: "srs", position: 2 });
                    startVocabReview("learned");
                  }}
                  style={{ ...homeCtaSecondary, width: "auto", flex: "0 0 auto", padding: "12px 22px" }}
                >
                  {t.home.reviewCta}
                </button>
              </div>
            ) : (
              <p style={homeCompactLine}>
                {learnedWords.length === 0
                  ? t.home.reviewEmptyNoWords
                  : nextReviewOffset === 0
                    ? t.home.reviewNoneLaterToday
                    : nextReviewOffset === 1
                      ? t.home.reviewNoneTomorrow
                      : nextReviewOffset !== null
                        ? t.home.reviewNoneInDays.replace("{days}", String(nextReviewOffset))
                        : t.home.reviewNone}
              </p>
            )}
            {savedWords.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  trackEvent("home_cta_clicked", { cta_type: "srs", position: 3 });
                  startVocabReview("saved");
                }}
                style={{ background: "none", border: "none", padding: "8px 2px", minHeight: "44px", color: "var(--primary)", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer", textAlign: "left" }}
              >
                {t.home.practiceSaved.replace("{count}", String(savedWords.length))}
              </button>
            )}
          </section>
        )}

        {/* Mission (when not the primary action) */}
        {nextBestActionType !== "mission" && dailyArticle && !isMissionCompletedToday && !missionIsContinue && (
          <section aria-labelledby="home-mission">
            <h2 id="home-mission" style={homeSectionLabel}>{t.home.missionSection}</h2>
            <div style={homeCard}>
              <div style={{ display: "flex", gap: "12px", alignItems: "center", minWidth: 0 }}>
                {dailyArticle.imageUrl && (
                  <div style={homeThumb(56)}>
                    <img src={formatDriveUrl(dailyArticle.imageUrl)} alt="" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: "0 0 4px", fontSize: "0.85rem", fontWeight: 800, color: "var(--primary)" }}>
                    {t.home.missionFinish}
                  </p>
                  <h3 lang="fr" style={homeTitle}>{getArticleTitle(dailyArticle)}</h3>
                  <p style={homeMeta}>{t.home.missionMeta}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  trackEvent("home_cta_clicked", { cta_type: "mission", position: 2 });
                  openArticle(dailyArticle, false, "home_mission");
                }}
                style={{ ...homeCtaSecondary, marginTop: "12px" }}
              >
                {t.reading.read}
              </button>
            </div>
          </section>
        )}

        {/* Continue (when not the primary action) */}
        {nextBestActionType !== "continue" && continueTarget && (
          <section aria-labelledby="home-continue">
            <h2 id="home-continue" style={homeSectionLabel}>
              {continueArticle ? t.home.continueTitle : t.home.continueSeriesTitle}
            </h2>
            <div style={homeCard}>
              <div style={{ display: "flex", gap: "12px", alignItems: "center", minWidth: 0 }}>
                {continueTarget.imageUrl && (
                  <div style={homeThumb(56)}>
                    <img src={formatDriveUrl(continueTarget.imageUrl)} alt="" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 lang="fr" style={homeTitle}>{getArticleTitle(continueTarget)}</h3>
                  <p style={homeMeta}>
                    {[
                      t.levels[globalLevel as keyof typeof t.levels],
                      getCategoryLabel(continueTarget),
                      !continueArticle && continueTarget.seriesOrder ? t.home.episode.replace("{n}", String(continueTarget.seriesOrder)) : "",
                    ].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
              {continueArticle && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "12px" }}>
                  <div role="progressbar" aria-label={t.home.readingProgress} aria-valuemin={0} aria-valuemax={100} aria-valuenow={continuePercent} style={{ flex: 1, height: "6px", borderRadius: "6px", background: "var(--bg)", overflow: "hidden" }}>
                    <div style={{ width: `${continuePercent}%`, height: "100%", background: "var(--primary)" }} />
                  </div>
                  <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--primary)", minWidth: "4ch", textAlign: "right" }}>
                    {continuePercent}%
                  </span>
                </div>
              )}
              {missionIsContinue && !isMissionCompletedToday && (
                <p style={{ ...homeMeta, color: "var(--primary)", fontWeight: 700, marginTop: "10px" }}>
                  {t.home.missionTag}
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  trackEvent("home_cta_clicked", { cta_type: "continue", position: 1 });
                  openArticle(continueTarget, false, "home_continue");
                }}
                style={{ ...homeCtaSecondary, marginTop: "12px" }}
              >
                {continueArticle ? t.home.continueCta : t.home.nextEpisodeCta}
              </button>
            </div>
          </section>
        )}

        {/* Recommendations */}
        {recommendedArticles.length > 0 && (
          <section aria-labelledby="home-reco">
            <h2 id="home-reco" style={homeSectionLabel}>{t.home.recommended}</h2>
            <ul style={{ ...homeCard, listStyle: "none", margin: 0, padding: "2px 12px" }}>
              {recommendedArticles.map((a, i) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => {
                      trackEvent("home_cta_clicked", { cta_type: "recommendation", position: 3 + i });
                      openArticle(a, false, "recommendation");
                    }}
                    style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%", minWidth: 0, padding: "10px 0", background: "none", border: "none", borderTop: i === 0 ? "none" : "1px solid var(--border)", cursor: "pointer", textAlign: "left", color: "inherit", font: "inherit" }}
                  >
                    {a.imageUrl ? (
                      <span style={{ ...homeThumb(52), display: "block" }}>
                        <img src={formatDriveUrl(a.imageUrl)} alt="" loading="lazy" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </span>
                    ) : null}
                    <span style={{ flex: 1, minWidth: 0, display: "block" }}>
                      <span lang="fr" style={{ ...homeTitle, fontSize: "0.97rem" }}>{getArticleTitle(a)}</span>
                      {getCategoryLabel(a) && <span style={{ ...homeMeta, display: "block" }}>{getCategoryLabel(a)}</span>}
                    </span>
                    <span aria-hidden="true" style={{ color: "var(--text-muted)", fontSize: "1.3rem", flexShrink: 0 }}>›</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Progress widget */}
        {renderHomeProgressWidget()}
      </section>
    </main>
  );
}
