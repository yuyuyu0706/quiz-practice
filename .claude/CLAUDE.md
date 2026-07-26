# quiz-practice 開発ルール（Claude Code 向け）

このファイルは、Claude Code がこのリポジトリで作業する際に毎セッション読み込む項目です。
本ファイルが肥大化して200行を超えたら、分割を検討します。
特に Lv3/Lv4 Issue に基づくドキュメント開発（`docs/feature-implementation/` 配下）を
Claude Code に依頼する際の再発防止ルールをまとめています。

## ブランチ作成前に必ず最新 main を取り込む

クラウドセッションの環境はファイルシステムのスナップショットを再利用するため、
「新規セッション」であっても内部のリポジトリ状態が古い main を指している場合があります。
作業ブランチを作成する前に、必ず以下を実行してください。

```bash
git fetch origin
git checkout main
git pull origin main
git checkout -b <ブランチ名>
```

これを省略すると、他の Lv4 Issue が先にマージした変更を取り込まないまま作業ブランチを
作成してしまう場合があります。マージ自体は3-way mergeで通常安全に解決されますが、
セッション内で行う `npm run validate:feature-docs` などのローカル検証が、
最新化されていない古い内容に対して行われることになり、確認の精度が下がります。

## PR 作成時のルール

### Issue を自動クローズするキーワードを使わない

PR 本文で `Close #`、`Closes #`、`Fixes #`、`Fix #`、`Resolves #`、`Resolve #` を
使用しないでください。Issue との関連付けは「Issue #NNN の実装」のような
非クローズ表記に統一してください。

Lv4 Issue のクローズは、対応する PR がマージされた後、親 Lv3 Issue の
「残アクティビティ」から「実装履歴」への反映が確認できてから、人手で行います。
自動クローズはこの確認ステップの実施漏れにつながるため使用しません。

### 手動レビュー観点（FDOC-M001〜FDOC-M007）を PR 本文に記載する

`docs/feature-implementation/` 配下の機能実装書を変更する PR では、
`docs/feature-implementation/quality/quality-contract.md` に定義された
FDOC-M001〜FDOC-M007 の人手レビュー結果を、PR 本文の末尾に次の形式で記載してください。

```markdown
## 手動レビュー観点（FDOC-M001〜FDOC-M007）

### FDOC-M001（現行実装との事実整合）

**結果：** 追記した記述を実際にコード・テストと照合した内容を記載する。
チェック印だけの形式的な記載にしない。

### FDOC-M002（章間の因果関係）
...

（以下 M003〜M007 も同様の形式で記載する）
```

各項目は「照合した」という事実だけでなく、具体的にどの記述をどのコード・テストと
突き合わせたかを書いてください。

## docs/feature-implementation/ を変更する際の共通ルール

- 対象は `docs/templates/lv4_issue.md` に基づいて起票された Lv4 Issue の
  実装方針・対象範囲・非対象に従うこと。
- 担当章以外の本文、H1・H2 見出し、目次構成、validator・fixture・npm script・
  GitHub Actions は変更しないこと。
- 変更前に以下を実行し、すべて成功することを確認してからコミットすること。

```bash
npm run format:check
npm run test:feature-doc-validator
npm run validate:feature-docs
```

- 品質ルールの詳細は `docs/feature-implementation/quality/quality-contract.md`、
  運用手順は `docs/feature-implementation/quality/operation-guide.md` を正本とする。
- 対象文書は `docs/feature-implementation/` 配下にあり、リポジトリルートへの相対パスは
  `../../` から始める。

## 参考

- Issue テンプレート
  - Lv1：`docs/templates/lv1_issue.md`
  - Lv2：`docs/templates/lv2_issue.md`
  - Lv3：`docs/templates/lv3_issue.md`
  - Lv4：`docs/templates/lv4_issue.md`
- 品質契約：`docs/feature-implementation/quality/quality-contract.md`
- 品質運用ガイド：`docs/feature-implementation/quality/operation-guide.md`

