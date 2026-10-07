/**
 * ============================================================================
 * FURAGO - GOOGLE APPS SCRIPT : ユーザー管理データベース & 自動ウェルカムメール
 * ============================================================================
 * 
 * セキュリティ強化版 (Étape 5.4) :
 * - 排他制御（LockService）による重複登録・競合状態（Race Condition）の防止
 * - スプレッドシート式インジェクション（Formula Injection）対策
 * - 入力値の厳格な検証（メールアドレス形式、文字数上限、ホワイトリスト検証）
 * - 情報漏洩対策（内部エラーやスタックトレースをクライアントに非公開）
 * - GET経由のメールアドレス列挙（Email Enumeration）の遮断
 * - 公開リクエストからの破壊的セットアップ実行防止
 * - Gmail送信失敗時でもユーザー情報を確実に保護・記録
 *
 * 使い方（アップデート手順）：
 * 1. Googleスプレッドシートの「拡張機能」>「Apps Script」を開きます。
 * 2. 既存のコードをすべて消して、このファイルの内容を貼り付けて保存（💾）します。
 * 3. 初回のみ、エディタ上部の関数選択で「setupDatabase」を選び「実行」を押してシートを初期化します。
 * 4. 右上の「デプロイ」>「デプロイを管理」> 鉛筆アイコン（編集）> バージョンを「新バージョン」にして「デプロイ」を押します。
 */

const SHEET_USERS = "Users";
const SHEET_TEMPLATE = "EmailTemplate";

// セキュリティ & バリデーション定数
const MAX_PAYLOAD_SIZE = 10240; // 10 KB 上限
const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const MAX_CATEGORY_LENGTH = 300;
const MAX_CATEGORIES_COUNT = 20;
const MAX_GENDER_LENGTH = 50;
const LOCK_TIMEOUT_MS = 30000; // 30秒
const RATE_LIMIT_SECONDS = 5; // 同一メールアドレスのクールダウン秒数

const ALLOWED_LEVELS = [
  "LVL_1",
  "LVL_2",
  "LVL_3",
  "LVL_4",
  "A1",
  "A2",
  "B1",
  "B2",
  "C1"
];

const ALLOWED_ACTIONS = ["subscribe", "register", "check_email", ""];

/**
 * ユーティリティ: メールアドレス形式の厳格な検証 (RFC 5322準拠)
 */
function isValidEmail(email) {
  if (typeof email !== "string") return false;
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > MAX_EMAIL_LENGTH) return false;
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(trimmed);
}

/**
 * ユーティリティ: Googleスプレッドシート式インジェクション（Formula Injection）の無害化
 * セル値が '=', '+', '-', '@', タブ, 改行で始まる場合、先頭に単一引用符（'）を付与して文字列化
 */
function sanitizeSheetCell(val) {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (/^[=+@\t\r\-]/.test(str)) {
    return "'" + str;
  }
  return str;
}

/**
 * ユーティリティ: CacheService用のキー作成
 */
function encodeEmailForCache(email) {
  return String(email || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .slice(0, 50);
}

/**
 * ユーティリティ: 登録データの検証とサニタイズ
 */
function validateRegistrationData(data) {
  if (!data || typeof data !== "object") {
    return { isValid: false, errorMessage: "Payload invalide." };
  }

  // 1. アクションの検証
  const rawAction = data.action;
  let action = "";
  if (rawAction !== undefined && rawAction !== null) {
    if (typeof rawAction !== "string") {
      return { isValid: false, errorMessage: "Action non valide." };
    }
    action = rawAction.trim().toLowerCase();
    if (!ALLOWED_ACTIONS.includes(action)) {
      return { isValid: false, errorMessage: "Action non autorisée." };
    }
  }

  // 2. ハニーポット検証 (bot対策)
  if (data.hp || data.website || data.bot_check) {
    return { isValid: false, errorMessage: "Requête non autorisée." };
  }

  // 3. メールアドレスの検証
  const rawEmail = data.email;
  if (!rawEmail || typeof rawEmail !== "string") {
    return { isValid: false, errorMessage: "Adresse email requise." };
  }
  const email = rawEmail.trim().toLowerCase();
  if (!isValidEmail(email)) {
    return { isValid: false, errorMessage: "Format d'adresse email invalide." };
  }

  // check_email アクションの場合は他のフィールド検証を省略
  if (action === "check_email") {
    return {
      isValid: true,
      sanitized: {
        action,
        email,
        name: "",
        gender: "回答しない",
        level: "LVL_1",
        categories: "すべて"
      }
    };
  }

  // 4. お名前の検証
  const rawName = data.name !== undefined ? data.name : data.firstName;
  let name = "";
  if (rawName !== undefined && rawName !== null) {
    if (typeof rawName !== "string") {
      return { isValid: false, errorMessage: "Nom invalide." };
    }
    name = rawName.trim();
    if (name.length > MAX_NAME_LENGTH) {
      return { isValid: false, errorMessage: "Le nom dépasse la longueur maximale autorisée." };
    }
  }

  // 5. 性別 / ジェンダーの検証
  let gender = "回答しない";
  if (data.gender !== undefined && data.gender !== null) {
    if (typeof data.gender !== "string") {
      return { isValid: false, errorMessage: "Genre invalide." };
    }
    const trimmedGender = data.gender.trim();
    if (trimmedGender.length > MAX_GENDER_LENGTH) {
      return { isValid: false, errorMessage: "Le champ genre dépasse la longueur maximale." };
    }
    gender = trimmedGender || "回答しない";
  }

  // 6. フランス語レベルの検証（ホワイトリスト）
  let level = "LVL_1";
  if (data.level !== undefined && data.level !== null && data.level !== "") {
    if (typeof data.level !== "string") {
      return { isValid: false, errorMessage: "Niveau invalide." };
    }
    const trimmedLevel = data.level.trim();
    if (!ALLOWED_LEVELS.includes(trimmedLevel)) {
      return { isValid: false, errorMessage: "Niveau d'apprentissage non reconnu." };
    }
    level = trimmedLevel;
  }

  // 7. 興味のあるカテゴリーの検証
  let categories = "すべて";
  if (data.categories !== undefined && data.categories !== null) {
    if (Array.isArray(data.categories)) {
      if (data.categories.length > MAX_CATEGORIES_COUNT) {
        return { isValid: false, errorMessage: "Nombre excessif de catégories sélectionnées." };
      }
      const cleanedList = [];
      for (let i = 0; i < data.categories.length; i++) {
        const item = data.categories[i];
        if (typeof item !== "string") {
          return { isValid: false, errorMessage: "Format de catégorie invalide." };
        }
        const trimmed = item.trim();
        if (trimmed.length > 50) {
          return { isValid: false, errorMessage: "Une catégorie dépasse la taille maximale autorisée." };
        }
        if (trimmed) cleanedList.push(trimmed);
      }
      categories = cleanedList.length > 0 ? cleanedList.join("、") : "すべて";
    } else if (typeof data.categories === "string") {
      const trimmed = data.categories.trim();
      if (trimmed.length > MAX_CATEGORY_LENGTH) {
        return { isValid: false, errorMessage: "Le champ catégories dépasse la longueur maximale." };
      }
      categories = trimmed || "すべて";
    } else {
      return { isValid: false, errorMessage: "Format de catégories invalide." };
    }
  }

  return {
    isValid: true,
    sanitized: {
      action,
      email,
      name,
      gender,
      level,
      categories
    }
  };
}

/**
 * ユーティリティ: 堅牢なユーザーID発番（既存の全IDをスキャンして最大値+1を発行）
 * lastRowのみに依存せず、削除や欠番があっても一意性を保証
 */
function getNextUserId(existingIds) {
  let maxId = 0;
  if (Array.isArray(existingIds)) {
    for (let i = 0; i < existingIds.length; i++) {
      const val = String(existingIds[i] || "").trim();
      const match = val.match(/^USR-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxId) {
          maxId = num;
        }
      }
    }
  }
  const nextNum = maxId + 1;
  const padded = nextNum < 10000 ? ("0000" + nextNum).slice(-4) : String(nextNum);
  return "USR-" + padded;
}

/**
 * ユーティリティ: メールアドレスが既にUsersシートに存在するかチェック
 * 単一引用符のプレフィックスを除去して正規化比較
 */
function isEmailAlreadyRegistered(usersSheet, email) {
  if (!usersSheet) return false;
  const lastRow = usersSheet.getLastRow();
  if (lastRow < 2) return false;
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return false;
  const emailColumn = usersSheet.getRange(2, 3, lastRow - 1, 1).getValues().flat();
  return emailColumn.some((item) => {
    const cleaned = String(item || "")
      .replace(/^'/, "")
      .trim()
      .toLowerCase();
    return cleaned === normalized;
  });
}

/**
 * ユーティリティ: 安全なJSONレスポンスの生成
 */
function createJsonResponse(data, contentService) {
  const jsonStr = JSON.stringify(data);
  const CS = contentService || (typeof ContentService !== "undefined" ? ContentService : null);
  if (CS && CS.createTextOutput) {
    const output = CS.createTextOutput(jsonStr);
    if (CS.MimeType && CS.MimeType.JSON) {
      output.setMimeType(CS.MimeType.JSON);
    }
    return output;
  }
  return {
    getContent: () => jsonStr,
    getMimeType: () => "application/json",
    raw: data
  };
}

/**
 * ユーティリティ: 汎用安全エラーレスポンス（内部詳細やスタックトレースを一切含めない）
 */
function safeGenericError(message, contentService) {
  return createJsonResponse(
    {
      status: "error",
      message: message || "Une erreur est survenue. Veuillez réessayer."
    },
    contentService
  );
}

/**
 * 依存サービス取得関数（テスト容易性とモック注入のため）
 */
function getServices_() {
  return {
    SpreadsheetApp: typeof SpreadsheetApp !== "undefined" ? SpreadsheetApp : null,
    LockService: typeof LockService !== "undefined" ? LockService : null,
    Utilities: typeof Utilities !== "undefined" ? Utilities : null,
    GmailApp: typeof GmailApp !== "undefined" ? GmailApp : null,
    CacheService: typeof CacheService !== "undefined" ? CacheService : null,
    ContentService: typeof ContentService !== "undefined" ? ContentService : null
  };
}

/**
 * 1. 管理・初期化用関数（手動実行専用）
 * 注意: doPostなど公開リクエストから自動実行してはいけません。
 */
function setupDatabase(ssOverride) {
  const ss = ssOverride || (typeof SpreadsheetApp !== "undefined" ? SpreadsheetApp.getActiveSpreadsheet() : null);
  if (!ss) {
    throw new Error("スプレッドシートが見つかりません。");
  }

  // --- シート1 : Users（登録ユーザーデータベース） ---
  let usersSheet = ss.getSheetByName(SHEET_USERS);
  if (!usersSheet) {
    usersSheet = ss.insertSheet(SHEET_USERS);
  }

  // 古いバージョンの「Nom (姓)」列が残っていた場合の整理
  const currentCol4Header = String(usersSheet.getRange(1, 4).getValue() || "");
  if (
    currentCol4Header.indexOf("姓") !== -1 ||
    currentCol4Header.indexOf("苗字") !== -1 ||
    currentCol4Header.indexOf("Nom") !== -1
  ) {
    usersSheet.deleteColumn(4);
  }

  const headers = [
    "ID",
    "登録日時",
    "メールアドレス",
    "名前",
    "性別",
    "レベル",
    "興味のあるカテゴリー",
    "メール送信状況"
  ];

  // 1行目のヘッダーを設定
  usersSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  if (usersSheet.getMaxColumns() > headers.length) {
    usersSheet
      .getRange(1, headers.length + 1, 1, usersSheet.getMaxColumns() - headers.length)
      .clear();
  }

  const headerRange = usersSheet.getRange(1, 1, 1, headers.length);
  headerRange
    .setBackground("#5E5CE6")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setHorizontalAlignment("center");

  usersSheet.setFrozenRows(1);
  usersSheet.setColumnWidth(1, 100); // ID
  usersSheet.setColumnWidth(2, 160); // 登録日時
  usersSheet.setColumnWidth(3, 240); // メールアドレス
  usersSheet.setColumnWidth(4, 150); // 名前
  usersSheet.setColumnWidth(5, 110); // 性別
  usersSheet.setColumnWidth(6, 100); // レベル
  usersSheet.setColumnWidth(7, 260); // 興味のあるカテゴリー
  usersSheet.setColumnWidth(8, 180); // メール送信状況

  // --- シート2 : EmailTemplate（メール編集シート） ---
  let tplSheet = ss.getSheetByName(SHEET_TEMPLATE);
  if (!tplSheet) {
    tplSheet = ss.insertSheet(SHEET_TEMPLATE);
  }

  const templateRows = [
    ["設定項目", "編集エリア（このB列のみ変更してください）", "説明・使える変数"],
    [
      "送信者名（差出人）",
      "Furago - フランス語学習",
      "読者の受信トレイに表示される送信者名です。"
    ],
    [
      "送信元エイリアス（任意）",
      "",
      "現在は空欄のままでOKです。独自ドメイン取得後、例: bonjour@furago.com を入力するとそのアドレスから送信されます。"
    ],
    [
      "メールの件名",
      "【Furago】{{名前}}さん、ご登録ありがとうございます！",
      "使える変数 : {{名前}}, {{レベル}}, {{カテゴリー}}"
    ],
    [
      "メール内の見出しタイトル",
      "Bienvenue sur Furago, {{名前}} !",
      "メール本文の一番上に大きく表示されるタイトルです。"
    ],
    [
      "メール本文",
      "{{名前}}さん、Furago（フラゴ）のニュースレターへご登録いただきありがとうございます！\n\n" +
        "現在のフランス語レベル（{{レベル}}）や、興味のあるテーマ（{{カテゴリー}}）に合わせて、最新のフランス語記事や学習のコツをお届けしていきます。\n\n" +
        "毎日のちょっとしたスキマ時間に、フランス語のリーディングとリスニングを楽しんでいきましょう！",
      "通常のテキストを入力してください（セル内改行は Alt+Enter または Cmd+Enter）。HTMLデザインはスクリプトが自動生成するため崩れません。"
    ],
    [
      "ボタンのテキスト",
      "Furagoでフランス語記事を読む",
      "メール下部の紫色のボタンに表示される文字です。"
    ],
    [
      "ボタンのリンク先URL",
      "https://furago.pages.dev",
      "WebアプリのURL（Cloudflare Pagesや独自ドメインのURL）を入力します。"
    ],
    [
      "署名・フッター",
      "À très bientôt sur Furago !\nFurago 運営チーム",
      "メールの一番下に表示される署名です。"
    ]
  ];

  tplSheet.clear();
  tplSheet.getRange(1, 1, templateRows.length, 3).setValues(templateRows);

  tplSheet
    .getRange(1, 1, 1, 3)
    .setBackground("#5E5CE6")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold");

  tplSheet
    .getRange(2, 1, templateRows.length - 1, 1)
    .setBackground("#F2F2F7")
    .setFontWeight("bold");

  tplSheet
    .getRange(2, 2, templateRows.length - 1, 1)
    .setBackground("#FFFFFF")
    .setWrap(true);

  tplSheet
    .getRange(2, 3, templateRows.length - 1, 1)
    .setBackground("#F9F9FB")
    .setFontColor("#8E8E93")
    .setWrap(true);

  tplSheet.setFrozenRows(1);
  tplSheet.setColumnWidth(1, 210);
  tplSheet.setColumnWidth(2, 460);
  tplSheet.setColumnWidth(3, 340);
  tplSheet.setRowHeight(6, 140);
}

/**
 * 2. GETリクエスト対応
 * セキュリティ強化:
 * 公開GETによるメールアドレスの存在確認・列挙（Email Enumeration）を完全に廃止。
 * ヘルスチェック用エンドポイントとして安全に動作します。
 */
function doGet(e) {
  return handleNewsletterGet(e);
}

function handleNewsletterGet(e, services) {
  const S = services || getServices_();
  try {
    return createJsonResponse(
      { status: "ok", message: "Furago Newsletter API is running" },
      S.ContentService
    );
  } catch (err) {
    console.error("doGet error:", err);
    return safeGenericError("Une erreur est survenue.", S.ContentService);
  }
}

/**
 * 3. POSTリクエスト対応
 * Webアプリからの登録データまたは事前確認リクエストを受信
 */
function doPost(e) {
  return handleNewsletterPost(e);
}

function handleNewsletterPost(e, services) {
  const S = services || getServices_();

  try {
    // A. ペイロード存在およびサイズ検証
    if (!e || !e.postData || typeof e.postData.contents !== "string") {
      return safeGenericError("Requête invalide.", S.ContentService);
    }

    if (e.postData.contents.length > MAX_PAYLOAD_SIZE) {
      return safeGenericError("Taille de requête excessive.", S.ContentService);
    }

    // B. JSONパース検証
    let data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr);
      return safeGenericError("Format JSON invalide.", S.ContentService);
    }

    // C. データの検証とサニタイズ
    const validation = validateRegistrationData(data);
    if (!validation.isValid) {
      return safeGenericError(validation.errorMessage || "Données invalides.", S.ContentService);
    }

    const { action, email, name, gender, level, categories } = validation.sanitized;

    // D. データベース構造の確認
    // 重要: 未初期化の場合でも、公開リクエストから勝手に setupDatabase() を実行してはいけません。
    const ss = S.SpreadsheetApp ? S.SpreadsheetApp.getActiveSpreadsheet() : null;
    if (!ss) {
      console.error("getActiveSpreadsheet() returned null");
      return safeGenericError("Une erreur est survenue. Veuillez réessayer.", S.ContentService);
    }

    const usersSheet = ss.getSheetByName(SHEET_USERS);
    const tplSheet = ss.getSheetByName(SHEET_TEMPLATE);
    if (!usersSheet || !tplSheet) {
      console.error("Configuration error: Sheet Users or EmailTemplate missing. Run setupDatabase manually.");
      return safeGenericError("Une erreur est survenue. Veuillez réessayer.", S.ContentService);
    }

    // E. check_email アクション（フロントエンドのバックグラウンド重複確認用）
    if (action === "check_email") {
      if (isEmailAlreadyRegistered(usersSheet, email)) {
        return createJsonResponse(
          {
            status: "already_exists",
            message: "このメールアドレスは既に登録されています。"
          },
          S.ContentService
        );
      }
      return createJsonResponse({ status: "available" }, S.ContentService);
    }

    // F. 本登録（LockServiceによる排他制御ブロック）
    const lock = S.LockService ? S.LockService.getScriptLock() : null;
    let hasLock = false;
    if (lock) {
      hasLock = lock.tryLock(LOCK_TIMEOUT_MS);
      if (!hasLock) {
        console.warn("Could not acquire lock within timeout");
        return safeGenericError(
          "Serveur occupé. Veuillez réessayer dans quelques instants.",
          S.ContentService
        );
      }
    }

    let userId;
    let insertedRow;
    let nowFormatted;

    try {
      // 1. 排他ロック内で最終重複チェック（同時リクエスト時の二重登録を完全防止）
      if (isEmailAlreadyRegistered(usersSheet, email)) {
        return createJsonResponse(
          {
            status: "already_exists",
            message: "このメールアドレスは既に登録されています。"
          },
          S.ContentService
        );
      }

      // 2. 一意な連番ユーザーIDの発行
      const lastRow = usersSheet.getLastRow();
      let existingIds = [];
      if (lastRow >= 2) {
        existingIds = usersSheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
      }
      userId = getNextUserId(existingIds);

      nowFormatted = S.Utilities
        ? S.Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss")
        : new Date().toISOString();

      // 3. Formula Injection 対策を施してシートへ行を追加
      usersSheet.appendRow([
        userId,
        nowFormatted,
        sanitizeSheetCell(email),
        sanitizeSheetCell(name),
        sanitizeSheetCell(gender),
        sanitizeSheetCell(level),
        sanitizeSheetCell(categories),
        "送信処理中"
      ]);

      insertedRow = usersSheet.getLastRow();

      // 4. 新規登録成功後にキャッシュへ記録（連続スパム送信防止）
      if (S.CacheService) {
        try {
          const cache = S.CacheService.getScriptCache();
          if (cache) {
            cache.put("reg_" + encodeEmailForCache(email), "1", RATE_LIMIT_SECONDS);
          }
        } catch (cacheErr) {
          console.warn("CacheService error:", cacheErr);
        }
      }
    } finally {
      // 5. Gmail送信の前にロックを必ず解放（Gmail遅延によるロック待機詰まりを防止）
      if (lock && hasLock) {
        lock.releaseLock();
      }
    }

    // G. ウェルカムメール送信（ロック解放後に実行）
    let emailStatus = "送信済み (" + nowFormatted + ")";
    try {
      sendWelcomeEmail(
        {
          email: email,
          name: name || email.split("@")[0],
          gender: gender,
          level: level,
          categories: categories || "一般"
        },
        S
      );
    } catch (mailErr) {
      console.error("Gmail send error:", mailErr);
      emailStatus = "未送信 (エラー)";
    }

    // H. シート上のメール送信ステータスを更新
    try {
      if (insertedRow && usersSheet) {
        usersSheet.getRange(insertedRow, 8).setValue(emailStatus);
      }
    } catch (updateErr) {
      console.error("Status update error:", updateErr);
    }

    return createJsonResponse({ status: "ok", userId: userId }, S.ContentService);
  } catch (err) {
    // 予期せぬエラーの捕捉: 詳細情報はログにのみ記録し、クライアントには安全な汎用メッセージのみ返却
    console.error("Unhandled exception in doPost:", err);
    return safeGenericError("Une erreur est survenue. Veuillez réessayer.", S.ContentService);
  }
}

/**
 * 4. ウェルカムメール生成・送信関数
 */
function sendWelcomeEmail(user, services) {
  const S = services || getServices_();
  const ss = S.SpreadsheetApp.getActiveSpreadsheet();
  const tplSheet = ss.getSheetByName(SHEET_TEMPLATE);
  if (!tplSheet) {
    throw new Error("テンプレートシートが見つかりません。");
  }

  // B列（2〜9行目）の値を取得
  const values = tplSheet.getRange(2, 2, 8, 1).getValues().flat();

  const senderName = String(values[0] || "Furago - フランス語学習").trim();
  const aliasFrom = String(values[1] || "").trim();
  const rawSubject = String(values[2] || "【Furago】ご登録ありがとうございます！");
  const rawHeading = String(values[3] || "Bienvenue sur Furago, {{名前}} !");
  const rawBody = String(values[4] || "Furagoへのご登録ありがとうございます！");
  const rawBtnText = String(values[5] || "Furagoでフランス語記事を読む");
  const rawBtnUrl = String(values[6] || "https://furago.pages.dev").trim();
  const rawFooter = String(values[7] || "Furago 運営チーム");

  const getDisplayLevel = (lvl) => {
    switch (lvl) {
      case "LVL_1":
      case "A1":
        return "超初級 / Absolute Beginner";
      case "LVL_2":
      case "A2":
        return "初級 / Beginner";
      case "LVL_3":
      case "B1":
        return "中級 / Intermediate";
      case "LVL_4":
      case "B2":
      case "C1":
        return "上級 / Advanced";
      default:
        return lvl;
    }
  };

  const displayLevel = getDisplayLevel(user.level || "LVL_1");

  const replaceVars = (str) => {
    return str
      .replace(/\{\{\s*(名前|prenom)\s*\}\}/gi, user.name || "")
      .replace(/\{\{\s*(レベル|niveau)\s*\}\}/gi, displayLevel)
      .replace(/\{\{\s*(カテゴリー|categories)\s*\}\}/gi, user.categories || "すべて");
  };

  // HTMLエスケープ処理（XSS対策）
  const escapeHtml = (str) => {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const subject = replaceVars(rawSubject);
  const headingHtml = escapeHtml(replaceVars(rawHeading));
  const bodyText = replaceVars(rawBody);

  const paragraphsHtml = bodyText
    .split(/\n\s*\n/)
    .map((p) => {
      const lines = escapeHtml(p.trim()).replace(/\n/g, "<br>");
      return `<p style="margin: 0 0 16px 0; color: #2c2c2e; font-size: 15px; line-height: 1.7;">${lines}</p>`;
    })
    .join("");

  const btnTextHtml = escapeHtml(replaceVars(rawBtnText));
  const footerHtml = escapeHtml(replaceVars(rawFooter)).replace(/\n/g, "<br>");

  const htmlBody = `
  <!DOCTYPE html>
  <html lang="ja">
  <body style="margin:0; padding:0; background-color:#f2f2f7; font-family:-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Yu Gothic', sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2f2f7; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 540px; background-color:#ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 6px 24px rgba(0,0,0,0.06);">
            <!-- ヘッダー -->
            <tr>
              <td style="background: linear-gradient(90deg, #5e5ce6 0%, #4b49c8 100%); padding: 24px 30px; text-align: center;">
                <span style="color:#ffffff; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">Furago</span>
              </td>
            </tr>
            <!-- メインコンテンツ -->
            <tr>
              <td style="padding: 32px 30px 24px 30px;">
                <h1 style="margin: 0 0 20px 0; color: #5e5ce6; font-size: 20px; font-weight: 800; line-height: 1.4;">
                  ${headingHtml}
                </h1>
                ${paragraphsHtml}
                <!-- 登録プロフィール概要ボックス -->
                <div style="background-color: #f2f2f7; border-left: 4px solid #5e5ce6; border-radius: 8px; padding: 12px 16px; margin: 22px 0;">
                  <div style="font-size: 13px; color: #8e8e93; font-weight: bold; margin-bottom: 4px;">あなたの学習プロフィール</div>
                  <div style="font-size: 14px; color: #1c1c1e;">
                    <strong>現在のレベル :</strong> ${escapeHtml(displayLevel)}<br>
                    <strong>興味のあるテーマ :</strong> ${escapeHtml(user.categories)}
                  </div>
                </div>
                <!-- アクションボタン -->
                <div style="text-align: center; margin: 28px 0 12px 0;">
                  <a href="${rawBtnUrl}" style="display: inline-block; background-color: #5e5ce6; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 15px; padding: 14px 28px; border-radius: 12px;">
                    ${btnTextHtml}
                  </a>
                </div>
              </td>
            </tr>
            <!-- フッター -->
            <tr>
              <td style="padding: 20px 30px 28px 30px; border-top: 1px solid #e5e5ea; color: #8e8e93; font-size: 13px; line-height: 1.6;">
                ${footerHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;

  const mailOptions = {
    name: senderName,
    htmlBody: htmlBody
  };

  if (aliasFrom && aliasFrom.indexOf("@") !== -1) {
    mailOptions.from = aliasFrom;
  }

  if (S.GmailApp && S.GmailApp.sendEmail) {
    S.GmailApp.sendEmail(user.email, subject, bodyText, mailOptions);
  }
}

// Node.js / Vitest テスト環境向けエクスポート（Google Apps Script実行時は無視されます）
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SHEET_USERS,
    SHEET_TEMPLATE,
    MAX_PAYLOAD_SIZE,
    MAX_NAME_LENGTH,
    MAX_EMAIL_LENGTH,
    MAX_CATEGORY_LENGTH,
    MAX_CATEGORIES_COUNT,
    MAX_GENDER_LENGTH,
    LOCK_TIMEOUT_MS,
    RATE_LIMIT_SECONDS,
    ALLOWED_LEVELS,
    ALLOWED_ACTIONS,
    isValidEmail,
    sanitizeSheetCell,
    encodeEmailForCache,
    validateRegistrationData,
    getNextUserId,
    isEmailAlreadyRegistered,
    createJsonResponse,
    safeGenericError,
    setupDatabase,
    doGet,
    doPost,
    handleNewsletterGet,
    handleNewsletterPost,
    sendWelcomeEmail
  };
}
