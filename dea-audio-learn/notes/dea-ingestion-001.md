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

- <a id="keyword-batch-loading"></a>**batch loading**：一定期間分のデータをまとめて取り込む方式。
- <a id="keyword-streaming"></a>**streaming**：到着するデータを継続的に処理する方式。
- <a id="keyword-incremental-loading"></a>**incremental loading**：前回処理後に追加・更新された分だけを取り込む方式。
- <a id="keyword-copy-into"></a>**COPY INTO**：ファイルをDeltaテーブルへ繰り返し取り込むためのSQLベースの仕組み。
- <a id="keyword-auto-loader"></a>**Auto Loader**：クラウドストレージ上に継続到着するファイルを増分検出して取り込む仕組み。
- <a id="keyword-schema-enforcement"></a>**schema enforcement**：想定外のデータ構造を検知し、品質を守る考え方。
- <a id="keyword-schema-evolution"></a>**schema evolution**：スキーマの変更を必要に応じて取り込めるようにする考え方。
- <a id="keyword-lakeflow-connect"></a>**Lakeflow Connect**：SaaSやデータベースなどの外部システムから、管理された形でデータを取り込むための仕組み。
- <a id="keyword-unity-catalog"></a>**Unity Catalog**：データ資産、権限、監査を統一的に管理する仕組み。
- <a id="keyword-bronze"></a>**Bronze**：生データをできるだけ保持し、監査や再処理の起点とする層。
- <a id="keyword-checkpoint-location"></a>**checkpointLocation**：ストリーミング処理で、どこまで処理済みかを記録する場所。
- <a id="keyword-schema-location"></a>**schemaLocation**：Auto Loaderが検出したスキーマ情報を保存する場所。

## 参考リンク

- [Auto Loader を使用したファイルの取り込み](https://learn.microsoft.com/ja-jp/azure/databricks/ingestion/cloud-object-storage/auto-loader/)
- [COPY INTO を使用したデータの読み込み](https://learn.microsoft.com/ja-jp/azure/databricks/sql/language-manual/delta-copy-into)
- [Auto Loader のスキーマ推論とスキーマ進化](https://learn.microsoft.com/ja-jp/azure/databricks/ingestion/cloud-object-storage/auto-loader/schema)
- [Lakeflow Connect の概要](https://learn.microsoft.com/ja-jp/azure/databricks/ingestion/overview)
- [Unity Catalog とは](https://learn.microsoft.com/ja-jp/azure/databricks/data-governance/unity-catalog/)
