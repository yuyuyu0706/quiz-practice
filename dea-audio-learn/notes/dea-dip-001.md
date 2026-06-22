# 要点メモ: Databricks Intelligence Platformの全体像

## 本チャプターのポイント

- Databricks Intelligence Platformは、データの取り込み、変換、分析、AI活用を共通基盤でつなぐ統合プラットフォームとして押さえます。
- 個別機能の暗記だけでなく、分断されたデータ基盤の課題をどの機能が補うのかを対応づけます。
- Lakehouseは柔軟な保存と管理された分析を近づける考え方、Delta Lakeは信頼できるテーブル管理、Unity Catalogは共通の資産管理基盤、Workflowsはジョブ実行管理に関係します。Unity Catalogの詳細な資産整理・統制はChapter 4で扱います。
- Databricks SQLは、共通基盤上のデータをSQLで分析するための入口として整理します。

## 試験での注意点

- Databricksを単なるSQLツール、ETLツール、ノートブック環境のどれか一つとして限定しないようにします。
- Delta Lake、Unity Catalog、Workflows、Databricks SQLを横並びに暗記するだけでなく、どの課題に対応する機能かを確認します。
- 「統合」とは、すべての作業を一つの画面に詰め込むことではなく、データ、権限、実行、分析を共通の文脈で扱いやすくすることです。

## キーワード一覧

<a id="keyword-lakehouse"></a>

### Lakehouse

データレイクの柔軟性とデータウェアハウスの管理性を組み合わせるアーキテクチャの考え方です。

<a id="keyword-delta-lake"></a>

### Delta Lake

ACIDトランザクション、スキーマ管理、履歴管理などにより、データを信頼できるテーブルとして扱いやすくする技術です。

<a id="keyword-unity-catalog"></a>

### Unity Catalog

データ、AI資産、権限、監査などを一元的に管理するためのガバナンス機能です。

<a id="keyword-workflows"></a>

### Workflows

データパイプラインやジョブの実行順序、スケジュール、依存関係を管理する機能です。

## 参考リンク

- [Azure Databricks とは](https://learn.microsoft.com/ja-jp/azure/databricks/introduction/)
- [Data Lakehouse とは](https://learn.microsoft.com/ja-jp/azure/databricks/lakehouse/)
- [レイクハウス プラットフォームのスコープ](https://learn.microsoft.com/ja-jp/azure/databricks/lakehouse-architecture/scope)
