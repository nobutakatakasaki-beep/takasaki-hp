# 髙﨑会計事務所 ホームページ

無料で公開・運用できる構成です。**ターミナル（黒い画面）は一切使いません。**
すべて GitHub と Cloudflare の画面操作だけで完了します。

| | |
|---|---|
| 公開先 | Cloudflare Pages（無料・広告なし・商用OK） |
| ソース置き場 | GitHub（無料） |
| 問合せの保存先 | Cloudflare D1（無料枠あり） |
| 迷惑送信対策 | Cloudflare Turnstile（無料・任意） |
| 営業判定 | 自前のスコアリング（`functions/_lib/score.js`） |

---

> **検索で見つけてもらうための手順は [SEO.md](SEO.md) にまとめてあります。**
> 公開したら、そちらの「公開したらすぐやること」を上から順に進めてください。

---

## 1. GitHub にアップロードする

1. [github.com](https://github.com/) で無料アカウントを作り、ログインします。
2. 右上の **＋** → **New repository**。
3. **Repository name** に `takasaki-hp` と入力 → **Create repository**。
4. 次の画面の **uploading an existing file** という青いリンクをクリック。
5. **この `takasaki-hp` フォルダの中身をすべて**（`index.html`、`assets` フォルダ、`functions` フォルダなど）
   ドラッグ＆ドロップします。
   > フォルダごと放り込んで構いません。`functions` フォルダは必ず含めてください。
   > これが無いとお問合せフォームが動きません。
6. 下の **Commit changes** を押せば保存完了です。

---

## 2. Cloudflare Pages で公開する

1. [cloudflare.com](https://www.cloudflare.com/ja-jp/) で無料アカウントを作り、ログイン。
2. 左メニューの **Workers & Pages** → **作成（Create）**。
3. **Pages** タブ → **GitHubに接続（Connect to Git）**。
4. アクセスを許可し、先ほどの `takasaki-hp` を選択。
5. ビルド設定は**すべて空のまま**で大丈夫です（ビルドコマンド不要）。
6. **保存してデプロイ（Save and Deploy）**。

30秒〜1分で `takasaki-hp.pages.dev` のようなURLが発行され、サイトが公開されます。

> この時点でサイトは表示されますが、**お問合せフォームはまだ動きません。**
> 次の3の手順まで進めてください。

---

## 3. 問合せの保存先（D1データベース）を用意する

### 3-1. データベースを作る
1. Cloudflare の左メニュー **ストレージとデータベース** → **D1 SQL データベース**。
2. **データベースを作成** → 名前に `takasaki-inquiries` と入力 → 作成。

### 3-2. 表を作る
1. 作ったデータベースを開き、**コンソール（Console）** タブを選びます。
2. このフォルダにある **`schema.sql`** をメモ帳などで開き、**中身をすべてコピー**。
3. コンソールの入力欄に貼り付けて **実行（Execute）**。
4. 「Tables」に `inquiries` と `rules` が出てくれば成功です。

### 3-3. サイトと結びつける
1. **Workers & Pages** → `takasaki-hp` → **設定（Settings）** → **バインディング（Bindings）**。
2. **バインディングを追加** → **D1 データベース** を選択。
3. **変数名（Variable name）** に **`DB`** と入力（※大文字の DB。ここは絶対に変えないでください）
4. **D1 データベース** で `takasaki-inquiries` を選択 → 保存。

### 3-4. 管理画面の合言葉を決める
1. 同じ **設定** の **変数とシークレット（Variables and Secrets）**。
2. **追加** → 種類は **シークレット（Secret）** を選択。
3. 変数名 **`ADMIN_PASSWORD`**、値には**ご自分で決めた合言葉**を入力して保存。
   > 長めの文字列にしてください（例：`kanda-1973-takasaki-x7q2`）。
   > この合言葉を知っている人だけが管理画面を開けます。

### 3-5. 反映させる
設定を変えたら、**デプロイ（Deployments）** タブ → 最新のデプロイの **…** → **再デプロイ（Retry deployment）** を押してください。
これで設定が反映されます。

---

## 4. 管理画面の使い方

`https://（あなたのURL）/admin.html` を開き、3-4で決めた合言葉を入力します。

- **問合せ一覧** … 新しい順に表示。行をクリックすると本文と判定理由が開きます。
  - 「見込み客に確定」「営業に確定」で判定を手で直せます。
  - **ドメインも覚える** にチェックが入っていると、同じ会社の次回の連絡を自動で仕分けます。
  - 「対応済みにする」「メモ」「CSV書き出し」も使えます。
- **判定を試す** … フォーム以外で届いたメールの本文を貼り付けて、営業かどうかを試せます（保存されません）。
- **学習ルール** … 覚えたドメインの確認・削除、手動での追加ができます。
- **使い方** … 判定のしくみの説明です。

### 判定の基準
| スコア | 判定 |
|---|---|
| 0〜29点 | 見込み客 |
| 30〜59点 | 要確認 |
| 60〜100点 | 営業 |

加点・減点のことばは `functions/_lib/score.js` の上のほうにまとめてあります。
GitHubの画面で開いて鉛筆マークから編集すれば、自由に足せます（保存すると1分ほどで反映されます）。

---

## 5.（任意）迷惑送信を止める — Turnstile

ロボットによる自動送信をほぼゼロにできます。無料です。

1. Cloudflare 左メニュー **Turnstile** → **サイトを追加**。
2. ドメインに `takasaki-hp.pages.dev`（実際のURL）を入力して作成。
3. **サイトキー** と **シークレットキー** が表示されます。
4. **Workers & Pages** → `takasaki-hp` → **設定** → **変数とシークレット** に2つ追加：
   - `TURNSTILE_SITE_KEY`（種類：テキスト）… サイトキー
   - `TURNSTILE_SECRET`（種類：シークレット）… シークレットキー
5. 再デプロイすれば、フォームに認証が表示されます。

設定しなければ何も表示されず、フォームはそのまま動きます。

---

## 6.（任意）問合せをメールで受け取る

1. [resend.com](https://resend.com/) で無料アカウントを作成（月3,000通まで無料）。
2. **API Keys** で キーを発行してコピー。
3. Cloudflare の **変数とシークレット** に追加：
   - `RESEND_API_KEY`（シークレット）… 発行したキー
   - `NOTIFY_TO`（テキスト）… 受信したいメールアドレス（カンマ区切りで複数可）
   - `NOTIFY_FROM`（テキスト・任意）… 差出人。独自ドメインを認証するまでは省略可
   - `SITE_URL`（テキスト・任意）… 例 `https://takasaki-hp.pages.dev`
4. 再デプロイ。

届くメールの件名には判定結果が入ります。
例：`【営業の可能性】株式会社◯◯ 様より（その他のお問合せ）`

---

## 7.（任意）独自ドメインをつなぐ

**Workers & Pages** → `takasaki-hp` → **カスタムドメイン** から追加できます。
費用はドメイン代のみ。Cloudflare側の追加料金はかかりません。

---

## 8. あとから文章や写真を直すには

1. GitHub の `takasaki-hp` を開く。
2. 直したいファイル（例 `index.html`）をクリック → **鉛筆マーク**。
3. 文字を書き換えて、下の **Commit changes**。
4. **1分ほどで実際のサイトが自動で書き換わります。**

写真を差し替えるときは `assets/img/` フォルダを開き、
**Add file → Upload files** で同じファイル名の画像を上げ直してください。

### 書き換えておくとよいところ
- `contact.html` … 電話受付時間（「▼受付時間」というコメントの行）
- `news.html` … お知らせの追加
- `recruit.html` … 募集を再開するとき（「現在、募集を停止しております」の行を削除）
- `sitemap.xml` / `robots.txt` / `index.html` の `canonical` … 公開URLに書き換え

---

## ファイル構成

```
takasaki-hp/
├ index.html            トップページ
├ office.html           事務所紹介・所長挨拶
├ philosophy.html       経営理念
├ service.html          業務案内
├ news.html             お知らせ
├ access.html           交通案内
├ recruit.html          職員募集
├ contact.html          お問合せフォーム
├ thanks.html           送信完了
├ privacy.html          プライバシーポリシー
├ admin.html            ★管理画面（営業判定ツール）
├ 404.html
├ schema.sql            ★D1にコピペする表の定義
├ _headers              セキュリティ設定
├ robots.txt / sitemap.xml
├ assets/
│  ├ css/style.css
│  ├ js/main.js, contact.js
│  └ img/               ロゴ・写真・アイコン
└ functions/            ★Cloudflareが自動で動かす処理
   ├ _lib/score.js      ★営業判定エンジン
   └ api/
      ├ contact.js      フォームの受付
      ├ config.js
      └ admin/          管理画面用API
```

★印のファイルは、無いと機能が動きません。アップロード漏れにご注意ください。
