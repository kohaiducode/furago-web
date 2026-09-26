/**
 * ============================================================================
 * FURAGO - GOOGLE APPS SCRIPT : ユーザー管理データベース & 自動ウェルカムメール
 * ============================================================================
 *
 * 使い方（アップデート手順）：
 * 1. Googleスプレッドシートの「拡張機能」>「Apps Script」を開きます。
 * 2. 既存のコードをすべて消して、このファイルの内容を貼り付けて保存（💾）します。
 * 3. 右上の「デプロイ」>「デプロイを管理」> 鉛筆アイコン（編集）> バージョンを「新バージョン」にして「デプロイ」を押します。
 */

const SHEET_USERS = "Users";
const SHEET_TEMPLATE = "EmailTemplate";

/**
 * 1. 2つのシート（Users / EmailTemplate）を日本語で初期化・更新する関数
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // --- シート1 : Users（登録ユーザーデータベース） ---
  let usersSheet = ss.getSheetByName(SHEET_USERS);
  if (!usersSheet) {
    usersSheet = ss.insertSheet(SHEET_USERS);
  }

  // もし以前のバージョンの「Nom (姓)」や「苗字」の列（9列構成）が残っていたら、4列目を自動削除して8列に揃える
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

  // 1行目のヘッダーを日本語で上書き設定
  usersSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // 9列目以降に古いヘッダーが残っていればクリア
  if (usersSheet.getMaxColumns() > headers.length) {
    usersSheet
      .getRange(1, headers.length + 1, 1, usersSheet.getMaxColumns() - headers.length)
      .clear();
  }

  // ヘッダーのデザイン設定
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

  // --- シート2 : EmailTemplate（HTMLが絶対に崩れないメール編集シート） ---
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

  // EmailTemplateシートの見た目・レイアウト設定
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
 * メールアドレスが既にUsersシートに存在するかチェックする補助関数
 */
function isEmailAlreadyRegistered(usersSheet, email) {
  const lastRow = usersSheet.getLastRow();
  if (lastRow < 2) return false;
  const emailColumn = usersSheet.getRange(2, 3, lastRow - 1, 1).getValues().flat();
  const foundIdx = emailColumn.findIndex(
    (item) => String(item).trim().toLowerCase() === email
  );
  return foundIdx !== -1;
}

/**
 * GETリクエスト対応（メールアドレスの重複チェック用）
 */
function doGet(e) {
  try {
    const email = ((e && e.parameter && e.parameter.email) || "").trim().toLowerCase();
    if (!email) {
      return ContentService.createTextOutput(
        JSON.stringify({ status: "ok", message: "Furago Newsletter API is running" })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const usersSheet = ss.getSheetByName(SHEET_USERS);
    if (usersSheet && isEmailAlreadyRegistered(usersSheet, email)) {
      return ContentService.createTextOutput(
        JSON.stringify({
          status: "already_exists",
          message: "このメールアドレスは既に登録されています。"
        })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(
      JSON.stringify({ status: "available" })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: err.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 2. Webアプリからの新規登録データ受信（POST）
 */
function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss.getSheetByName(SHEET_USERS) || !ss.getSheetByName(SHEET_TEMPLATE)) {
      setupDatabase();
    }

    const data = JSON.parse(e.postData.contents);
    const email = (data.email || "").trim().toLowerCase();

    if (!email) {
      return ContentService.createTextOutput(
        JSON.stringify({ status: "error", message: "メールアドレスがありません" })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    const usersSheet = ss.getSheetByName(SHEET_USERS);

    // ステップ1での事前重複チェック、または本登録時の重複チェック
    if (isEmailAlreadyRegistered(usersSheet, email)) {
      return ContentService.createTextOutput(
        JSON.stringify({
          status: "already_exists",
          message: "このメールアドレスは既に登録されています。"
        })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // 事前チェックのみ（action: "check_email"）の場合はここで「利用可能」を返す
    if (data.action === "check_email") {
      return ContentService.createTextOutput(
        JSON.stringify({ status: "available" })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    const name = (data.name || data.firstName || "").trim();
    const gender = (data.gender || "回答しない").trim();
    const level = (data.level || "A1").trim();
    const categories = Array.isArray(data.categories)
      ? data.categories.join("、")
      : (data.categories || "すべて").trim();

    const lastRow = usersSheet.getLastRow();
    const nowFormatted = Utilities.formatDate(
      new Date(),
      "Asia/Tokyo",
      "yyyy-MM-dd HH:mm:ss"
    );

    // 新規ユーザーIDの発行（例: USR-0001）
    const userNumber = lastRow;
    const userId = "USR-" + ("0000" + userNumber).slice(-4);

    // EmailTemplateシートの内容をもとに自動ウェルカムメールを送信
    let emailStatus = "送信済み (" + nowFormatted + ")";
    try {
      sendWelcomeEmail({
        email: email,
        name: name || email.split("@")[0],
        gender: gender,
        level: level,
        categories: categories || "一般"
      });
    } catch (mailErr) {
      emailStatus = "エラー: " + mailErr.toString();
    }

    // Usersシートに1行追加（8列：ID, 登録日時, メールアドレス, 名前, 性別, レベル, 興味のあるカテゴリー, メール送信状況）
    usersSheet.appendRow([
      userId,
      nowFormatted,
      email,
      name,
      gender,
      level,
      categories,
      emailStatus
    ]);

    return ContentService.createTextOutput(
      JSON.stringify({ status: "ok", userId: userId })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: err.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 3. EmailTemplateシートの内容から綺麗なHTMLメールを組み立てて送信する関数
 */
function sendWelcomeEmail(user) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tplSheet = ss.getSheetByName(SHEET_TEMPLATE);

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

  // 変数（{{名前}}, {{レベル}}, {{カテゴリー}} および旧仏語変数）の置換
  const replaceVars = (str) => {
    return str
      .replace(/\{\{\s*(名前|prenom)\s*\}\}/gi, user.name || "")
      .replace(/\{\{\s*(レベル|niveau)\s*\}\}/gi, user.level || "A1")
      .replace(/\{\{\s*(カテゴリー|categories)\s*\}\}/gi, user.categories || "すべて");
  };

  // HTMLエスケープ処理
  const escapeHtml = (str) => {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  };

  const subject = replaceVars(rawSubject);
  const headingHtml = escapeHtml(replaceVars(rawHeading));
  const bodyText = replaceVars(rawBody);

  // テキストの段落・改行を綺麗なHTMLの段落に変換
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
                    <strong>現在のレベル :</strong> ${escapeHtml(user.level)}<br>
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

  GmailApp.sendEmail(user.email, subject, bodyText, mailOptions);
}
