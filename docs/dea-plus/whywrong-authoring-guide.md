# DEA Plus `whyWrong` 記述ガイド

このドキュメントは、`dea-quiz-app-plus/questions.json` に `whyWrong` を追加する後続 PR で参照するための記述ルールです。

Phase 2-3-A では方針整理のみを行い、実問題データ、アプリ本体、validator、E2E、workflow は変更しません。実データへの `whyWrong` 追加は、後続の Phase 2-3-B 以降で小さな PR に分けて実施します。

## `whyWrong` の目的

`whyWrong` は、選択肢ごとの「なぜその選択肢が誤りなのか」を説明する任意フィールドです。通常の `explanation` が正答理由や問題全体の補足を担うのに対し、`whyWrong` は誤答選択肢に固有の理由を短く示します。

```json
{
  "choices": {
    "A": "正答の選択肢",
    "B": "誤答B",
    "C": "誤答C",
    "D": "誤答D"
  },
  "answer": "A",
  "explanation": "Aが正答である理由や問題全体の補足。",
  "whyWrong": {
    "B": "Bが誤りである理由。",
    "C": "Cが誤りである理由。",
    "D": "Dが誤りである理由。"
  }
}
```

## 基本方針

| 項目            | 方針                                                            |
| --------------- | --------------------------------------------------------------- |
| 型              | object                                                          |
| key             | 元データの `choices` key                                        |
| value           | 非空文字列                                                      |
| 正答 key        | 含めない                                                        |
| 必須性          | 任意                                                            |
| 表示            | 回答後、正答・誤答に関係なく存在する `whyWrong` を表示          |
| 表示順          | 画面上の選択肢順に追随                                          |
| Markdown 風表現 | inline code、strong、code fence、箇条書きを必要に応じて利用可能 |

## 記述ルール

### 1. 誤答理由に絞る

`whyWrong` には、その選択肢がなぜ誤りなのかを書きます。

書いてよい内容:

- その選択肢の記述が問題文の条件と合わない理由
- その選択肢が別の概念・機能・処理を説明している理由
- 正答と混同しやすいポイントのうち、当該選択肢に固有の差分

避ける内容:

- 正答がなぜ正しいかだけの説明
- 通常の `explanation` と同じ説明の繰り返し
- 選択肢と直接関係しない補足説明
- 「不正解です」「誤りです」だけの曖昧な説明

良い例:

```json
{
  "whyWrong": {
    "B": "Bはクラスタの起動方式に関する説明であり、SQL Warehouseの用途説明ではありません。"
  }
}
```

悪い例:

```json
{
  "whyWrong": {
    "B": "正解はAです。SQL WarehouseはSQL実行に使います。"
  }
}
```

### 2. 正答 key には書かない

`whyWrong` は誤答選択肢の理由であるため、正答 key には書きません。正答理由は通常の `explanation` に書きます。

OK:

```json
{
  "answer": "A",
  "whyWrong": {
    "B": "Bが違う理由。",
    "C": "Cが違う理由。",
    "D": "Dが違う理由。"
  }
}
```

NG:

```json
{
  "answer": "A",
  "whyWrong": {
    "A": "Aが正しい理由。",
    "B": "Bが違う理由。"
  }
}
```

### 3. `explanation` と役割を分ける

| 項目          | 役割                                       |
| ------------- | ------------------------------------------ |
| `explanation` | 正答の理由、問題全体の解説、関連知識の補足 |
| `whyWrong`    | 各誤答選択肢がなぜ違うのか                 |

`whyWrong` は、`explanation` の要約や再掲ではなく、誤答選択肢ごとの補助解説として書きます。背景説明が長くなる場合は `explanation` に寄せ、`whyWrong` は選択肢固有の差分に絞ります。

### 4. 画面ラベルではなく元データ key に紐づける

DEA Plus では画面上の選択肢がシャッフルされるため、`whyWrong` は画面上の表示ラベルではなく、元データの `choices` key に紐づけます。

```json
{
  "choices": {
    "A": "正答",
    "B": "誤答B",
    "C": "誤答C",
    "D": "誤答D"
  },
  "answer": "A",
  "whyWrong": {
    "B": "元データBが違う理由。",
    "C": "元データCが違う理由。",
    "D": "元データDが違う理由。"
  }
}
```

画面上で元データ B の選択肢が A として表示される場合でも、`whyWrong.B` は元データ B の理由として扱います。表示側は `choiceMap` により画面表示順へ追随します。

### 5. 1〜3文程度にまとめる

`whyWrong` は短すぎず、長すぎない説明にします。目安は 1〜3文程度です。

- 1文で理由が明確なら 1文でよい
- 複数の混同ポイントがある場合でも、当該選択肢に必要な範囲に絞る
- 詳細な背景説明や関連知識は `explanation` に寄せる

### 6. Markdown 風表現は必要最小限にする

`whyWrong` 本文では、既存の Markdown 風描画に合わせて以下を使えます。

- inline code: `` `SQL Warehouse` ``
- strong: `**重要語句**`
- code fence
- 箇条書き

ただし、装飾を増やしすぎるとレビューしづらくなるため、用語やコード断片の明確化に必要な範囲にとどめます。

### 7. 既存問題の意味を変えない

`whyWrong` 追加時は、原則として以下を変更しません。

- `question`
- `choices`
- `answer`
- `explanation`

明らかな誤字・表記揺れを同時に直す必要がある場合は、PR 本文で変更箇所と理由を明記します。

## 後続 PR の推奨編集粒度

`questions.json` への `whyWrong` 追加は、レビューしやすい小ロットで進めます。

推奨粒度:

- 1 PR あたり 5〜10問程度
- または 1 PR あたり 1セクション
- 1セクションの問題数が多い場合は、さらに分割する

小さく分ける理由:

- 誤答理由は構造だけでなく内容の品質レビューが必要になる
- 差分が大きすぎると、選択肢 key と説明の対応確認が難しくなる
- validator では構造を検査できても、説明の妥当性や自然さは人間/ChatGPTレビューが必要になる

## 後続 PR のレビュー観点

`questions.json` に `whyWrong` を追加する PR では、以下を確認します。

1. `whyWrong` key が `choices` key に存在するか
2. 正答 key を含んでいないか
3. value が非空文字列か
4. 誤答理由がその選択肢に固有の説明になっているか
5. `explanation` と矛盾していないか
6. `explanation` と重複しすぎていないか
7. 正答理由を `whyWrong` に書いていないか
8. 選択肢シャッフルを前提に、元データ key へ紐づけているか
9. Markdown 風表現が壊れていないか
10. Databricks / DEA 文脈として不自然な説明になっていないか
11. 既存の `question` / `choices` / `answer` / `explanation` を不要に変更していないか
12. validator と E2E が成功しているか

## 後続 PR の検証コマンド

`questions.json` に `whyWrong` を追加する PR では、最低限以下を確認します。

```bash
npm run validate:dea-plus-questions
npm run validate:dea-questions
npm run validate:dep-questions
npm run test:question-validator
npm run format:check
```

可能であれば以下も確認します。

```bash
npm run test:e2e
npm test
```

ローカルで Playwright 実行が難しい場合は、GitHub Actions 上の結果を確認します。

## Codex へ後続データ編集を依頼する場合の注意

Codex に `questions.json` への `whyWrong` 追加を依頼する場合は、依頼文で以下を明確にします。

- 対象問題 ID または対象セクション
- 変更してよいファイルは `dea-quiz-app-plus/questions.json` のみか、関連ドキュメントも含むか
- `question` / `choices` / `answer` / `explanation` を原則変更しないこと
- 正答 key に `whyWrong` を書かないこと
- `whyWrong` は元データの `choices` key に紐づけること
- 上記の検証コマンドを実行すること
