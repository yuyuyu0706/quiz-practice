# DEP Phase 2: 問題データ拡張仕様

## 目的

本メモは `dea-quiz-app/questions.json` と `dep-quiz-app/questions.json` の両方で扱える、後方互換性を保った問題データ仕様を定義する。

- 既存 DEA 問題の必須項目は維持する
- DEP で必要になる長文・高難度・将来の分析用途向けメタデータを追加する
- 追加項目はすべて任意とし、未設定でも既存アプリが最低限動作できる状態を保つ
- `scripts/validate-questions.mjs` で検証可能な範囲を明文化する

## データ構造の基本方針

- ルートは従来どおり「問題オブジェクトの配列」とする
- 既存の描画ロジックが参照する項目は削除・改名しない
- 拡張項目は追加方式とし、アプリ側が未対応でも無視できる形にする
- `whyWrong` や `notes` のような補助情報は、保存時点では保持し、表示要否は後続フェーズで決める

## 項目一覧

| 項目名 | 型 | 必須/任意 | DEAで利用 | DEPで利用 | 用途 | 備考 |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | string | 必須 | ○ | ○ | 問題の一意識別子 | 重複不可 |
| `section` | string | 必須 | ○ | ○ | 出題セクション識別 | 既存互換のため string 維持 |
| `sectionTitle` | string | 必須 | ○ | ○ | セクション名表示 | 既存UIで利用 |
| `question` | string | 必須 | ○ | ○ | 問題本文 | 長文シナリオも許容 |
| `choices` | object | 必須 | ○ | ○ | 選択肢 | `A`〜`D` の4択を維持 |
| `answer` | string | 必須 | ○ | ○ | 正答ラベル | `A` / `B` / `C` / `D` |
| `explanation` | string | 必須 | ○ | ○ | 正答解説 | 空文字は非推奨だが string 必須 |
| `references` | array<object> | 任意 | ○ | ○ | 参考リンク | 要素は `title` と `url` を持つ |
| `domain` | string | 任意 | △ | ○ | 大分類 | 例: `Streaming`, `Governance` |
| `tags` | array<string> | 任意 | △ | ○ | 細分類タグ | 例: `Auto Loader`, `MERGE` |
| `difficulty` | string | 任意 | △ | ○ | 難易度 | `easy` / `medium` / `hard` |
| `sourceType` | string | 任意 | - | ○ | 問題の出自 | `original` / `official-inspired` / `scenario-based` |
| `whyWrong` | object | 任意 | - | ○ | 誤答理由 | キーは誤答ラベルのみ |
| `notes` | string | 任意 | - | ○ | 作問メモ | UI非表示前提でも可 |
| `scenarioType` | string | 任意 | - | 将来 | シナリオ問題の種類 | `single-step` / `multi-step` / `architecture` / `troubleshooting` |
| `estimatedTimeSec` | integer | 任意 | - | 将来 | 想定解答時間 | 正の整数 |

### 補足ルール

- `choices` は `A` / `B` / `C` / `D` の4キーを必須とする
- `whyWrong` は誤答選択肢のみ保持し、正答ラベルは定義しない
- `tags` は0件以上を許容するが、定義する場合は非空文字列の配列にする
- `notes` は作問・レビュー用メモとして扱い、現行アプリの表示要件には含めない
- 将来項目を先に定義しても、未実装 UI はそれらを無視してよい

## 必須項目と後方互換性

### 必須項目

以下は DEA / DEP 共通の必須項目とする。

```json
[
  "id",
  "section",
  "sectionTitle",
  "question",
  "choices",
  "answer",
  "explanation"
]
```

### 任意項目

以下はすべて追加方式の任意項目とする。

- `references`
- `domain`
- `tags`
- `difficulty`
- `sourceType`
- `whyWrong`
- `notes`
- `scenarioType`
- `estimatedTimeSec`

### DEA との互換性の考え方

- DEA の既存問題は拡張項目を持たなくてもバリデーションを通過できる
- 既存 UI が参照するフィールド名は変更しないため、`dea-quiz-app/app.js` の即時改修は不要
- DEP では先に拡張項目を入れ、DEA では必要な問題から段階的に採用できる
- 新規メタ情報は「設定されていれば活用できる」方式に留めることで、段階移行を可能にする

## JSON サンプル

### 最小構成サンプル

```json
{
  "id": "Q101",
  "section": "2",
  "sectionTitle": "開発と取り込み",
  "question": "Auto Loader の主目的として最も適切なのはどれ？",
  "choices": {
    "A": "増分ファイル取り込みを簡素化する",
    "B": "権限付与を自動化する",
    "C": "クラスターを停止させない",
    "D": "すべてのデータを CSV に変換する"
  },
  "answer": "A",
  "explanation": "Auto Loader はクラウドストレージ上の新規ファイルを増分で安全に取り込むための仕組みである。"
}
```

### 拡張構成サンプル

```json
{
  "id": "Q201",
  "section": "3",
  "sectionTitle": "データ処理 & 変換",
  "domain": "Streaming",
  "tags": ["Auto Loader", "schema evolution"],
  "difficulty": "hard",
  "sourceType": "original",
  "scenarioType": "troubleshooting",
  "estimatedTimeSec": 150,
  "question": "Auto Loader でスキーマ進化を扱う際に最も適切なのはどれ？",
  "choices": {
    "A": "schemaLocation を使わない",
    "B": "schemaLocation を永続化し、進化モードを適切に設定する",
    "C": "checkpointLocation だけで十分",
    "D": "CSV に変換して扱う"
  },
  "answer": "B",
  "explanation": "schemaLocation は推論済みスキーマの継続利用に必要であり、checkpointLocation とは責務が異なる。",
  "whyWrong": {
    "A": "推論結果の継続利用ができない",
    "C": "checkpoint は進捗管理であり schema 管理ではない",
    "D": "要件と関係がない"
  },
  "references": [
    {
      "title": "Auto Loader schema inference and evolution",
      "url": "https://docs.databricks.com/aws/en/ingestion/cloud-object-storage/auto-loader/schema"
    }
  ],
  "notes": "Professional 向けに長文シナリオ化しやすい題材。"
}
```

## バリデーション方針

### 必須として検証する項目

- ルートが配列であること
- 各問題が object であること
- 必須項目が存在すること
- `id` が非空文字列かつ一意であること
- `section` / `sectionTitle` / `question` が非空文字列であること
- `choices` が object であり、`A`〜`D` を必ず持つこと
- `answer` が `A` / `B` / `C` / `D` のいずれかであること
- `explanation` が string であること
- `references` を設定する場合、各要素が `title` と `url` を持つこと

### 任意項目として検証する項目

- `domain`: 設定時は非空文字列
- `tags`: 設定時は非空文字列の配列
- `difficulty`: 設定時は `easy` / `medium` / `hard`
- `sourceType`: 設定時は `original` / `official-inspired` / `scenario-based`
- `whyWrong`: 設定時は object で、キーは誤答ラベルのみ、値は非空文字列
- `notes`: 設定時は string
- `scenarioType`: 設定時は `single-step` / `multi-step` / `architecture` / `troubleshooting`
- `estimatedTimeSec`: 設定時は正の整数

### 実装上の運用ルール

- `npm run validate:dea-questions` は DEA の既存データ互換性確認として残す
- `npm run validate:dep-questions` を追加し、DEP サンプルも同じバリデーションロジックで確認する
- 共通ロジックは `scripts/validate-questions.mjs` に集約し、項目追加時の二重管理を避ける

## 次フェーズへの提案

1. `dep-quiz-app/app.js` で `domain` / `difficulty` の表示可否を切り替えられるようにする
2. 誤答復習モードで `whyWrong` を活用する UI を追加する
3. `tags` / `domain` を使ったフィルタ・弱点分析の設計に着手する
4. 問題作成フローに本仕様を組み込み、レビュー時に `sourceType` と `notes` を必須運用にする
