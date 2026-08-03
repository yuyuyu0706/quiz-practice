# questions.json スキーマ説明（DEP クイズアプリ）

このドキュメントは、`dep-quiz-app/questions.json` のデータ仕様を説明するための仕様書です。  
Databricks Certified Data Engineer Professional（DEP）向けクイズアプリで扱う問題データの構造、各項目の意味、必須/任意、記述例を整理しています。

---

## 1. 目的

`questions.json` は、クイズアプリが問題・選択肢・正解・解説・参考リンクなどを読み込むためのデータファイルです。

DEP 版では、DEA 版よりも以下を強化できるように、拡張可能なスキーマを採用しています。

- 領域別の管理（`domain`）
- タグ分類（`tags`）
- 難易度管理（`difficulty`）
- 誤答理由の補足（`whyWrong`）
- 問題管理用メモ（`notes`）
- 同じ論点の出題バリエーションの関係付け（`variantGroup`）
- 解説後の追加確認候補の関係付け（`followUp`）

---

## 2. ファイル全体の構造

`questions.json` は、**問題オブジェクトの配列**です。

```json
[
  {
    "id": "Q201",
    "section": "3",
    "sectionTitle": "データ処理 & 変換",
    "domain": "Streaming",
    "tags": ["Auto Loader", "schema evolution"],
    "difficulty": "hard",
    "sourceType": "original",
    "question": "Auto Loader でスキーマ進化を扱う際に最も適切なのはどれ？",
    "choices": {
      "A": "schemaLocation を使わない",
      "B": "schemaLocation を永続化し、進化モードを適切に設定する",
      "C": "checkpointLocation だけで十分",
      "D": "CSV に変換して扱う"
    },
    "answer": "B",
    "explanation": "schemaLocation は推論済みスキーマを保持し、継続的な取り込みやスキーマ進化に対応するために重要です。",
    "whyWrong": {
      "A": "推論結果の継続利用ができず、継続運用に不向きです。",
      "C": "checkpointLocation は進捗管理用であり、スキーマ管理の代替にはなりません。",
      "D": "フォーマット変換は問題の本質的な解決ではありません。"
    },
    "references": [
      {
        "title": "Auto Loader schema inference and evolution",
        "url": "https://docs.databricks.com/..."
      }
    ],
    "notes": "Streaming / Auto Loader の比較問題として使える"
  }
]
```

---

## 3. 項目一覧

| 項目名         | 型            |         必須 | 説明                                               |
| -------------- | ------------- | -----------: | -------------------------------------------------- |
| `id`           | string        |         必須 | 問題ID。リポジトリ内で一意にする                   |
| `section`      | string        |         必須 | 試験ガイド上の大分類番号。文字列で保持             |
| `sectionTitle` | string        |         必須 | セクションの表示名                                 |
| `question`     | string        |         必須 | 問題文                                             |
| `choices`      | object        |         必須 | 選択肢。通常は `A/B/C/D` の4件                     |
| `answer`       | string        |         必須 | 正解の選択肢キー。`A` / `B` / `C` / `D` のいずれか |
| `explanation`  | string        |         必須 | 正解理由の解説。Markdown風の長文も可               |
| `references`   | array         |         任意 | 参考リンク一覧                                     |
| `domain`       | string        | 任意（推奨） | 問題の大分類。弱点分析や出題整理に使う             |
| `tags`         | array[string] | 任意（推奨） | 詳細タグ。検索や復習分類に使う                     |
| `difficulty`   | string        | 任意（推奨） | 難易度。`easy` / `medium` / `hard` を想定          |
| `sourceType`   | string        |         任意 | 問題の出自。`original` など                        |
| `whyWrong`     | object        |         任意 | 誤答選択肢ごとの補足説明                           |
| `notes`        | string        |         任意 | 作問・管理用メモ。アプリ表示対象外でも可           |
| `variantGroup` | string        |         任意 | 同じ論点・選択肢本文集合に属する関係ID             |
| `followUp`     | object        |         任意 | 解説後の追加確認候補となる問題への有向参照         |

---

## 4. 各項目の説明

### 4.1 `id`

- 形式例：`Q201`, `Q202`
- 重複禁止
- 並び順・内部識別・ブックマーク保存などに使う

### 4.2 `section`

- 試験ガイド上の大分類番号を文字列で保持
- 例：`"1"`, `"2"`, `"3"`

> 文字列にしているのは、既存DEA版との整合性を取りやすくするためです。

### 4.3 `sectionTitle`

- 画面上に表示するセクション名
- DEP 版では、`section` と対になる以下の定義済み値のみを使用する
  - `section: "1"` → `Developing Code for Data Processing using Python and SQL`
  - `section: "2"` → `Data Ingestion & Acquisition`
  - `section: "3"` → `Data Transformation, Cleansing, and Quality`
  - `section: "4"` → `Data Sharing and Federation`
  - `section: "5"` → `Monitoring and Alerting`
  - `section: "6"` → `Cost & Performance Optimisation`
  - `section: "7"` → `Ensuring Data Security and Compliance`
  - `section: "8"` → `Data Governance`
  - `section: "9"` → `Debugging and Deploying`
  - `section: "10"` → `Data Modelling`

### 4.4 `question`

- 問題文そのもの
- DEP版では長文シナリオ問題も想定
- 改行を含めてもよい

### 4.5 `choices`

- 4択問題を前提に、通常は `A/B/C/D` を持つオブジェクト
- 現行アプリは4択前提のため、`A/B/C/D` を維持する

### 4.6 `answer`

- 正解選択肢のキー
- 値は `A` / `B` / `C` / `D` のいずれか

### 4.7 `explanation`

- 正解の理由を説明する文字列
- 学習効果向上のため、正解理由・誤答理由・短いコード例・実務上の注意点を含めるのが望ましい

### 4.8 `references`

- 参考リンク一覧（配列）
- 各要素は最低限 `title` と `url` を持つ

### 4.9 `domain`

- 問題の大分類（定義）
  - `Streaming`
  - `DLT`
  - `Governance`
- セクション横断の分析用

### 4.10 `tags`

- 詳細分類タグ（配列）
- 検索・復習・分析に利用
- 推奨: 1問あたり 3〜6 個程度
- タグ例
  - `Auto Loader`
  - `schema evolution`
  - `checkpoint`
  - `Delta Lake`
  - `Unity Catalog`
  - `SCD Type 2`
  - `watermark`
  - `expectations`
- 作成のコツ
  - 「機能名 + 論点」で短く具体化する（例: `Auto Loader` + `schema evolution`）
  - 同義語の表記ゆれを避ける（例: `Unity Catalog` に統一）
  - 迷う場合は ChatGPT で候補を出し、最終的に既存タグ体系へ正規化する

### 4.11 `difficulty`

- 難易度
- 定義値: `easy` / `medium` / `hard`
- 基準
  - `easy`: 単一知識で解ける基礎問題。長い前提や複数サービス横断の判断を必要としない。
  - `medium`: 2つ以上の知識を組み合わせる標準問題。選択肢の比較や設定差分の理解が必要。
  - `hard`: 長文シナリオや複数要件のトレードオフ判断を含む応用問題。誤答の見極めが難しい。

### 4.12 `sourceType`

- 問題の出自（定義）
  - `original`: 作問者が独自に作成した問題。
  - `official-inspired`: 公式ドキュメントや試験ガイドの論点を参考に再構成した問題（文面コピーはしない）。
  - `scenario-based`: 実務シナリオを前提に、要件から最適解を選ぶ形式の問題。

### 4.13 `whyWrong`

- 誤答選択肢の補足説明オブジェクト
- 正解選択肢を含める必要はない（誤答のみ記載で可）
- 例
  ```json
  "whyWrong": {
    "A": "checkpointLocation はストリーミング進捗管理であり、スキーマ管理用途ではありません。",
    "C": "要件の『継続取り込み時のスキーマ進化』を満たしていません。",
    "D": "フォーマット変換は回避策であり、根本解決になりません。"
  }
  ```

### 4.14 `notes`

- 作問・メンテナンス用の管理メモ
- アプリに表示しなくてもよい

### 4.15 `variantGroup`

`variantGroup` は、同じ知識・判断基準を異なる問い方で確認し、かつ同じ選択肢本文集合を使う問題どうしを関係付ける、DEP向けPhase F v1の任意フィールドです。タグや表示文言ではなく、アプリには直接表示しない安定した関係IDです。

| 契約              | 内容                                                                           |
| ----------------- | ------------------------------------------------------------------------------ |
| 型                | string（非空文字列）                                                           |
| 前後空白          | 禁止                                                                           |
| 大文字・小文字    | 区別する                                                                       |
| 推奨形式          | 英小文字、数字、ハイフンで構成する安定ID（例：`auto-loader-schema-evolution`） |
| groupの最小問題数 | 2問                                                                            |

同じgroupに属する問題は、次の不変条件を満たします。

- 各問題は異なる`id`を持つ完全なquestion objectです。
- `choices`はA/B/C/Dのラベルや割り当て順ではなく、選択肢本文の集合が一致します。比較時は各本文の前後空白だけを除きます。大文字小文字、句読点、記号、内部空白、文言の差は同一視しません。類似度判定やその他の自動正規化も行いません。
- `answer`は問題ごとに持ち、問い方と選択肢の割り当てに応じてgroup内で異なってかまいません。
- `question`、`answer`、`explanation`、`whyWrong`、`references`、`section`、`sectionTitle`、`domain`、`tags`、`difficulty`、`sourceType`、`notes`をgroup内で暗黙に共有しません。
- progress、正答率、確信度、回答試行履歴の記録単位は従来どおり個別のquestion IDです。group単位の値は`questions.json`に保存しません。
- 1sessionに採用する問題数、問題の選択・順序・間隔はschemaではなくF2のruntime責務です。

### 4.16 `followUp`

`followUp` は、元問題の解説後に追加確認候補となる問題を示す、DEP向けPhase F v1の任意フィールドです。これは候補への1段の有向参照だけを表し、自動表示や画面遷移を指示しません。

```json
{
  "followUp": {
    "questionId": "Q403"
  }
}
```

- `followUp`はplain objectで、Phase F v1で許可する子項目は`questionId`だけです。未知の子項目は禁止します。
- `questionId`は前後空白のない非空文字列で、同じ`questions.json`内に存在する別の問題の`id`を指します。
- 参照先は通常問題と同じ必須項目を持つ完全な独立question objectです。埋め込みの部分問題として定義しません。
- 自己参照、存在しないIDへの参照（dangling reference）、A → B・B → Aの循環を禁止します。
- 参照先問題は`followUp`を持てません。したがってA → B → Cの多段chainも禁止され、深度は1段です。
- 同じ参照先を複数の元問題から参照することは禁止しません。参照先を通常の出題poolに含めるかもschemaでは決めません。
- 参照先のID、正解、progress、確信度、回答試行履歴を元問題へ統合しません。follow-upとして回答した場合も、従来どおり参照先のquestion ID単位で記録します。
- 提示条件、画面状態、遷移、戻り先はschemaではなくF3のruntime・UI責務です。

---

## 5. 必須項目と任意項目

### 必須

- `id`
- `section`
- `sectionTitle`
- `question`
- `choices`
- `answer`
- `explanation`

### 任意（推奨）

- `references`
- `domain`
- `tags`
- `difficulty`

### 任意（拡張向け）

- `sourceType`
- `whyWrong`
- `notes`

### 任意（出題バリエーション向け）

- `variantGroup`
- `followUp`

---

## 6. DEA版との後方互換性

- 既存DEA問題は、新規項目がなくても動作可能
- 新規項目は追加方式
- アプリ側が未対応の場合は無視しやすい設計
- `variantGroup`と`followUp`は任意であり、両フィールドを持たない既存DEP問題も変更なしで有効
- 既存必須項目、question ID、問題配列であるtop-level構造は変更せず、schema versionも新設しない
- Phase F v1の`variantGroup`と`followUp`はDEP限定の拡張とし、本契約はDEA・DEA Plusのschemaや問題データを変更しない
- 新フィールドの有無にかかわらず、progress、確信度、回答試行履歴は個別のquestion ID単位の既存契約を維持する

---

## 7. 運用ルール（推奨）

- `id`: 一意であること
- `domain`: 表記ゆれを防ぐ（例: `Streaming`, `Governance`, `Performance`, `Security`, `CI/CD`）
- `difficulty`: `easy / medium / hard` の3段階
- `tags`: 3〜6個程度を目安
- `references`: 可能なら公式Docs中心、`title` を明確にする
- `variantGroup`: 同じ不変条件を満たす2問以上に同じ安定IDを付与する
- `followUp`: 同一ファイル内の参照整合性と1段制限を保つ

---

## 8. 最小構成サンプル

```json
{
  "id": "Q300",
  "section": "1",
  "sectionTitle": "Databricks Intelligence Platform",
  "question": "Databricksの価値として最も適切なのはどれ？",
  "choices": {
    "A": "選択肢A",
    "B": "選択肢B",
    "C": "選択肢C",
    "D": "選択肢D"
  },
  "answer": "B",
  "explanation": "正解はBです。..."
}
```

---

## 9. 拡張構成サンプル

```json
{
  "id": "Q301",
  "section": "3",
  "sectionTitle": "データ処理 & 変換",
  "domain": "Streaming",
  "tags": ["Auto Loader", "schema evolution"],
  "difficulty": "hard",
  "sourceType": "original",
  "question": "Auto Loader でスキーマ進化を扱う際に最も適切なのはどれ？",
  "choices": {
    "A": "schemaLocation を使わない",
    "B": "schemaLocation を永続化し、進化モードを適切に設定する",
    "C": "checkpointLocation だけで十分",
    "D": "CSV に変換して扱う"
  },
  "answer": "B",
  "explanation": "schemaLocation は推論済みスキーマを保持し、継続的な取り込みやスキーマ進化に対応するために重要です。",
  "whyWrong": {
    "A": "推論結果の継続利用ができません。",
    "C": "checkpointLocation は進捗管理用です。",
    "D": "本質的な解決策ではありません。"
  },
  "references": [
    {
      "title": "Auto Loader schema inference and evolution",
      "url": "https://docs.databricks.com/..."
    }
  ],
  "notes": "Streaming問題の代表例"
}
```

---

## 10. バリデーションの考え方

### 必須チェック

- JSON として読める
- `id` 重複なし
- 必須項目が存在する
- `choices` が `A/B/C/D` を持つ
- `answer` が `A/B/C/D` のいずれか

### 任意チェック

- `references` がある場合、各要素に `title` と `url`
- `difficulty` がある場合、許容値内
- `tags` がある場合、配列
- `whyWrong` がある場合、オブジェクト

---

## 11. 今後の拡張候補

- `scenarioType`
- `estimatedTimeSec`
- `relatedQuestions`
- `learningObjective`

---

## 12. まとめ

DEP版 `questions.json` は、既存DEA版の基本構造を維持しつつ、`domain / tags / difficulty / sourceType / whyWrong / notes` と、Phase F v1の`variantGroup / followUp`を拡張できる設計です。

これにより、弱点分析・タグ別復習・難易度別出題・誤答理由の可視化に加えて、DEPでは問題間relationを用いた出題体験の拡張に繋げられます。

---

## 13. 出題バリエーション構成サンプル

以下は、必須項目をすべて含むPhase F v1の正常例です。

### 13.1 2問の`variantGroup`

A/B/C/Dへの割り当て順は異なりますが、2問の選択肢本文集合は一致しています。問題文、正解、解説は各問題が独立して持ちます。

```json
[
  {
    "id": "Q401",
    "section": "3",
    "sectionTitle": "Data Transformation, Cleansing, and Quality",
    "question": "Auto Loaderで推論済みスキーマを継続利用するために永続化する場所はどれ？",
    "choices": {
      "A": "checkpointLocation",
      "B": "schemaLocation",
      "C": "warehouse directory",
      "D": "driver local disk"
    },
    "answer": "B",
    "explanation": "schemaLocationには推論済みスキーマが保存されます。",
    "variantGroup": "auto-loader-schema-location"
  },
  {
    "id": "Q402",
    "section": "3",
    "sectionTitle": "Data Transformation, Cleansing, and Quality",
    "question": "推論済みスキーマの永続化先として不適切なものはどれ？",
    "choices": {
      "A": "driver local disk",
      "B": "warehouse directory",
      "C": "schemaLocation",
      "D": "checkpointLocation"
    },
    "answer": "A",
    "explanation": "driver local diskは安定した永続化先ではありません。",
    "variantGroup": "auto-loader-schema-location"
  }
]
```

### 13.2 `followUp`と両relationの併用

`Q411`は`variantGroup`と`followUp`を併用しています。`Q413`は同じ配列内の完全な独立question objectで、`followUp`を持たないため、参照は1段で終了します。

```json
[
  {
    "id": "Q411",
    "section": "3",
    "sectionTitle": "Data Transformation, Cleansing, and Quality",
    "question": "Auto Loaderのスキーマ情報を永続化する設定はどれ？",
    "choices": {
      "A": "schemaLocation",
      "B": "checkpointLocation",
      "C": "cloudFiles.format",
      "D": "maxFilesPerTrigger"
    },
    "answer": "A",
    "explanation": "schemaLocationは推論済みスキーマを保持します。",
    "variantGroup": "auto-loader-schema-setting",
    "followUp": {
      "questionId": "Q413"
    }
  },
  {
    "id": "Q412",
    "section": "3",
    "sectionTitle": "Data Transformation, Cleansing, and Quality",
    "question": "Auto Loaderのスキーマ情報の永続化に使わない設定はどれ？",
    "choices": {
      "A": "maxFilesPerTrigger",
      "B": "cloudFiles.format",
      "C": "checkpointLocation",
      "D": "schemaLocation"
    },
    "answer": "C",
    "explanation": "checkpointLocationはストリーミング進捗用であり、推論済みスキーマの永続化先ではありません。",
    "variantGroup": "auto-loader-schema-setting"
  },
  {
    "id": "Q413",
    "section": "3",
    "sectionTitle": "Data Transformation, Cleansing, and Quality",
    "question": "schemaLocationとcheckpointLocationを分ける主な理由はどれ？",
    "choices": {
      "A": "保存対象となる状態が異なるため",
      "B": "常に同じ値を指定する必要があるため",
      "C": "CSVでしか利用できないため",
      "D": "いずれも画面表示専用だから"
    },
    "answer": "A",
    "explanation": "前者はスキーマ、後者はストリーミング進捗という異なる状態を管理します。"
  }
]
```

8章の最小構成サンプルのように`variantGroup`と`followUp`を持たない既存問題も、引き続き正常なDEP問題です。

---

## 14. 禁止例とschemaの責務境界

次の断片は契約違反の説明用であり、完全なquestion objectを省略しています。

| 禁止例                                                                                    | 契約違反となる理由                         |
| ----------------------------------------------------------------------------------------- | ------------------------------------------ |
| 1問だけが`"variantGroup": "single"`を持つ                                                 | groupは2問以上で構成する                   |
| 同じgroupの一方だけが`{"A": "alpha", ...}`、他方が`{"A": "different", ...}`を選択肢に持つ | 前後空白を除いた選択肢本文集合が一致しない |
| `"variantGroup": ""`または`" variant"`                                                    | relation IDは非空で前後空白を持たない      |
| `Q501`の`followUp.questionId`が`Q501`                                                     | 自己参照になる                             |
| `followUp.questionId`が同じファイルにない`Q999`                                           | dangling referenceになる                   |
| AがB、BがCを参照                                                                          | 多段chainになる                            |
| AがB、BがAを参照                                                                          | cycleになる                                |
| `{"questionId": "Q502", "trigger": "incorrect"}`                                          | `questionId`以外の未知子項目を持つ         |

`followUp`へ提示条件などを埋め込む次の例も禁止です。

```json
{
  "followUp": {
    "questionId": "Q502",
    "trigger": "incorrect",
    "sessionMode": "review"
  }
}
```

Phase F v1のschemaは問題間のrelationだけを保持します。次の判断や状態は`questions.json`へ`isFollowUp`、`parentQuestionId`、`trigger`、`progressMode`、`sessionMode`、`displayOrder`などのフィールドとして保存しません。

- 同一`variantGroup`から1sessionに採用する問題数、代表問題の抽選、modeごとの選択規則、出題順・間隔、session snapshot
- follow-upの採点結果・確信度・guidanceに基づく提示条件、CTA文言、自動開始、開始・キャンセル・完了状態
- 「次へ」とCTAの優先順位、follow-up後の戻り先、browser back/forwardとの同期
- follow-up専用progress modeや、group単位のprogress・正答率・確信度・履歴

これらのうちバリアントのsession選択はF2、解説内でのfollow-up提示・操作はF3のruntime・UI責務です。`variantGroup`と`followUp`を同じ問題で併用しても両relationは独立して解釈し、question ID単位の記録契約は変わりません。
