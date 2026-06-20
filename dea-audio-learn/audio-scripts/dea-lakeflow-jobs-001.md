# 音声スクリプト: Working with Lakeflow Jobsの全体像

## はじめに

NotebookやSQLで処理が一度成功しただけでは、データ基盤は運用できません。毎日決まった時刻に動くのか、ファイルが到着したら動くのか、途中で失敗したらどこからやり直すのか。本番のデータ処理では、コードの中身と同じくらい、処理をどう回し続けるかが重要です。

Lakeflow Jobsは、Notebook、SQL、パイプライン、ダッシュボードといった個別の処理を、依存関係と運用ルールを持つ一つのワークフローとして組み立てるための仕組みです。人が毎朝ボタンを押す運用から、条件に応じて自律的に動く運用へ進むための基盤として捉えます。

## 本チャプターのゴール

ゴールは、Lakeflow Jobsを「Databricks上で処理を実行する機能」ではなく、「処理の実行計画と運用ルールを定義する仕組み」として説明できるようになることです。

特に、task dependencies、DAG-based task graph、notebook / SQL query / dashboard / pipeline tasks、retries、branching、looping、schedules、file arrival triggers、table update triggersを、どの運用課題を解くための要素なのかで整理します。

## 背景

### 単発実行の成功は、運用の成功ではない

Chapter 3で取り込んだデータはBronzeへ入り、Chapter 4でSilver / Goldへ変換されます。この流れには順序依存があります。Bronzeの取り込みが失敗しているのにSilver変換だけが動くと、不完全なデータや古いデータをもとに下流のテーブルが作られる可能性があります。

Notebookを手動で順番に実行すれば、一度は成功するかもしれません。しかし本番運用では、毎日、毎時、あるいはデータ到着のたびに同じ品質で処理を回す必要があります。手動実行中心の運用は、属人化、実行漏れ、障害復旧の遅延につながります。

### データパイプラインには、順番・失敗・到着待ちを扱う仕組みが必要

データパイプラインでは、上流が成功してから下流を実行する、失敗したタスクだけ再実行する、外部システムの一時的な失敗ならretryする、ファイル到着やテーブル更新を待ってから起動する、といった運用ルールが必要です。

起動条件も一つではありません。毎日決まった時刻に動かす処理もあれば、ファイルが到着したら動かす処理、前提テーブルが更新されたら動かす処理もあります。Lakeflow Jobsが試験の独立セクションとして扱われるのは、こうした運用ルールを設計できることが、信頼できるデータ基盤に直結するからです。

## 重要な考え方

### ジョブは、処理を順番に実行するだけの機能ではない

Lakeflow Jobsは、複数の処理をただ並べるだけの機能ではありません。どの処理をどの単位でタスクにするか、どの順序で実行するか、失敗時にどう復旧するか、何を契機に開始するかを定義する運用の設計図です。

| 判断観点   | 考えること                         | 代表的な選択肢                          |
| ---------- | ---------------------------------- | --------------------------------------- |
| タスク分割 | 何を独立した責務として分けるか     | Notebook / SQL / Pipeline / Dashboard   |
| 実行順序   | どの処理が先に終わる必要があるか   | DAG-based task graph                    |
| 障害対応   | 失敗時にどう復旧するか             | retries / failed task rerun             |
| 分岐       | 状況により処理を変える必要があるか | conditional tasks / branching           |
| 繰り返し   | 同じ処理を複数対象に実行するか     | looping                                 |
| 起動条件   | 何を契機に動かすか                 | scheduled / file arrival / table update |

### DAGで依存関係を明示する

DAG、つまり有向非巡回グラフは、タスク間の依存関係を表します。たとえば、Ingestion Taskが成功してからSilver Transformation Taskを実行し、その後にGold Aggregation TaskやDashboard Refresh Taskを実行する、といった順序を明示できます。

DAGがあると、処理順序が可視化され、障害時にどこで止まったのか、どの下流タスクに影響するのかを判断しやすくなります。task dependencyは、データの前提条件をワークフロー上に表現するための重要な考え方です。

### タスクは責務単位で分ける

1つの巨大Notebookに取り込み、変換、集計、通知まで詰め込むと、失敗箇所の特定や部分再実行が難しくなります。Jobsの設計では、責務ごとにタスクを分けることが重要です。

Notebook taskはPythonやSQLを含む処理の実行、SQL taskはクエリやダッシュボード更新、pipeline taskは宣言的なパイプライン処理、dashboard taskは利用者向け成果物の更新など、役割に応じて選びます。タスクを分けることで、履歴、失敗、再実行、所有範囲を管理しやすくなります。

### 再試行・条件分岐・ループで運用上の例外を扱う

retryは、単なる失敗回避ではありません。外部サービスの一時的な応答遅延、クラスタ起動の揺らぎ、一時的なリソース不足のように、再実行すれば成功する可能性がある問題への耐性を持たせるための設計です。

conditional tasksやbranchingは、データ件数がゼロの場合は後続処理をスキップする、検証結果に応じて通知を出す、といった判断に使います。loopingは、複数の対象テーブルやパラメータに対して同じ処理を繰り返したい場合に考えます。

### トリガーは時間ではなく、データの準備状況から選ぶ

triggerは「毎日9時」のような時間基準だけで選ぶものではありません。データが届いたか、前提テーブルが更新されたか、利用者が必要とするタイミングはいつか、という観点で選びます。

scheduled triggerは定期実行に向きます。file arrival triggerは、クラウドストレージなどにファイルが到着したことを契機にできます。table update triggerは、前提となるテーブル更新に合わせて下流を動かしたい場合に考えます。

## 具体的なイメージ

### 典型的なデータパイプラインをJobsで運用する

```mermaid
flowchart LR
  A[Cloud Storage / Source] --> B[Ingestion Task]
  B --> C[Bronze Table]
  C --> D[Silver Transformation Task]
  D --> E[Gold Aggregation Task]
  E --> F[Dashboard Refresh Task]

  B -->|failure| R[Retry / Alert]
  D -->|failure| R
  E -->|failure| R
```

この図では、Ingestion、Transformation、Aggregation、Dashboard Refreshを別タスクとして分けています。上流が成功してから下流を実行するため、不完全な状態でGoldやダッシュボードが更新されるリスクを下げられます。

### ジョブ定義のイメージ

```yaml
resources:
  jobs:
    daily_sales_pipeline:
      name: daily-sales-pipeline
      tasks:
        - task_key: ingest_orders
          notebook_task:
            notebook_path: ../src/ingest_orders.py

        - task_key: transform_orders
          depends_on:
            - task_key: ingest_orders
          notebook_task:
            notebook_path: ../src/transform_orders.py

        - task_key: build_sales_summary
          depends_on:
            - task_key: transform_orders
          sql_task:
            query:
              query_id: <query-id>
```

この例は概念理解用です。重要なのは、処理コードそのものではなく、タスク分割、depends_onによるtask dependency、上流成功後に下流を実行する設計が見えることです。

Lakeflow Jobsでは、実行履歴とDAGを見ることで、どのタスクで詰まったのかを確認できます。失敗したタスクを追跡し、必要に応じてretryやfailed task rerunを行えるため、全体を手動でやり直す運用よりも安全で再現性があります。Jobsはデータ処理コードの代替ではなく、コードを運用可能なワークフローへ包む役割を持ちます。

## 次の学習へのつながり

Data Transformation and Modelingで設計したSilver / Gold生成処理は、Lakeflow Jobsによって定期実行やイベント駆動のワークフローとして運用されます。これにより、変換済みデータを継続的に、安全に、再現可能に作り続けられます。

次に、Implementing CI/CDでは、Jobsの定義やNotebook、SQL、パイプラインコードを、dev、test、prodの各環境へ安全に配布する方法を学びます。手作業で本番へ反映するのではなく、レビュー、テスト、自動デプロイを通じて変更を管理します。

さらに、Troubleshooting, Monitoring, and Optimizationでは、実行履歴、DAG、Spark UI、ログ、パフォーマンストレンドを使って、失敗原因や遅延のボトルネックを確認します。Lakeflow Jobsは、変換処理を運用に乗せ、CI/CDと監視最適化へつなげる中心的な橋渡しです。
