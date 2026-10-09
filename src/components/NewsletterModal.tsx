"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  checkEmailAvailability,
  submitNewsletterSubscription,
  validateEmail,
} from "../lib/newsletter";
import { getTranslation } from "../lib/i18n";

export interface NewsletterModalProps {
  isOpen: boolean;
  onClose: () => void;
  appLang: string;
  availableCategories: string[];
  initialEmail?: string;
  onSuccess?: (email: string) => void;
}

type NewsletterStep = 1 | 2 | 3;

const frenchCopy = {
  title: "Inscription à la newsletter Furago",
  step1: "Informations de base",
  step2: "Niveau de français et centres d’intérêt",
  name: "Prénom et nom",
  email: "Adresse e-mail",
  cancel: "Annuler",
  close: "Fermer",
  next: "Suivant",
  back: "Retour",
  checking: "Vérification...",
  submitting: "Envoi...",
  levelPrompt: "Quel est votre niveau actuel en français ?",
  interestsPrompt: "Sélectionnez les catégories qui vous intéressent",
  interestsHint: "(Choisissez une ou plusieurs catégories)",
  confirmation:
    "Merci pour votre inscription ! Un e-mail de confirmation vous a été envoyé.",
  invalidEmail: "Veuillez saisir une adresse e-mail valide.",
  unavailableEmail: "Cette adresse e-mail est déjà inscrite.",
  requiredFields: "Veuillez renseigner votre prénom et votre adresse e-mail.",
  availabilityError: "Impossible de vérifier cette adresse e-mail. Veuillez réessayer.",
  chooseCategory: "Veuillez sélectionner au moins une catégorie.",
  registrationComplete: "Confirmation",
  levels: {
    LVL_1: "Débutant absolu",
    LVL_2: "Débutant",
    LVL_3: "Intermédiaire",
    LVL_4: "Avancé",
  },
} as const;

export default function NewsletterModal({
  isOpen,
  onClose,
  appLang,
  availableCategories,
  initialEmail = "",
  onSuccess,
}: NewsletterModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lang = appLang === "ja" ? "ja" : "en";
  const t = getTranslation(lang);
  const isJapanese = lang === "ja";
  const isFrench = appLang === "fr";

  const [step, setStep] = useState<NewsletterStep>(1);
  const [email, setEmail] = useState(initialEmail);
  const [name, setName] = useState("");
  const [level, setLevel] = useState("LVL_1");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const copy = {
    title: isFrench ? frenchCopy.title : t.newsletter.title,
    stepNames: isFrench
      ? [frenchCopy.step1, frenchCopy.step2, frenchCopy.registrationComplete]
      : [
          t.newsletter.step1,
          t.newsletter.step2,
          isJapanese ? "登録完了" : "Registration complete",
        ],
    name: isFrench ? frenchCopy.name : t.newsletter.name,
    email: isFrench ? frenchCopy.email : t.newsletter.email,
    cancel: isFrench ? frenchCopy.cancel : t.newsletter.cancel,
    close: isFrench ? frenchCopy.close : t.common.close,
    next: isFrench ? frenchCopy.next : isJapanese ? "次へ" : "Next",
    back: isFrench ? frenchCopy.back : "Back",
    checking: isFrench ? frenchCopy.checking : isJapanese ? "確認中..." : "Checking...",
    submitting: isFrench ? frenchCopy.submitting : isJapanese ? "送信中..." : "Submitting...",
    levelPrompt: isFrench
      ? frenchCopy.levelPrompt
      : isJapanese
        ? "現在のフランス語レベルを教えてください。"
        : "What is your current French level?",
    interestsPrompt: isFrench
      ? frenchCopy.interestsPrompt
      : isJapanese
        ? "興味のあるカテゴリーを選んでください"
        : "Select the categories you are interested in",
    interestsHint: isFrench
      ? frenchCopy.interestsHint
      : isJapanese
        ? "（1つ以上タップして選択）"
        : "(Tap to select one or more)",
    confirmation: isFrench ? frenchCopy.confirmation : t.toasts.registrationSuccess,
    invalidEmail: isFrench
      ? frenchCopy.invalidEmail
      : isJapanese
        ? "有効なメールアドレスを入力してください。"
        : "Enter a valid email address.",
    unavailableEmail: isFrench
      ? frenchCopy.unavailableEmail
      : t.toasts.emailRegistered,
    requiredFields: isFrench ? frenchCopy.requiredFields : t.toasts.enterAllFields,
    availabilityError: isFrench
      ? frenchCopy.availabilityError
      : isJapanese
        ? "メールアドレスを確認できませんでした。もう一度お試しください。"
        : "Unable to check email availability.",
    chooseCategory: isFrench ? frenchCopy.chooseCategory : t.toasts.selectCategory,
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setErrorMessage(null);

    if (step === 1) {
      if (!name.trim()) {
        setErrorMessage(copy.requiredFields);
        return;
      }

      const validation = validateEmail(email);
      if (!validation.valid) {
        setErrorMessage(isFrench ? frenchCopy.invalidEmail : validation.error ?? copy.invalidEmail);
        return;
      }

      setLoading(true);
      const availability = await checkEmailAvailability(email.trim());
      setLoading(false);
      if (!availability.available) {
        setErrorMessage(
          availability.error
            ? isFrench || isJapanese
              ? copy.availabilityError
              : availability.error
            : copy.unavailableEmail
        );
        return;
      }

      setStep(2);
      return;
    }

    if (step === 2) {
      if (selectedCategories.length === 0) {
        setErrorMessage(copy.chooseCategory);
        return;
      }

      setLoading(true);
      const normalizedEmail = email.trim().toLowerCase();
      const result = await submitNewsletterSubscription({
        email: normalizedEmail,
        name: name.trim(),
        level,
        categories: selectedCategories,
      });
      setLoading(false);

      if (!result.success) {
        setErrorMessage(
          result.status === "already_exists" ? copy.unavailableEmail : result.error ?? copy.invalidEmail
        );
        return;
      }

      setStep(3);
      onSuccess?.(normalizedEmail);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="lead-dialog"
      aria-labelledby="newsletter-modal-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {isOpen && (
        <form
          className="modal-sheet"
          style={{ maxWidth: "440px", margin: "0 auto", boxSizing: "border-box" }}
          onSubmit={handleSubmit}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px",
            }}
          >
            <h3
              id="newsletter-modal-title"
              style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--primary)" }}
            >
              {copy.title}
            </h3>
            <button
              type="button"
              aria-label={copy.close}
              onClick={onClose}
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
              <span>Step {step} / 3</span>
              <span>{copy.stepNames[step - 1]}</span>
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              {[1, 2, 3].map((progressStep) => (
                <div
                  key={progressStep}
                  style={{
                    flex: 1,
                    height: "5px",
                    borderRadius: "3px",
                    background: progressStep <= step ? "var(--primary)" : "var(--border)",
                    transition: "background 0.25s ease",
                  }}
                />
              ))}
            </div>
          </div>

          {errorMessage && (
            <div
              role="alert"
              aria-live="polite"
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
              {errorMessage}
            </div>
          )}

          {step === 1 && (
            <div className="fade-in">
              <label
                htmlFor="lead-first-name"
                style={{ display: "block", fontSize: "0.84rem", fontWeight: 700, marginBottom: "6px" }}
              >
                {copy.name}
              </label>
              <input
                id="lead-first-name"
                type="text"
                required
                autoFocus
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setErrorMessage(null);
                }}
                placeholder={isJapanese ? "例: 太郎 / Taro" : "e.g. Taro"}
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
                htmlFor="lead-email"
                style={{ display: "block", fontSize: "0.84rem", fontWeight: 700, marginBottom: "6px" }}
              >
                {copy.email}
              </label>
              <input
                id="lead-email"
                type="email"
                required
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setErrorMessage(null);
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
                  onClick={onClose}
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
                  {copy.cancel}
                </button>
                <button
                  type="submit"
                  disabled={loading}
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
                  {loading ? copy.checking : copy.next}
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="fade-in">
              <p
                style={{
                  fontSize: "0.95rem",
                  marginBottom: "14px",
                  color: "var(--text-main)",
                  fontWeight: 600,
                }}
              >
                {copy.levelPrompt}
              </p>
              <div style={{ display: "grid", gap: "8px", marginBottom: "22px" }}>
                {["LVL_1", "LVL_2", "LVL_3", "LVL_4"].map((code) => (
                  <button
                    key={code}
                    type="button"
                    aria-pressed={level === code}
                    onClick={() => {
                      setLevel(code);
                      setErrorMessage(null);
                    }}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "12px",
                      border: level === code ? "2px solid var(--primary)" : "2px solid var(--border)",
                      background: level === code ? "var(--primary-light)" : "var(--surface)",
                      textAlign: "left",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>
                      {isFrench
                        ? frenchCopy.levels[code as keyof typeof frenchCopy.levels]
                        : t.levels[code as keyof typeof t.levels]}
                    </span>
                    {level === code && <span>✔️</span>}
                  </button>
                ))}
              </div>

              <p
                style={{
                  fontSize: "0.95rem",
                  marginBottom: "14px",
                  color: "var(--text-main)",
                  fontWeight: 600,
                }}
              >
                {copy.interestsPrompt}
                <br />
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 400 }}>
                  {copy.interestsHint}
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
                {availableCategories.map((category) => {
                  const isSelected = selectedCategories.includes(category);
                  return (
                    <button
                      key={category}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => {
                        setErrorMessage(null);
                        setSelectedCategories((current) =>
                          isSelected
                            ? current.filter((item) => item !== category)
                            : [...current, category]
                        );
                      }}
                      style={{
                        padding: "8px 14px",
                        borderRadius: "20px",
                        border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border)",
                        background: isSelected ? "var(--primary-light)" : "var(--surface)",
                        color: isSelected ? "var(--primary)" : "var(--text-main)",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      {isSelected ? `✓ ${category}` : category}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
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
                  {copy.back}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: loading ? "var(--border)" : "var(--primary)",
                    color: "white",
                    border: "none",
                    borderRadius: "12px",
                    fontWeight: 700,
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? copy.submitting : isFrench ? "S’inscrire" : t.newsletter.submit}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="fade-in">
              <p
                role="status"
                aria-live="polite"
                style={{
                  fontSize: "0.95rem",
                  marginBottom: "14px",
                  color: "var(--text-main)",
                  fontWeight: 600,
                }}
              >
                {copy.confirmation}
              </p>
              <button
                type="button"
                onClick={onClose}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "var(--primary)",
                  color: "white",
                  border: "none",
                  borderRadius: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {copy.close}
              </button>
            </div>
          )}
        </form>
      )}
    </dialog>
  );
}
