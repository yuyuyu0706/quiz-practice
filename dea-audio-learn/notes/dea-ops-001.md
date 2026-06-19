# 要点メモ: Troubleshooting, Monitoring, and Optimizationの全体像

## 本チャプターのポイント

- Troubleshooting, Monitoring, and Optimizationは、Databricks上のデータエンジニアリングを安定して進めるための入口となる領域です。
- 要件に応じて機能や設計を選び、後続工程が信頼できる状態を作ることが重要です。
- 丸暗記ではなく、データ量、頻度、品質、権限、運用性といった判断軸で整理します。

## 試験での注意点

- 手動作業だけに依存する選択肢や、品質・権限・運用監視を無視する選択肢は避けます。
- 似た用語は、何を管理する機能か、どの工程で使うかで区別します。
- Databricksの統合基盤として、取り込みからガバナンスまでのつながりを意識します。

## キーワード一覧

- Lakeflow Jobs run history
- job performance trends
- DAG-based task graph
- Spark UI
- data skew / shuffle / disk spilling
- Liquid Clustering
- predictive optimization
- cluster startup failures
- library conflicts
- out-of-memory issues

## 参考リンク

- [Databricks documentation](https://docs.databricks.com/)
