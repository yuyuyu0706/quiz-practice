# 機能実装書の品質運用ガイド

## 目的と責務

本書は、機能実装書の品質基盤を日常的に実行、判断、変更するための運用の正本である。品質ルールそのものは[品質契約](quality-contract.md)を参照する。品質契約へ運用手順を重ねて記載せず、「何を守るか」と「どう運用するか」を分離する。

| 正本                                                                                                     | 責務                                                  | 修正する問題                 |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------- |
| [品質契約](quality-contract.md)                                                                          | Rule ID、検出・除外条件、人手レビュー境界、終了コード | 守る品質の定義や例外         |
| `scripts/feature-implementation-doc-validator.mjs`                                                       | Markdown を検査し診断を作る                           | 検出ロジックや診断内容       |
| `scripts/validate-feature-implementation-docs.mjs`                                                       | validator を実文書へ適用する CLI                      | 対象文書の走査や CLI 実行    |
| `tests/fixtures/feature-implementation-docs/` と `scripts/test-feature-implementation-doc-validator.mjs` | 正常・異常例と期待結果による回帰テスト                | ルール変更の再現と期待結果   |
| `package.json`                                                                                           | ローカルで実行する npm script                         | コマンドの入口               |
| `.github/workflows/dep-quiz-test.yml`                                                                    | `dep-quiz-tests` の品質ゲート                         | CI 上の実行順序              |
| 本書                                                                                                     | 実行、診断、障害対応、追加変更、引継ぎ                | 日常運用の判断               |
| `docs/feature-implementation/*.md`                                                                       | 読者向け機能実装書                                    | 文書・画像・リンクの品質違反 |

`quality/` 配下の文書は、直接配下の `docs/feature-implementation/*.md` を対象にする validator の対象外である。

## 通常の文書変更フロー

機能実装書または画像を変更したら、次の順序で確認する。

```text
機能実装書・画像を変更
  ↓
npm run format:check
  ↓
npm run test:feature-doc-validator
  ↓
npm run validate:feature-docs
  ↓
FDOC-M001〜FDOC-M007 を人手レビュー
  ↓
Pull Request
  ↓
dep-quiz-tests で自動検証
```

```bash
npm run format:check
npm run test:feature-doc-validator
npm run validate:feature-docs
```

DEP クイズのデータや実装にも変更が及ぶ場合は、既存の DEP 検証も追加で実行する。

```bash
npm run validate:dep-questions
```

## GitHub Actions の読み方と失敗時対応

`dep-quiz-tests` では、次の品質ゲートがそれぞれ異なる責務を持つ。

| 失敗したステップ                                               | 主な意味                                       | 最初に確認する正本                       |
| -------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------- |
| `Quality Gate: Test feature implementation document validator` | validator、品質契約、fixture、期待結果の不整合 | 品質契約、validator、fixture、回帰テスト |
| `Quality Gate: Validate feature implementation documents`      | 機能実装書または参照資産の品質違反             | 対象文書、画像、ローカルリンク、品質契約 |
| `Quality Gate: Check code formatting`                          | Markdown または関連ファイルの整形不足          | 変更ファイルと Prettier の出力           |

失敗時は、CI ログの診断をローカルでも再現してから修正する。文書の違反か validator の不具合かを区別できるまで、文書内の個別抑制で回避しない。修正後は該当コマンドだけで終わらせず、回帰テストと実文書検証を再実行する。

## 診断の読み方

ERROR 診断は次の形式で出力される。

```text
[ERROR] 対象ファイル
Rule: Rule ID
Line: 行番号
Message: 問題内容
Target: 修正対象
```

初動は次の順序とする。

1. `Rule` から品質契約の検出条件・除外条件を確認する。
2. `Line` の箇所を確認する。`-` は特定行を持たない欠落・文書全体の違反を表す。
3. `Target` から欠落した画像、章、リンクなどの修正対象を確認する。`-` は特定の対象がないことを表す。
4. 文書・参照資産の問題か、validator の問題かを切り分ける。
5. 修正後に `npm run test:feature-doc-validator` と `npm run validate:feature-docs` を再実行する。

## 新しい機能実装書を追加する

1. `docs/feature-implementation/<document-name>.md` に配置する。
2. 直接配下の Markdown には共通ルール `FDOC-C001`〜`FDOC-C008` が適用されることを確認する。
3. H1、見出し階層、画像・リンク、未解決プレースホルダー、ローカル環境依存パスを確認する。
4. [人手レビュー](#人手レビューの運用)を実施する。
5. 固定の章構成が不要な文書は、共通ルールだけで運用する。

文書を `quality/` のようなサブディレクトリに置く場合は、対象範囲と除外理由を品質契約で明確にする。

## 文書固有ルールを追加・変更する

固定章構成など文書固有の品質が必要な場合は、文書固有 Rule ID の接頭辞を決め、同一 PR で次をそろえて変更する。

1. `docs/feature-implementation/quality/quality-contract.md`
2. validator
3. 正常 fixture
4. 異常 fixture
5. 回帰テストの期待結果
6. 本書の対象文書・運用情報

品質契約だけ、validator だけ、fixture だけを先行変更しない。ルールの追加・変更では、通過すべき正常ケースと検出すべき異常ケースを同時に用意する。

## 誤検知・検知漏れへの対応

誤検知を見つけた場合は、次の順で対応する。

```text
最小再現 fixture を追加
  ↓
検出条件・除外条件を確認
  ↓
共通ルールか文書固有ルールか判断
  ↓
品質契約・validator・fixture を同じ PR で修正
```

検知漏れを見つけた場合は、次の順で対応する。

```text
異常 fixture で再現
  ↓
期待する Rule ID を明示
  ↓
validator を修正
  ↓
既存正常 fixture が壊れないことを確認
```

`validator-disable` などの文書内個別抑制は導入しない。例外は品質契約の検出条件・除外条件、または文書固有ルールとして明示する。

## 人手レビューの運用

次のチェックリストを PR 本文などへコピーして利用する。MANUAL 項目は安易にキーワード検出へ置き換えず、必要に応じてコード、テスト、Issue、PR、図、本文を照合して判断する。

- [ ] FDOC-M001 現行実装との事実整合
- [ ] FDOC-M002 章間の因果関係
- [ ] FDOC-M003 図と本文の責務分担
- [ ] FDOC-M004 実装済みと将来候補の境界
- [ ] FDOC-M005 キーワードと強調表現
- [ ] FDOC-M006 正本ナビゲーション
- [ ] FDOC-M007 読者にとっての可読性

## 運用開始時ベースライン

初期適用対象である [Phase D 弱点分析の機能実装書](../phase-d-weakness-learning.md) に、共通ルール、文書固有ルール、人手レビューを適用した。自動検証は本書の追加後に実行し、結果を PR の検証結果にも記録する。人手レビューでは、機能実装書、`dep-quiz-app/` の現行実装とテスト、Issue・PR・コード・テストへの参照ナビゲーションを照合した。

| 観点                                          | 結果      | 確認先・備考                                                 |
| --------------------------------------------- | --------- | ------------------------------------------------------------ |
| 共通ルール `FDOC-C001`〜`FDOC-C008`           | PASS      | `npm run validate:feature-docs`                              |
| Phase D 固有ルール `FDOC-PD001`〜`FDOC-PD006` | PASS      | `npm run validate:feature-docs`                              |
| `FDOC-M001`〜`FDOC-M007`                      | PASS      | 文書、現行コード・テスト、参考情報の正本ナビゲーションを照合 |
| CI                                            | PR で確認 | `dep-quiz-tests`                                             |

今回の確認では、Phase D 文書を修正する具体的な自動検証違反または人手レビュー上の不備は見つからなかった。そのため、読者向け文書と画像は変更しない。

## DX-4 への引継ぎ

後続の章別詳細化では、特別な validator 実装を追加せず、通常の文書変更フローを利用する。

```text
章・図を更新
  ↓
ローカル品質検証
  ↓
人手レビュー M001〜M007
  ↓
PR 上の dep-quiz-tests
```

文書固有ルールが本当に必要になった場合だけ、[文書固有ルールを追加・変更する](#文書固有ルールを追加変更する)手順に従い、品質契約・validator・fixture・期待結果を一体で更新する。
