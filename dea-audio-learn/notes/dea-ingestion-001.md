# 要点メモ: Data Ingestion and Loadingの全体像

## 本チャプターのポイント

- Data Ingestion and Loadingは、Databricks上のデータエンジニアリングを安定して進めるための入口となる領域です。
- 要件に応じて機能や設計を選び、後続工程が信頼できる状態を作ることが重要です。
- 丸暗記ではなく、データ量、頻度、品質、権限、運用性といった判断軸で整理します。

## 試験での注意点

- 手動作業だけに依存する選択肢や、品質・権限・運用監視を無視する選択肢は避けます。
- 似た用語は、何を管理する機能か、どの工程で使うかで区別します。
- Databricksの統合基盤として、取り込みからガバナンスまでのつながりを意識します。

## キーワード一覧

- [batch / streaming / incremental loading](https://learn.microsoft.com/ja-jp/azure/databricks/ingestion/overview)
- [COPY INTO](https://learn.microsoft.com/ja-jp/azure/databricks/sql/language-manual/delta-copy-into)
- [Auto Loader](https://learn.microsoft.com/ja-jp/azure/databricks/ingestion/cloud-object-storage/auto-loader/)
- [schema enforcement / schema evolution](https://learn.microsoft.com/ja-jp/azure/databricks/ingestion/cloud-object-storage/auto-loader/schema)
- [Lakeflow Connect](https://learn.microsoft.com/ja-jp/azure/databricks/ingestion/overview)
- [JDBC / ODBC / REST clients](https://learn.microsoft.com/ja-jp/azure/databricks/connect/)
- [Unity Catalog governed tables](https://learn.microsoft.com/ja-jp/azure/databricks/data-governance/unity-catalog/)
- [semi-structured / unstructured data](https://learn.microsoft.com/ja-jp/azure/databricks/ingestion/cloud-object-storage/auto-loader/schema)

## 参考リンク

- [Auto Loader を使用したファイルの取り込み](https://learn.microsoft.com/ja-jp/azure/databricks/ingestion/cloud-object-storage/auto-loader/)
- [COPY INTO を使用したデータの読み込み](https://learn.microsoft.com/ja-jp/azure/databricks/sql/language-manual/delta-copy-into)
- [Auto Loader のスキーマ推論とスキーマ進化](https://learn.microsoft.com/ja-jp/azure/databricks/ingestion/cloud-object-storage/auto-loader/schema)
- [Lakeflow Connect の概要](https://learn.microsoft.com/ja-jp/azure/databricks/ingestion/overview)
- [Unity Catalog とは](https://learn.microsoft.com/ja-jp/azure/databricks/data-governance/unity-catalog/)
