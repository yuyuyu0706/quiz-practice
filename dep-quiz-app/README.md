# questions.json スキーマ説明（DEP クイズアプリ）

このドキュメントは、`dep-quiz-app/questions.json` のデータ仕様を説明するための README です。  
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

---

### 4.2 `section`
- 試験ガイド上の大分類番号を文字列で保持
- 例：
  - `"1"`
  - `"2"`
  - `"3"`

> 文字列にしているのは、既存DEA版との整合性を取りやすくするためです。

---

### 4.3 `sectionTitle`
- 画面上に表示するセクション名
- 例：
  - `"Databricks Intelligence Platform"`
  - `"データ処理 & 変換"`

---

### 4.4 `question`
- 問題文そのもの
- DEP版では長文シナリオ問題も想定
- 改行を含めてもよい

---

### 4.5 `choices`
- 4択問題を前提に、通常は `A/B/C/D` を持つオブジェクト
- 例：

```json
"choices": {
  "A": "選択肢A",
  "B": "選択肢B",
  "C": "選択肢C",
  "D": "選択肢D"
}
```

- 現行アプリは4択前提のため、まずは `A/B/C/D` を維持してください

---

### 4.6 `answer`
- 正解選択肢のキー
- 値は `A` / `B` / `C` / `D` のいずれか

例：

```json
"answer": "B"
```

---

### 4.7 `explanation`
- 正解の理由を説明する文字列
- DEP版では、可能なら以下を含めると学習効果が高いです
  - 正解理由
  - 他選択肢が誤りの理由
  - 短い SQL / PySpark 例
  - 実務的な注意点

- 長文でも可
- Markdown風の記法（見出し、箇条書き、コードブロック）を含んでもよい

---

### 4.8 `references`
- 参考リンク一覧
- 配列で持つ
- 各要素は最低限 `title` と `url` を持つ

例：

```json
"references": [
  {
    "title": "Databricks Auto Loader",
    "url": "https://docs.databricks.com/..."
  }
]
```

#### 用途
- アプリ上の「参考リンク」表示
- 公式Docsへの導線
- 復習時の深掘り

---

### 4.9 `domain`
- 問題の大分類
- セクションを横断した学習分析用
- 例：
  - `"Streaming"`
  - `"DLT"`
  - `"Governance"`
  - `"Performance"`
  - `"CI/CD"`
  - `"Security"`
  - `"Modeling"`

#### 用途
- ドメイン別弱点分析
- 将来のフィルタ・復習機能
- Professional版の問題分類

---

### 4.10 `tags`
- より細かい技術タグ
- 配列で持つ
- 例：

```json
"tags": ["Auto Loader", "schema evolution", "Streaming"]
```

#### 用途
- タグ別復習
- 検索
- 出題傾向分析

---

### 4.11 `difficulty`
- 難易度
- 基本値の例：
  - `easy`
  - `medium`
  - `hard`

#### 用途
- 難易度別出題
- 間違えやすい問題の抽出
- 学習順序設計

---

### 4.12 `sourceType`
- 問題の出自
- 例：
  - `original`
  - `official-inspired`
  - `scenario-based`

#### 用途
- 問題管理
- 作問ルール整理
- 将来の編集判断

---

### 4.13 `whyWrong`
- 誤答選択肢の理由を補足するオブジェクト
- 正解選択肢を必ず含める必要はありません
- 通常は **誤答だけ記載** すれば十分です

例：

```json
"whyWrong": {
  "A": "checkpointLocation は進捗管理用であり、スキーマ管理ではありません。",
  "C": "要件と関係のない選択肢です。",
  "D": "Databricksの推奨設計と逆方向です。"
}
```

#### 用途
- 復習時の理解強化
- 将来の「誤答理由表示」機能
- DEP版の判断問題強化

---

### 4.14 `notes`
- 作問者向けの補足メモ
- アプリ表示に使わなくてもよい
- 例：
  - `"Professional向けに長文化候補"`
  - `"DLT比較問題へ発展可能"`

#### 用途
- 問題メンテナンス
- 追加改修時のメモ

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

### 任意（ただし推奨）
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
このスキーマは、既存の `dea-quiz-app` で使われている基本構造を壊さないように設計しています。

### 後方互換の考え方
- 既存DEA問題は、新規項目が無くても動作可能
- 新規項目は追加方式
- アプリ側が未対応でも無視しやすい設計

### つまり
以下のような既存DEA問題も引き続き有効です。

```json
{
  "id": "Q1",
  "section": "1",
  "sectionTitle": "Databricks Intelligence Platform",
  "question": "Databricksの価値として最も適切なのはどれ？",
  "choices": {
    "A": "A",
    "B": "B",
    "C": "C",
    "D": "D"
  },
  "answer": "B",
  "explanation": "..."
}
```

---

## 7. 運用ルール（推奨）
### 7.1 `id`
- 一意であること
- 既存問題番号と重複しないこと

### 7.2 `domain`
- できるだけ表記ゆれを防ぐ
- 例：
  - `Streaming`
  - `Governance`
  - `Performance`
  - `Security`
  - `CI/CD`

### 7.3 `difficulty`
- 当面は `easy / medium / hard` の3段階推奨

### 7.4 `tags`
- タグは3〜6個程度までを目安にする
- 細かすぎるタグは増やしすぎない

### 7.5 `references`
- 可能なら公式Docs中心
- `title` は人が見て分かる文言にする
- URLだけの羅列にしない

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
`questions.json` の自動チェックでは、少なくとも以下を確認することを推奨します。

### 必須チェック
- JSON として読める
- `id` 重複なし
- 必須項目が存在する
- `choices` が `A/B/C/D` を持つ
- `answer` が `A/B/C/D` のいずれか

### 任意チェック
- `references` がある場合、各要素に `title` と `url` がある
- `difficulty` がある場合、許容値内である
- `tags` がある場合、配列である
- `whyWrong` がある場合、オブジェクトである

---

## 11. 今後の拡張候補
将来的には、さらに以下の項目を追加できる余地があります。

- `scenarioType`
- `estimatedTimeSec`
- `relatedQuestions`
- `learningObjective`

ただし、現時点では無理に入れず、まずは `domain / tags / difficulty / whyWrong` を安定運用するのが良いです。

---

## 12. まとめ
DEP版 `questions.json` は、既存DEA版の基本構造を維持しつつ、以下を拡張できるようにした仕様です。

- `domain`：大分類
- `tags`：詳細分類
- `difficulty`：難易度
- `sourceType`：出自
- `whyWrong`：誤答理由
- `notes`：管理メモ

この設計により、今後は単なる問題表示だけでなく、

- 弱点分析
- タグ別復習
- 難易度別出題
- 誤答理由の可視化

といった学習体験強化にもつなげやすくなります。
