/**
 * 営業判定エンジン
 * ------------------------------------------------------------------
 * 問合せの内容から「営業目的の送信」らしさを 0〜100 点で採点する。
 *   0〜29  … 見込み客（client）
 *  30〜59  … 要確認（unsure）
 *  60〜100 … 営業（sales）
 *
 * 加点・減点の理由は必ず reasons に日本語で残す。
 * 管理画面で人が付けたラベルは rules（学習）に反映され、次回から即断できる。
 */

/* ---- 強い営業のことば（一斉送信・提携依頼の定型） ---- */
const W_STRONG = [
  "貴事務所様", "貴所様", "貴社様", "ご担当者様", "担当者様",
  "突然のご連絡", "突然のメール", "初めてご連絡", "はじめてご連絡",
  "業務提携", "アライアンス", "ご提案させて", "提携のご案内",
  "お取引のご提案", "弊社サービス", "弊社では", "当社サービス",
  "代理店", "相互リンク", "一斉送信", "掲載のご案内", "広告掲載",
  "記事広告", "取材のご依頼", "無料掲載", "営業のご連絡",
];

/* ---- 売り込まれがちな商材 ---- */
const W_PRODUCT = [
  "SEO", "ＳＥＯ", "MEO", "被リンク", "集客支援", "集客", "リスティング",
  "ホームページ制作", "HP制作", "Web制作", "ウェブ制作", "サイト制作",
  "システム開発", "アプリ開発", "オフショア", "ラボ型",
  "人材紹介", "人材派遣", "採用支援", "求人広告", "採用代行",
  "DX支援", "DX推進", "業務効率化ツール", "RPA", "チャットボット",
  "助成金申請", "補助金申請代行", "融資コンサル", "資金調達支援",
  "M&A", "事業承継マッチング", "節税スキーム", "節税商品",
  "保険の見直し", "生命保険", "太陽光", "不動産投資", "投資用マンション",
  "仮想通貨", "暗号資産", "FX", "副業", "アフィリエイト",
  "名簿", "リスト販売", "営業代行", "テレアポ代行", "インサイドセールス",
  "電話代行", "翻訳", "動画制作", "記帳代行のアウトソース", "オンライン秘書",
  "会計ソフトのご紹介", "士業向け", "税理士事務所様向け", "会計事務所様向け",
];

/* ---- 勧誘の決まり文句 ---- */
const W_PITCH = [
  "無料トライアル", "無料体験", "無料で", "初期費用0", "初期費用無料",
  "成果報酬", "ノーリスク", "リスクなく", "月額",
  "お電話でご説明", "オンライン商談", "オンラインでご説明", "web会議",
  "15分", "30分ほど", "お時間を頂戴", "資料をお送り", "資料送付",
  "ぜひ一度", "一度お話", "ご興味", "ご検討いただけ", "お役に立てる",
  "キャンペーン", "先着", "期間限定", "特別価格", "今なら",
];

/* ---- 本当の相談に出ることば（減点） ---- */
const W_CLIENT = [
  "相続", "遺産", "遺言", "亡くなり", "亡くなっ", "相続人", "被相続人",
  "父が", "母が", "主人が", "祖父", "祖母", "実家",
  "確定申告", "顧問税理士", "顧問料", "決算", "申告", "法人成り",
  "記帳", "年末調整", "贈与", "譲渡", "税務調査", "修正申告",
  "開業", "起業", "独立", "個人事業", "法人化", "会社を設立",
  "自宅", "土地", "不動産を売却", "売却しま", "マンションを売",
  "見積", "いくら", "費用", "料金", "報酬",
  "相談したい", "相談させて", "教えていただき", "お願いしたい",
  "困って", "悩んで", "不安", "引き継", "承継", "扶養", "青色",
  "従業員", "売上", "赤字", "黒字", "資金繰り", "創業",
];

/* ---- フリーメール ---- */
const FREE_MAIL = [
  "gmail.com", "yahoo.co.jp", "yahoo.ne.jp", "ymail.ne.jp", "outlook.jp",
  "outlook.com", "hotmail.com", "hotmail.co.jp", "live.jp", "icloud.com",
  "me.com", "docomo.ne.jp", "ezweb.ne.jp", "au.com", "softbank.ne.jp",
  "i.softbank.jp", "nifty.com", "so-net.ne.jp", "ocn.ne.jp", "aol.com",
  "proton.me", "protonmail.com",
];

/* 指定語のうち本文に出てきたものを返す */
function hits(text, words) {
  const found = [];
  for (const w of words) {
    if (text.includes(w)) found.push(w);
  }
  return found;
}

export function emailDomain(email) {
  const m = String(email || "").toLowerCase().match(/@([a-z0-9.\-]+)$/);
  return m ? m[1] : "";
}

/**
 * @param {object} d 問合せ内容 {kind,name,kana,company,email,tel,body,source,elapsed,hp,ipCount}
 * @param {object} rules 学習済みルール {ngDomains:Set, okDomains:Set, ngWords:string[]}
 * @returns {{score:number, verdict:string, reasons:string[]}}
 */
export function scoreInquiry(d, rules) {
  const r = rules || {};
  const ngDomains = r.ngDomains || new Set();
  const okDomains = r.okDomains || new Set();
  const ngWords = r.ngWords || [];

  const body = String(d.body || "");
  const name = String(d.name || "");
  const company = String(d.company || "");
  const email = String(d.email || "");
  const tel = String(d.tel || "");
  const all = [body, name, company, String(d.kind || "")].join("\n");
  const domain = emailDomain(email);

  const reasons = [];
  let score = 0;

  /* ===== 即断できるもの ===== */
  if (d.hp) {
    return {
      score: 100,
      verdict: "sales",
      reasons: ["人には見えない項目に入力があった（自動送信プログラム）"],
    };
  }
  if (domain && okDomains.has(domain)) {
    return {
      score: 0,
      verdict: "client",
      reasons: [`過去に「見込み客」と登録されたドメイン（${domain}）`],
    };
  }
  if (domain && ngDomains.has(domain)) {
    return {
      score: 100,
      verdict: "sales",
      reasons: [`過去に「営業」と登録されたドメイン（${domain}）`],
    };
  }
  const ngHit = hits(all, ngWords);
  if (ngHit.length) {
    score += 60;
    reasons.push(`登録済みのNGワードに一致：${ngHit.slice(0, 4).join("・")}`);
  }

  /* ===== ことばによる採点 ===== */
  const s = hits(all, W_STRONG);
  if (s.length) {
    score += Math.min(s.length * 18, 45);
    reasons.push(`一斉送信によくある言い回し：${s.slice(0, 4).join("・")}`);
  }

  const p = hits(all, W_PRODUCT);
  if (p.length) {
    score += Math.min(p.length * 13, 39);
    reasons.push(`売り込みの商材らしい語：${p.slice(0, 4).join("・")}`);
  }

  const t = hits(all, W_PITCH);
  if (t.length >= 2) {
    score += Math.min(t.length * 9, 27);
    reasons.push(`勧誘の決まり文句：${t.slice(0, 4).join("・")}`);
  }

  const c = hits(body, W_CLIENT);
  if (c.length) {
    const minus = Math.min(c.length * 10, 45);
    score -= minus;
    reasons.push(`具体的な相談内容が書かれている：${c.slice(0, 5).join("・")}（−${minus}）`);
  }

  /* ===== 書き方・形式による採点 ===== */
  if (/https?:\/\//i.test(body)) {
    score += 22;
    reasons.push("本文にURLが貼られている");
  }
  if (company && domain && FREE_MAIL.includes(domain)) {
    score += 12;
    reasons.push(`会社名の記載があるのにフリーメール（${domain}）`);
  }
  if (company && !tel) {
    score += 8;
    reasons.push("会社名はあるが電話番号の記載がない");
  }
  if (/(ご)?担当|部長|課長|責任者/.test(name) && name.length <= 8) {
    score += 15;
    reasons.push("氏名欄が個人名ではなく役職・担当名");
  }
  const corpCount = (all.match(/株式会社|有限会社|合同会社/g) || []).length;
  if (corpCount >= 2) {
    score += 8;
    reasons.push("本文に会社名が繰り返し出てくる（署名つきの営業文）");
  }
  if (/TEL[:：]/i.test(body) && /(URL|HP)[:：]/i.test(body)) {
    score += 10;
    reasons.push("本文末尾に定型の署名ブロックがある");
  }
  if (body.replace(/\s/g, "").length < 20) {
    score += 10;
    reasons.push("本文が極端に短い");
  }

  /* ===== 送信のされ方 ===== */
  const el = Number(d.elapsed || 0);
  if (el > 0 && el < 8) {
    score += 25;
    reasons.push(`開いてから送信まで${el}秒（貼り付け送信の疑い）`);
  } else if (el >= 8 && el < 20) {
    score += 10;
    reasons.push(`開いてから送信まで${el}秒と短い`);
  }
  if (Number(d.ipCount || 0) >= 3) {
    score += 20;
    reasons.push(`同じ回線から24時間で${d.ipCount}件目の送信`);
  }

  /* ===== まとめ ===== */
  score = Math.max(0, Math.min(100, Math.round(score)));
  const verdict = score >= 60 ? "sales" : score >= 30 ? "unsure" : "client";
  if (!reasons.length) reasons.push("営業を思わせる特徴は見つかりませんでした");

  return { score, verdict, reasons };
}

export const VERDICT_JA = {
  sales: "営業",
  unsure: "要確認",
  client: "見込み客",
};

/** D1 から学習済みルールを読み出す */
export async function loadRules(db) {
  const empty = { ngDomains: new Set(), okDomains: new Set(), ngWords: [] };
  if (!db) return empty;
  try {
    const { results } = await db.prepare("SELECT type, value FROM rules").all();
    for (const row of results || []) {
      if (row.type === "ng_domain") empty.ngDomains.add(row.value);
      else if (row.type === "ok_domain") empty.okDomains.add(row.value);
      else if (row.type === "ng_word") empty.ngWords.push(row.value);
    }
  } catch (e) {
    /* rules テーブルが未作成でも採点は続ける */
  }
  return empty;
}
