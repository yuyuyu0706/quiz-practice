# 要点メモ: Implementing CI/CDの全体像

## 本チャプターのポイント

- Implementing CI/CDは、Databricks上のデータエンジニアリングを安定して進めるための入口となる領域です。
- 要件に応じて機能や設計を選び、後続工程が信頼できる状態を作ることが重要です。
- 丸暗記ではなく、データ量、頻度、品質、権限、運用性といった判断軸で整理します。

## 試験での注意点

- 手動作業だけに依存する選択肢や、品質・権限・運用監視を無視する選択肢は避けます。
- 似た用語は、何を管理する機能か、どの工程で使うかで区別します。
- Databricksの統合基盤として、取り込みからガバナンスまでのつながりを意識します。

## キーワード一覧

- Databricks Git Folders
- branch切替、commit、push、pull request
- Automation Bundle / Declarative Automation Bundles
- environment-specific configuration
- dev / test / prod promotion
- Databricks CLI
- automated CI/CD workflows

## 参考リンク

- [Databricks documentation](https://docs.databricks.com/)
