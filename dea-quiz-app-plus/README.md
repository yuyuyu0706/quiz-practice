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
- `app.js`: アプリ初期化・状態管理・クイズ進行の統合
- `layout.js`: viewport 判定、スクロール、モバイル用セカンダリアクション制御
- `settings-view.js`: 設定フォームの生成・反映・読取
- `questions.js`: `questions.json` の読み込みと正規化
- `quiz-session.js`: 出題順、選択肢表示、採点、結果集計
- `render.js`: 問題・選択肢・解説・結果などの描画統合
- `markdown-renderer.js`: DEA Plus 内で利用する軽量な Markdown 風描画（inline code、太字、箇条書き、code fence）
- `storage.js`: DEA Plus 専用 localStorage の読み書き
- `notes.js`: 進捗初期値と問題単位メモの保存・削除補助
- `questions.json`: 既存 DEA 版からコピーした問題データ

## 出題モード

ホーム画面では、選択したセクションと出題数に加えて以下の出題モードを選択できます。

- 通常: 選択したセクションから順番に出題
- ランダム: 選択したセクションからランダムに出題
- 間違いのみ: 誤答履歴がある問題だけを出題
- ブックマーク済みのみ: ブックマークした問題だけを出題
- メモありのみ: 自分用メモ `noteText` が保存されている問題だけを出題

## Markdown風記法

DEA Plus では、問題文・選択肢・解説の表示で、以下の軽量な Markdown風記法を利用できます。外部 Markdown ライブラリは使わず、HTML 断片は実行せずにテキストとして扱います。

| 記法                            | 用途                          | 対応箇所             |
| ------------------------------- | ----------------------------- | -------------------- |
| `` `text` ``                    | inline code                   | 問題文・選択肢・解説 |
| `**text**`                      | 太字                          | 問題文・選択肢・解説 |
| `- item`                        | 箇条書き                      | 解説                 |
| code fence                      | コードブロック                | 問題文・選択肢・解説 |
| ` ```sql ` / ` ```python ` など | 言語 class つきコードブロック | 問題文・選択肢・解説 |

### inline code

文中の関数名、設定値、カラム名などはバッククォートで囲みます。

```text
`print`
```

### 太字

強調したい短い語句は `**` で囲みます。

```text
**Delta Lake**
```

### 箇条書き

解説では、行頭に `- ` を置いた行を箇条書きとして表示します。

```text
- Bronze テーブルに取り込む
- Silver テーブルでクレンジングする
```

### code fence

SQL や Python などの複数行コードは code fence で表現します。言語指定がある場合は、`lang-sql` / `language-sql`、`lang-python` / `language-python` のような class として DOM に維持します。シンタックスハイライトは行いません。

````text
```sql
SELECT * FROM samples;
```
````

## localStorage 保存内容

DEA Plus は以下の専用キーを使用します。

- `deaPlusQuizProgress`: 問題ごとの学習履歴
  - 正答数・誤答数・最終回答日時・ブックマーク状態
  - 自分用メモ本文 `noteText`
  - `notesOnly` モードでは、空白を除いた `noteText` が空でない問題だけを出題対象にする
  - メモ最終保存日時 `noteUpdatedAt`
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

## Phase 0 で意図的に実装しなかったもの

以下は Phase 0 時点で対象外としていたものです。Phase 1 で一部対応済みの項目もあり、残件は後続フェーズで扱います。

- 新機能追加
- メモ一覧・メモ検索などのメモ管理画面
- `whyWrong` 対応
- 5肢選択2解答問題への対応
- 問題スキーマの大幅拡張
- CI / GitHub Actions の追加（Phase 0 では対象外。Phase 1.5 で DEA Plus 固有の品質補強として検討）
- `shared` ディレクトリ作成

## Phase 1 の開発方針

Phase 1 では、`dep-quiz-app` で先行して整備された学習体験・描画・操作性を参考にしながら、`dea-quiz-app-plus` 側の機能差を段階的に埋めてきました。

Phase 1 以降は localStorage、UI、描画、復習導線、テスト観点が絡むため、複数機能を一括で実装せず、原則として **1 PR 1機能** で進めます。README 更新のみの方針整理 PR も許容し、各 PR では変更範囲・確認観点・対象外スコープを明確にします。

既存の `dea-quiz-app` と `dep-quiz-app` は原則変更せず、拡張は `dea-quiz-app-plus` 側に限定します。

### Phase 1 の完了状況

Phase 1 では、DEP 版で先行して整備されていた学習体験・描画・操作性を参考に、DEA Plus 側へ以下を反映しました。

- `app.js` の追加分割・責務整理
- inline code / code fence の描画責務整理
- 問題単位のメモ機能
- メモあり復習モード
- スマホ操作性改善

これにより、Phase 1 の機能実装は一通り完了とします。次は Phase 2 の問題スキーマ拡張へ進む前に、Phase 1.5 として CI / E2E / メモ機能堅牢化などの品質補強を行います。

### スキーマ非依存機能を先に進める

Phase 1 では、既存 `questions.json` の構造を大きく変えずに進められる機能を優先します。

具体的には、メモ機能、メモあり復習、Markdown 風の inline code / code fence 描画確認・強化、スマホ操作性改善などを対象とし、Phase 1 で一通り対応済みです。inline code / code fence は既存文字列の描画強化として扱える範囲にとどめ、構造化フィールドの追加が必要な場合は Phase 2 で扱います。

一方で、`whyWrong` や 5肢選択2解答のように問題データ構造の拡張を伴う機能は、Phase 1 では実装せず、Phase 2 の問題スキーマ拡張後に実装します。

### Phase 1 以降の推奨実装順序

| 優先 | 区分      | 機能                                    | 方針                                                                                       |
| ---: | --------- | --------------------------------------- | ------------------------------------------------------------------------------------------ |
|    1 | Phase 1A  | app.js 追加分割・責務整理               | `layout.js` / `settings-view.js` へ UI 補助・設定 UI 責務を分割済み                        |
|    2 | Phase 1A  | inline code / code fence 描画確認・強化 | 既存文字列の Markdown 風描画として扱い、スキーマ変更は行わない                             |
|    3 | Phase 1A  | メモ機能                                | 問題画面で回答済み問題への問題単位メモ保存・編集・削除を追加済み                           |
|    4 | Phase 1A  | メモあり復習                            | 自分用メモが保存されている問題だけを出題する `notesOnly` モードを追加済み                  |
|    5 | Phase 1B  | スマホ操作性改善                        | スマホ幅での主要操作、補助操作、メモ欄、code block 表示を調整済み                          |
|    6 | Phase 1.5 | CI / E2E / メモ機能堅牢化               | Phase 1 で追加した機能を壊さないため、DEA Plus 固有の E2E・CI・localStorage 耐性を強化する |
|    7 | Phase 2   | 問題スキーマ拡張設計                    | `whyWrong`、複数正答、問題タイプなどの拡張方針を定義する                                   |
|    8 | Phase 2後 | `whyWrong` 対応                         | スキーマ定義後に選択肢別の誤答理由表示を実装する                                           |
|    9 | Phase 2後 | 5肢選択2解答対応                        | 採点・UI・データ構造の拡張として実装する                                                   |

### Phase 1.5 品質補強方針

Phase 1 の機能実装後、Phase 2 の問題スキーマ拡張へ進む前に、DEA Plus 固有の品質補強を行います。Phase 1.5 では、実装済み機能を壊さないための確認導線と localStorage 耐性を優先し、Phase 2 のスキーマ変更にはまだ着手しません。

優先して扱う候補は以下です。

- DEA Plus の基本起動・回答・結果表示の E2E 強化
- メモ保存・編集・削除の E2E 強化
- `notesOnly` モードの E2E 強化
- Mobile Chrome 相当での主要操作・補助操作・メモ欄操作の確認
- `deaPlusQuizProgress` の progress entry 正規化・壊れた localStorage への耐性強化
- SWA artifact に `dea-quiz-app-plus` が含まれることの軽量検証

これらは別 PR で段階的に進めます。今回の README 棚卸し PR では、CI / GitHub Actions、Playwright E2E、テストスクリプト、アプリ本体の実装変更は行いません。

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

Phase 1 の機能実装は一通り完了しました。

次は Phase 1.5 として、CI / E2E / メモ機能堅牢化を進めます。その後、Phase 2 で `whyWrong`、複数正答、問題タイプなどの問題スキーマ拡張を設計します。

`whyWrong` 対応と 5肢選択2解答対応は、Phase 2 のスキーマ定義後に扱います。既存の `dea-quiz-app` は MVP / legacy stable 版として維持し、新機能は引き続き `dea-quiz-app-plus` で進めます。
