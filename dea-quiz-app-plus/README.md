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

Phase 1 の機能実装後、Phase 2 の問題スキーマ拡張へ進む前に、DEA Plus 固有の品質補強を行いました。Phase 1.5 では、実装済み機能を壊さないための確認導線と localStorage 耐性を優先し、Phase 2 のスキーマ変更にはまだ着手していません。

### Phase 1.5 の完了状況

Phase 1.5 では、Phase 2 の問題スキーマ拡張へ進む前の品質補強として、以下を完了しました。

- DEA Plus メモ / E2E カバレッジ追加
- メモロジック軽量テスト追加
- `deaPlusQuizProgress` の正規化と localStorage 堅牢化
- SWA artifact 軽量検証
- Markdown 描画 E2E 追加
- Markdown E2E fixture の陳腐化防止検証

これにより、Phase 2 のスキーマ拡張に入る前の主要な品質ガードは整備済みです。

## Phase 2：問題スキーマ拡張方針

Phase 2 では、既存の単一正答 4 肢問題を壊さずに、`whyWrong`、複数正答、5肢選択、将来的な問題タイプ拡張へ進むためのスキーマ方針を整理します。Phase 2-0 である今回の README 更新は設計地図を作ることが目的であり、アプリ実装、validator、問題データは変更しません。

### Phase 2 の目的

- 選択肢ごとの誤答理由 `whyWrong` を段階導入できるようにする
- 単一正答の既存 `answer` 形式を維持しつつ、複数正答用の `answers` を定義する
- 5肢選択を `choices` の `E` 追加で表現できるようにする
- 将来的な問題タイプ拡張に備えつつ、初期 Phase 2 では不要な必須フィールドを増やさない
- validator、UI、採点、解説表示、E2E の後続実装順序を明確にする

### 現行スキーマ

現行の `questions.json` は、概ね以下の単一正答スキーマを前提にしています。

```json
{
  "id": "DEA-PLUS-Q001",
  "section": "1",
  "sectionTitle": "Databricks Lakehouse Platform",
  "question": "問題文",
  "choices": {
    "A": "選択肢A",
    "B": "選択肢B",
    "C": "選択肢C",
    "D": "選択肢D"
  },
  "answer": "A",
  "explanation": "解説",
  "references": []
}
```

| 項目       | 現行方針                        |
| ---------- | ------------------------------- |
| `choices`  | A〜D 中心                       |
| `answer`   | 単一文字列                      |
| 採点       | 1つ選択して `answer` と一致比較 |
| 解説       | 全体解説のみ                    |
| `whyWrong` | 未対応                          |
| 複数正答   | 未対応                          |
| 5肢選択    | 未対応                          |

### 問題ID採番ルール（Phase 2-3-B-2）

`dea-quiz-app-plus/questions.json` の問題IDは、DEA Plus専用であることと文字列ソート時の見通しを明確にするため、`DEA-PLUS-Q` + 3桁連番に統一します。

- 形式: `DEA-PLUS-Q001`, `DEA-PLUS-Q002`, ...
- 旧形式からの対応: `Q1` -> `DEA-PLUS-Q001`, `Q10` -> `DEA-PLUS-Q010`, `Q100` -> `DEA-PLUS-Q100`
- 既存問題の順序は維持し、旧 `Q<number>` の数値部分をそのまま3桁ゼロ埋めへ変換します。
- 新規問題を追加する場合は、既存の最大IDの次の連番を採番します。
- `deaPlusQuizProgress` は読み込み時に旧 `Q<number>` キーを新IDへ正規化し、メモ・ブックマーク・進捗を保持します。
- `deaPlusQuizActiveSession` は選択肢シャッフルや回答状態の不整合を避けるため、旧IDまたは存在しないIDを含む場合は破棄して再開始を促します。

### 拡張対象

Phase 2 の拡張対象は、`dea-quiz-app-plus` の問題スキーマ、validator、UI、採点、解説表示に限定します。既存の MVP / legacy stable である `dea-quiz-app`、および `dep-quiz-app` / `dep-quiz-app-plus` への横展開や共通部品化は行いません。

### `whyWrong` のスキーマ方針

`whyWrong` は、選択肢ごとの誤答理由を持つ任意フィールドとして定義します。

```json
{
  "whyWrong": {
    "B": "Bが誤りである理由",
    "C": "Cが誤りである理由",
    "D": "Dが誤りである理由"
  }
}
```

| 項目           | 方針                                                               |
| -------------- | ------------------------------------------------------------------ |
| 型             | object                                                             |
| key            | 元データの `choices` key                                           |
| value          | 非空文字列                                                         |
| 正答選択肢     | 含めない                                                           |
| 必須性         | 任意                                                               |
| 表示タイミング | 回答後                                                             |
| 表示方針       | 正答・誤答に関係なく、存在する `whyWrong` を画面上の選択肢順に表示 |
| Markdown       | inline code / strong / code fence / 箇条書きを必要に応じて利用可能 |

初期段階では `whyWrong` を必須化しません。既存問題を壊さず、問題データ更新負荷を抑え、`whyWrong` がある問題から段階導入できるようにするためです。

Phase 2-3-A では、実問題データへ `whyWrong` を追加する前に、記述ルール・対象範囲・レビュー観点を [`docs/dea-plus/whywrong-authoring-guide.md`](../docs/dea-plus/whywrong-authoring-guide.md) に整理しました。後続の `questions.json` 編集 PR では、このガイドに沿って正答 key を含めず、`explanation` との役割分担を保ち、選択肢シャッフル後も対応が崩れないよう元データの `choices` key に紐づけます。

### Phase 2-3-A: `whyWrong` 追加方針

Phase 2-3-A はドキュメント整理のみを対象とし、`questions.json`、アプリ本体、validator、E2E、workflow は変更しません。詳細な記述ルールは [`whyWrong` 記述ガイド](../docs/dea-plus/whywrong-authoring-guide.md) を参照します。

後続 PR で `questions.json` に `whyWrong` を追加する際の要点は以下です。

- `whyWrong` は誤答選択肢ごとの「なぜその選択肢が誤りなのか」に絞る
- 正答 key には `whyWrong` を書かず、正答理由は `explanation` に書く
- `explanation` は正答理由・問題全体の補足、`whyWrong` は各誤答選択肢固有の理由として分担する
- 画面上の表示ラベルではなく、シャッフル前の元データ `choices` key に紐づける
- 1 PR あたり 5〜10問程度、または 1セクション単位を目安に小さく分ける
- レビューでは key の存在、正答 key 混入、空文字、説明の固有性、`explanation` との矛盾・重複、Markdown 風表現、既存問題の不要変更を確認する

後続の問題データ編集 PR では、最低限以下を確認します。

```bash
npm run validate:dea-plus-questions
npm run validate:dea-questions
npm run validate:dep-questions
npm run test:question-validator
npm run format:check
```

### 複数正答のスキーマ方針

単一正答は既存の `answer` を維持します。

```json
{
  "answer": "A"
}
```

複数正答は新たに `answers` を使います。

```json
{
  "answers": ["A", "C"]
}
```

| 問題形式                         | スキーマ                     |
| -------------------------------- | ---------------------------- |
| 単一正答                         | `answer: "A"`                |
| 複数正答                         | `answers: ["A", "C"]`        |
| `answer` と `answers` の同時指定 | 原則禁止                     |
| 同時指定時の扱い                 | validator でエラーにする方針 |

複数正答の採点は以下を前提にします。

| 観点        | 方針                          |
| ----------- | ----------------------------- |
| 順序        | 無視                          |
| 正誤判定    | 完全一致                      |
| 部分点      | なし                          |
| 選択数      | `answers.length` と一致が必要 |
| UI          | checkbox                      |
| 単一正答 UI | radio                         |

### 5肢選択のスキーマ方針

5肢選択は、`choices` に `E` を許容することで表現します。

単一正答 5肢の例です。

```json
{
  "choices": {
    "A": "...",
    "B": "...",
    "C": "...",
    "D": "...",
    "E": "..."
  },
  "answer": "C"
}
```

複数正答 5肢の例です。

```json
{
  "choices": {
    "A": "...",
    "B": "...",
    "C": "...",
    "D": "...",
    "E": "..."
  },
  "answers": ["B", "E"]
}
```

| 項目          | 方針                                                                    |
| ------------- | ----------------------------------------------------------------------- |
| `choices` key | A〜E を許容                                                             |
| 最小選択肢数  | 2以上                                                                   |
| 最大選択肢数  | 当面5                                                                   |
| 表示順        | A/B/C/D/E 順で安定表示                                                  |
| validator     | `answer` / `answers` が存在する choice key のみを参照していることを検査 |

### 問題タイプの扱い

初期 Phase 2 では `type` は必須化しません。単一正答は `answer`、複数正答は `answers` の有無から判定します。

必要になった場合のみ、将来的に `type: "single"` / `type: "multiple"` の追加を検討します。これにより、既存問題を変更せずに済み、validator と UI の初期実装を簡潔に保ち、不要なスキーマ更新を避けられます。

### 後方互換方針

既存の `answer: "A"` 形式は維持します。既存問題は変更なしで動作することを前提とし、Phase 2 の拡張は `dea-quiz-app-plus` のみに適用します。MVP / legacy stable の `dea-quiz-app` には反映しません。

- `dep-quiz-app` / `dep-quiz-app-plus` との共通部品化は行わない
- 共通的な考え方は参考にしてよいが、実装は各アプリ内に閉じる
- localStorage の progress 構造は原則変更しない
- メモ、ブックマーク、正誤回数の保存方式には影響を与えない

### validator拡張方針

Phase 2-0 では validator 実装は行いません。後続 PR では以下の検査を追加する方針です。

| 項目                    | 検証内容                                           |
| ----------------------- | -------------------------------------------------- |
| `answer`                | string、choices key に存在                         |
| `answers`               | 配列、空でない、重複なし、choices key にすべて存在 |
| `answer` と `answers`   | 同時指定禁止                                       |
| `choices`               | A〜E まで許容、最低2件                             |
| `whyWrong`              | object、key が choices key、value が string        |
| 既存問題                | 現行 `answer` 形式は通す                           |
| 未実装/設計外フィールド | Phase 2 方針に応じて警告またはエラー               |

### UI / 採点 / 解説表示への影響

| 領域      | 影響                                                |
| --------- | --------------------------------------------------- |
| render    | `answers` があれば checkbox、`answer` なら radio    |
| 採点      | single / multiple で判定関数を分ける                |
| progress  | 正誤回数の保存構造は原則変更しない                  |
| notes     | 影響なし                                            |
| bookmarks | 影響なし                                            |
| whyWrong  | 回答後の解説領域に追加表示                          |
| E2E       | single 既存動作、multiple 採点、whyWrong 表示を追加 |

### Phase 2 の推奨実装順序

```text
Phase 2-0: 問題スキーマ拡張設計 README更新
Phase 2-1: validator拡張
Phase 2-2: whyWrong 表示対応
Phase 2-3-A: whyWrong 追加方針・対象範囲整理
Phase 2-3-B以降: questions.json への whyWrong 追加（小ロット）
Phase 2-4: 複数正答 / 5肢選択のvalidator・採点・UI対応
Phase 2-5: 複数正答 / 5肢選択の問題データ追加
```

validator を先に拡張し、データ更新は validator の後に行います。`whyWrong` は複数正答より先に進めてよく、複数正答 / 5肢選択は採点・UI 影響が大きいため別 PR に分けます。

### Phase 2-0 では実装しないもの

| 対象外                | 理由             |
| --------------------- | ---------------- |
| `questions.json` 更新 | 設計後に実施     |
| validator変更         | Phase 2-1 で実施 |
| app UI変更            | validator 後     |
| `whyWrong` 表示実装   | Phase 2-2 で実施 |
| 複数正答採点          | Phase 2-4 で実施 |
| 5肢選択UI             | Phase 2-4 で実施 |
| E2E追加               | 実装 PR 側で追加 |
| DEP/legacy DEA変更    | 対象外           |

今回の Phase 2-0 PR では、アプリ実装、validator 変更、`questions.json` 更新、Playwright E2E 追加、Node 軽量テスト追加、Markdown 描画仕様変更、localStorage 変更は行いません。

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

Phase 1 の機能実装と Phase 1.5 の品質補強は一通り完了しました。

Phase 2-1 の validator 拡張と Phase 2-2 の `whyWrong` 表示対応は完了済みです。次は Phase 2-3-A の記述ガイドに沿って、`questions.json` への `whyWrong` 追加を小ロットで進め、その後に複数正答 / 5肢選択の採点・UI 対応へ分割して進めます。

`whyWrong` 対応と 5肢選択2解答対応は、Phase 2 のスキーマ方針に沿って扱います。既存の `dea-quiz-app` は MVP / legacy stable 版として維持し、新機能は引き続き `dea-quiz-app-plus` で進めます。
