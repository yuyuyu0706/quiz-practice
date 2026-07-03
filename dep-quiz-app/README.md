# Databricks Certified Data Engineer Professional Quiz

Databricks Certified Data Engineer Professional（DEP）対策向けの、HTML/CSS/JavaScriptのみで動作する学習用Webアプリです。

Phase 0 では `dea-quiz-app` をベースに、Professional 版を安全に追加できるよう最小構成で独立させています。

## 起動方法

### 推奨（ローカルサーバ）

`file://` 直接オープンでは `questions.json` の読み込み時に CORS 制約が出る場合があります。
以下のいずれかでローカルサーバ起動を推奨します。

- VS Code: **Live Server** 拡張を使って `dep-quiz-app/index.html` を開く
- Python がある場合:

```bash
cd dep-quiz-app
python -m http.server 8000
```

その後 `http://localhost:8000` にアクセスします。

## Phase 0 の初期構成

- `index.html`: Professional 版のタイトル・見出しを設定
- `styles.css`: 現時点では Associate 版を踏襲
- `app.js`: Professional 版専用の localStorage キーへ分離
- `questions.json`: Professional 版専用の問題データ
- `README.md`: Phase 0 の構成方針を記載

## localStorage 保存内容

- `depQuizProgress`: 問題ごとの学習履歴
  - 正答数・誤答数・最終回答日時・ブックマーク状態
  - Phase 1 以降は問題別メモ `noteText` / `noteUpdatedAt` も保存
  - Phase C 以降は誤答理由タグ `wrongReasonTags` / `wrongReasonUpdatedAt` も保存
    - タグIDは `concept-behavior-gap`, `term-feature-meaning-confusion`, `spec-memory-error`, `code-understanding-gap`, `question-reading-overlook`, `choice-difference-unclear`, `careless-mistake` の7種
- `depQuizSettings`: ホーム画面の設定値
- `depQuizActiveSession`: 進行中セッション

Associate 版 (`dea-quiz-app`) とはキーを分離しているため、同じブラウザでも学習履歴は混ざりません。

## 復習機能

### メモあり問題を復習

解答後にメモを保存した問題だけを再出題できます。

- ホーム画面の「メモあり問題を復習」から開始します。
- 現在選択しているセクションと出題数が反映されます。
- メモが空の問題は対象外です。
- メモはブラウザの localStorage に保存されます。

## questions.json について

Professional 版では `questions.json` を Associate 版と別管理にしています。
今は Phase 0 用のダミー問題のみを入れており、後続フェーズで本番問題を追加していく想定です。

## 将来の共通化メモ

### shared 化しやすい候補

- クイズ描画
- 採点処理
- 中断/再開
- 選択肢ランダム
- explanation / references 表示
- 結果画面表示
- スマホ向け副操作 UI

### 今は分けた方が安全な箇所

- 問題データ (`questions.json`)
- アプリ名・メタ情報
- localStorage キー
- 試験別 README / 学習導線
