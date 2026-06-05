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

## Phase 1 の開発方針

Phase 1 では、`dep-quiz-app` で先行して整備された学習体験・描画・操作性を参考にしながら、`dea-quiz-app-plus` 側の機能差を段階的に埋めていきます。

ただし、Phase 1 以降は localStorage、UI、描画、復習導線、テスト観点が絡むため、複数機能を一括で実装せず、原則として **1 PR 1機能** で進めます。README 更新のみの方針整理 PR も許容し、各 PR では変更範囲・確認観点・対象外スコープを明確にします。

既存の `dea-quiz-app` と `dep-quiz-app` は原則変更せず、拡張は `dea-quiz-app-plus` 側に限定します。

### スキーマ非依存機能を先に進める

Phase 1 では、既存 `questions.json` の構造を大きく変えずに進められる機能を優先します。

具体的には、メモ機能、メモあり復習、Markdown 風の inline code / code fence 描画確認・強化、スマホ操作性改善などを対象とします。inline code / code fence は既存文字列の描画強化として扱える範囲にとどめ、構造化フィールドの追加が必要な場合は Phase 2 で扱います。

一方で、`whyWrong` や 5肢選択2解答のように問題データ構造の拡張を伴う機能は、Phase 1 では実装せず、Phase 2 の問題スキーマ拡張後に実装します。

### Phase 1 以降の推奨実装順序

| 優先 | 区分 | 機能 | 方針 |
| -: | --- | --- | --- |
| 1 | Phase 1A | app.js 追加分割・責務整理 | Phase 0 で分割済みの構成を確認し、必要な追加整理のみ行う |
| 2 | Phase 1A | inline code / code fence 描画確認・強化 | 既存文字列の Markdown 風描画として扱い、スキーマ変更は行わない |
| 3 | Phase 1A | メモ機能 | localStorage を拡張し、問題単位でメモを保存・編集できるようにする |
| 4 | Phase 1A | メモあり復習 | メモがある問題だけを復習できるモードを追加する |
| 5 | Phase 1B | スマホ操作性改善 | メモ UI 追加後の実利用を踏まえて操作性を改善する |
| 6 | Phase 2 | 問題スキーマ拡張設計 | `whyWrong`、複数正答、問題タイプなどの拡張方針を定義する |
| 7 | Phase 2後 | `whyWrong` 対応 | スキーマ定義後に選択肢別の誤答理由表示を実装する |
| 8 | Phase 2後 | 5肢選択2解答対応 | 採点・UI・データ構造の拡張として実装する |

### PR 運用ルール

Phase 1 以降は、原則として **1 PR 1機能** で進めます。

各 PR では以下を明確にします。

- 変更対象
- 対象外スコープ
- localStorage への影響
- 問題スキーマへの影響
- PC / スマホでの確認観点
- 次 PR へ回す残課題

localStorage 変更がある場合は、キー名・互換性・リセット方法を README に追記します。UI 変更がある場合は PC / スマホの両方で確認し、問題データ変更がある場合は正答・解説の意味が変わっていないことを確認します。

## 今後の拡張メモ

Phase 1 以降で、DEA Plus 側に限定して学習補助機能や問題スキーマ拡張を検討します。既存の `dea-quiz-app` は MVP / legacy stable 版として維持し、新機能はこのフォルダで進めます。
