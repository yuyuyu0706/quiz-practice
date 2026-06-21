# 要点メモ: Compute servicesとワークロード選定

## 本チャプターのポイント

- Computeは大きさだけではなく、SQL分析、定期ETL、探索的開発などのワークロードから選びます。
- サーバレスをまず候補に置き、利用可能な機能、ネットワーク、ライブラリ、実行環境の制約を確認します。
- SQL・BIではSQL Warehouseを軸にし、同時利用、起動時間、SQL向け性能を重視します。
- 定期ETLではJob Computeを候補にし、再現性、実行分離、運用性、コストを重視します。
- 探索的開発ではAll-Purpose Computeを候補にし、対話性、反復速度、柔軟性を重視します。

## 試験での注意点

- 「大きいcomputeなら常に正解」と考えないようにします。まずワークロードを確認します。
- サーバレスは運用負担を減らす有力候補ですが、明示的な環境制御が必要な場合は非サーバレスも検討します。
- SQL Warehouse、Job Compute、All-Purpose Computeを名前だけで覚えず、利用者、実行タイミング、分離、コストの観点で区別します。
- Job Computeの詳細なDAG、トリガー、リトライ設計や、性能劣化の詳細診断は別領域で扱うため、ここでは選定軸に集中します。

## キーワード一覧

<a id="keyword-serverless-compute"></a>

### Serverless Compute

インフラの管理やスケールの多くをDatabricks側に任せ、起動性や運用負担の低減を狙えるcomputeの選択肢です。

<a id="keyword-sql-warehouse"></a>

### SQL Warehouse

Databricks SQLでクエリ、ダッシュボード、BI分析を実行するためのSQL向けcomputeです。

<a id="keyword-job-compute"></a>

### Job Compute

ジョブに紐づけて非対話型処理や定期ETLを実行するcomputeです。再現性やワークロード分離を考えるときの候補になります。

<a id="keyword-all-purpose-compute"></a>

### All-Purpose Compute

ノートブックでの探索、共同開発、対話的な試行錯誤に向く汎用computeです。

<a id="keyword-workload-isolation"></a>

### ワークロード分離

SQL分析、ETL、探索などを同じcomputeへ無条件に載せず、影響範囲や責務に応じて実行基盤を分ける考え方です。

<a id="keyword-concurrency"></a>

### 同時実行

複数ユーザーや複数クエリが同じ時間帯に実行される状況です。SQL分析やBIでは利用者体験に直結します。

<a id="keyword-auto-stop"></a>

### 自動停止

使っていないcomputeを停止し、不要な課金を抑えるための設定や考え方です。

<a id="keyword-startup-time"></a>

### 起動時間

停止中または未起動のcomputeが利用可能になるまでの時間です。対話的なSQL分析では短いほど利用者の待ち時間を減らせます。

<a id="keyword-execution-isolation"></a>

### 実行分離

ある処理の失敗、負荷、ライブラリ変更などが別の処理へ波及しにくいように実行環境を分ける考え方です。

<a id="keyword-cost-model"></a>

### コストモデル

用途、起動時間、稼働時間、スケール、共有範囲によってコストの出方が変わることを前提にcomputeを選ぶ考え方です。

## 参考リンク

- [コンピューティングの選択に関する推奨事項 - Azure Databricks](https://learn.microsoft.com/ja-jp/azure/databricks/compute/choose-compute)
- [SQL ウェアハウスに接続する - Azure Databricks](https://learn.microsoft.com/ja-jp/azure/databricks/compute/sql-warehouse/)
- [SQL ウェアハウスの種類 - Azure Databricks](https://learn.microsoft.com/ja-jp/azure/databricks/compute/sql-warehouse/warehouse-types)
- [ジョブのコンピューティングを構成する - Azure Databricks](https://learn.microsoft.com/ja-jp/azure/databricks/jobs/compute)
- [コスト最適化のためのベスト プラクティス - Azure Databricks](https://learn.microsoft.com/ja-jp/azure/databricks/lakehouse-architecture/cost-optimization/best-practices)
