# 要点メモ: Data Transformation and Modelingの全体像

## 本チャプターのポイント

- Data Transformation and Modelingは、取り込んだSoR寄りのデータを、分析・BI・AIで再利用しやすいSoIへ整える工程です。
- メダリオンアーキテクチャでは、Bronze / Silver / Goldを単なる処理順ではなく、責務と品質水準の分離として考えます。
- 変換処理では、品質、粒度、意味、再利用性、利用者に渡すデータ契約を同時に設計します。

## 試験での注意点

- PySparkやSQLの文法だけではなく、どの層で何を整えるべきかを判断します。
- Bronzeをすぐに上書きして完成形にする選択肢より、証跡と再処理の起点を残す設計を重視します。
- Goldは単なる最終集計ではなく、利用者に提供する意味・粒度・品質の契約として捉えます。

## キーワード一覧

- <a id="keyword-sor"></a>**SoR**
  System of Record。元システムの業務処理のために作られた記録データ。

- <a id="keyword-soi"></a>**SoI**
  System of Insight。分析、BI、AI、業務改善で再利用しやすい形に整えた情報。

- <a id="keyword-medallion-architecture"></a>**メダリオンアーキテクチャ**
  Bronze / Silver / Goldの層で、データの責務と品質水準を段階的に分ける設計パターン。

- <a id="keyword-bronze"></a>**Bronze**
  生データをできるだけ保持し、証跡や再処理の起点にする層。

- <a id="keyword-silver"></a>**Silver**
  型、欠損、重複、コード、結合キーなどを整え、再利用しやすくする層。

- <a id="keyword-gold"></a>**Gold**
  BI、分析、AI、業務利用に渡すための意味と粒度を持つ提供層。

- <a id="keyword-pyspark"></a>**PySpark**
  PythonからApache Sparkを操作し、大規模データの変換を記述するためのAPI。

- <a id="keyword-sql"></a>**SQL**
  テーブル形式のデータを抽出、結合、集計、更新するための問い合わせ言語。

- <a id="keyword-join"></a>**join**
  キーをもとに複数のデータを結合し、横断的に使える形へつなぐ処理。

- <a id="keyword-deduplication"></a>**deduplication**
  同じ事実を二重に数えないよう、重複レコードを取り除く品質設計。

- <a id="keyword-aggregation"></a>**aggregation**
  利用者が見る粒度に合わせて、明細データを集計する処理。

- <a id="keyword-materialized-view"></a>**materialized view**
  クエリ結果を保持し、分析や集計を効率よく提供するためのビュー。

- <a id="keyword-streaming-table"></a>**streaming table**
  継続的に到着するデータを取り込み、更新されるテーブル。

## 参考リンク

- [メダリオン レイクハウス アーキテクチャとは](https://learn.microsoft.com/ja-jp/azure/databricks/lakehouse/medallion)
- [Azure Databricks の Delta Lake とは](https://learn.microsoft.com/ja-jp/azure/databricks/delta/)
- [Azure Databricks における PySpark](https://learn.microsoft.com/ja-jp/azure/databricks/pyspark/)
- [PySpark の基本](https://learn.microsoft.com/ja-jp/azure/databricks/pyspark/basics)
- [マテリアライズド ビューの増分更新](https://learn.microsoft.com/ja-jp/azure/databricks/optimizations/incremental-refresh)
