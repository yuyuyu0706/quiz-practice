# Databricks Certified Data Engineer Associate Quiz Plus

Databricks Certified Data Engineer Associate（DEA）対策向けの、HTML/CSS/JavaScriptのみで動作する学習用Webアプリです。

`dea-quiz-app-plus` は、既存の `dea-quiz-app`（MVP / legacy stable）を拡張せずに、今後の DEA 向け追加開発を安全に進めるための開発入口です。Phase 0 では、`dep-quiz-app` のモジュール分割構成を参考に、DEA 用問題データと DEA Plus 専用 localStorage キーで独立させています。

## 起動方法

### 推奨（ローカルサーバ）

`file://` 直接オープンでは `questions.json` の読み込み時に CORS 制約が出る場合があります。
以下のいずれかでローカルサーバ起動を推奨します。

- VS Code: **Live Server** 拡張を使って `dea-quiz-app-plus/index.html` を開く
- Python がある場合:

```bash
cd dea-quiz-app-plus
python -m http.server 8000
```

その後 `http://localhost:8000` にアクセスします。

## Phase 0 の初期構成

- `index.html`: DEA Quiz Plus のタイトル・見出し・基本画面
- `styles.css`: DEA Plus 用スタイル
- `app.js`: 画面イベントとクイズ進行の統合
- `questions.js`: `questions.json` の読み込みと正規化
- `quiz-session.js`: 出題順、選択肢表示、採点、結果集計
- `render.js`: 問題・解説・結果などの描画
- `storage.js`: DEA Plus 専用 localStorage の読み書き
- `notes.js`: Phase 0 ではメモ機能を実装せず、進捗初期値のみを提供
- `questions.json`: 既存 DEA 版からコピーした問題データ

## localStorage 保存内容

DEA Plus は以下の専用キーを使用します。

- `deaPlusQuizProgress`: 問題ごとの学習履歴
  - 正答数・誤答数・最終回答日時・ブックマーク状態
- `deaPlusQuizSettings`: ホーム画面の設定値
- `deaPlusQuizActiveSession`: 進行中セッション

既存 DEA 版 (`dea-quiz-app`) の `deaQuiz*` キー、DEP 版 (`dep-quiz-app`) の `depQuiz*` キーとは分離しているため、同じブラウザでも学習履歴や設定は混ざりません。

## localStorage リセット方法

ブラウザ DevTools の Console で以下を実行します。

```js
localStorage.removeItem('deaPlusQuizProgress');
localStorage.removeItem('deaPlusQuizSettings');
localStorage.removeItem('deaPlusQuizActiveSession');
```

## Phase 0 で意図的に実装しないもの

- 新機能追加
- メモ機能
- メモあり問題の復習
- `whyWrong` 対応
- 5肢選択2解答問題への対応
- 問題スキーマの大幅拡張
- CI / GitHub Actions の追加
- `shared` ディレクトリ作成

## 今後の拡張メモ

Phase 1 以降で、DEA Plus 側に限定して学習補助機能や問題スキーマ拡張を検討します。既存の `dea-quiz-app` は MVP / legacy stable 版として維持し、新機能はこのフォルダで進めます。
