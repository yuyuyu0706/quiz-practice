# 要点メモ: Troubleshooting, Monitoring, and Optimizationの全体像

## 本チャプターのポイント

- 監視は、ジョブの成功・失敗だけでなく、実行時間、再試行、コスト、下流更新の遅延を早く見つけるために行います。
- 障害や性能劣化は、run history、DAG、Spark UIを使って段階的に切り分けます。
- 最適化は設定変更で終わりではなく、変更前後を再計測して効果を確認するまでが一連の流れです。

## 試験での注意点

- ジョブ全体を眺めるだけでなく、遅いタスク、遅いステージ、shuffle、spill、skewのように観測対象を絞ります。
- 推測で設定を変えるのではなく、Spark UIやrun historyで確認した症状に基づいて改善策を選びます。
- 性能改善はコードだけでなく、データ分布、クラスタ、テーブルレイアウト、ジョブ依存関係も含めて考えます。

## キーワード一覧

- <a id="keyword-lakeflow-jobs-run-history"></a>**Lakeflow Jobs run history**
  ジョブの実行結果、所要時間、失敗、再試行、タスクごとの状態を確認する履歴。

- <a id="keyword-dag"></a>**DAG**
  タスク間の依存関係と実行順序を表し、どこで遅延や失敗が起きたかを見るための図。

- <a id="keyword-spark-ui"></a>**Spark UI**
  Sparkジョブのステージ、タスク、shuffle、spill、入力サイズなどを確認するための画面。

- <a id="keyword-data-skew"></a>**data skew**
  特定のキーやパーティションにデータが偏り、一部タスクだけ極端に遅くなる状態。

- <a id="keyword-shuffle"></a>**shuffle**
  joinや集計などで、データがノード間を移動する処理。

- <a id="keyword-disk-spilling"></a>**disk spilling**
  メモリに収まらない中間データがディスクへ退避され、処理が遅くなる状態。

- <a id="keyword-oom"></a>**OOM**
  メモリ不足によりタスクやExecutorが失敗する状態。

- <a id="keyword-aqe"></a>**AQE**
  実行時の統計に基づき、joinやshuffleなどの実行計画を調整するAdaptive Query Execution。

- <a id="keyword-liquid-clustering"></a>**Liquid Clustering**
  テーブルのデータ配置をクラスタリングキーに基づいて最適化し、クエリ性能を支える仕組み。

- <a id="keyword-predictive-optimization"></a>**predictive optimization**
  Unity Catalog管理テーブルの保守や最適化を自動化し、性能とコスト効率を支える仕組み。

## 参考リンク

- [Lakeflow ジョブの監視と可観測性](https://learn.microsoft.com/ja-jp/azure/databricks/jobs/monitor)
- [スキューとスピル](https://learn.microsoft.com/ja-jp/azure/databricks/optimizations/spark-ui-guide/long-spark-stage-page)
- [Spark 構成プロパティを設定する](https://learn.microsoft.com/ja-jp/azure/databricks/spark/conf)
- [テーブルに液体クラスタリングを使用する](https://learn.microsoft.com/ja-jp/azure/databricks/delta/clustering)
- [Unity Catalog 管理テーブルの予測最適化](https://learn.microsoft.com/ja-jp/azure/databricks/optimizations/predictive-optimization)
