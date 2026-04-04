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

| 項目名 | 型 | 必須 | 説明 |
|---|---|---:|---|
| `id` | string | 必須 | 問題ID。リポジトリ内で一意にする |
| `section` | string | 必須 | 試験ガイド上の大分類番号。文字列で保持 |
| `sectionTitle` | string | 必須 | セクションの表示名 |
| `question` | string | 必須 | 問題文 |
| `choices` | object | 必須 | 選択肢。通常は `A/B/C/D` の4件 |
| `answer` | string | 必須 | 正解の選択肢キー。`A` / `B` / `C` / `D` のいずれか |
| `explanation` | string | 必須 | 正解理由の解説。Markdown風の長文も可 |
| `references` | array | 任意 | 参考リンク一覧 |
| `domain` | string | 任意（推奨） | 問題の大分類。弱点分析や出題整理に使う |
| `tags` | array[string] | 任意（推奨） | 詳細タグ。検索や復習分類に使う |
| `difficulty` | string | 任意（推奨） | 難易度。`easy` / `medium` / `hard` を想定 |
| `sourceType` | string | 任意 | 問題の出自。`original` など |
| `whyWrong` | object | 任意 | 誤答選択肢ごとの補足説明 |
| `notes` | string | 任意 | 作問・管理用メモ。アプリ表示対象外でも可 |

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

---

## 6. DEA版との後方互換性
- 既存DEA問題は、新規項目がなくても動作可能
- 新規項目は追加方式
- アプリ側が未対応の場合は無視しやすい設計

---

## 7. 運用ルール（推奨）
- `id`: 一意であること
- `domain`: 表記ゆれを防ぐ（例: `Streaming`, `Governance`, `Performance`, `Security`, `CI/CD`）
- `difficulty`: `easy / medium / hard` の3段階
- `tags`: 3〜6個程度を目安
- `references`: 可能なら公式Docs中心、`title` を明確にする

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
DEP版 `questions.json` は、既存DEA版の基本構造を維持しつつ、`domain / tags / difficulty / sourceType / whyWrong / notes` を拡張できる設計です。

これにより、弱点分析・タグ別復習・難易度別出題・誤答理由の可視化といった学習体験強化に繋げられます。
