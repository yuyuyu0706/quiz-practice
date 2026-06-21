# 要点メモ: Working with Lakeflow Jobsの全体像

## 本チャプターのポイント

- Lakeflow Jobsは、NotebookやSQLなどの個別処理を、依存関係と運用ルールを持つワークフローとして実行する仕組みです。
- 重要なのは、処理が一度動くことではなく、決まった条件で継続的に、安全に、再現可能に動かせることです。
- タスク分割、DAG、依存関係、再試行、トリガー、実行履歴を組み合わせて運用設計を考えます。

## 試験での注意点

- 1つの巨大Notebookにすべてを詰め込む選択肢より、責務ごとにタスクを分ける設計を重視します。
- スケジュールだけでなく、file arrivalやtable updateのようにデータの準備状況を起点にする考え方を押さえます。
- 失敗時は全体を手動でやり直すのではなく、失敗タスク、retry、run history、DAGを使って復旧する発想を持ちます。

## キーワード一覧

- <a id="keyword-lakeflow-jobs"></a>**Lakeflow Jobs**
  個別の処理を依存関係と運用ルールを持つワークフローとして実行する仕組み。

- <a id="keyword-task"></a>**task**
  Notebook、SQL、Pipeline、Dashboardなど、ジョブ内で独立して実行する責務単位。

- <a id="keyword-dag"></a>**DAG**
  タスク間の依存関係と実行順序を表す有向非巡回グラフ。

- <a id="keyword-task-dependency"></a>**task dependency**
  上流タスクの完了を条件に、下流タスクを実行する依存関係。

- <a id="keyword-retry"></a>**retry**
  一時的な失敗に対して、同じタスクを再試行する復旧設定。

- <a id="keyword-trigger"></a>**trigger**
  ジョブを開始する契機。時間、ファイル到着、テーブル更新などを指定できる。

- <a id="keyword-schedule"></a>**schedule**
  毎時、毎日など、時間に基づいてジョブを起動する設定。

- <a id="keyword-file-arrival"></a>**file arrival**
  クラウドストレージなどにファイルが到着したことを起点にするトリガー。

- <a id="keyword-table-update"></a>**table update**
  前提テーブルの更新を起点に下流処理を開始するトリガー。

- <a id="keyword-branching"></a>**branching**
  条件に応じて、実行するタスクや後続処理を切り替える考え方。

- <a id="keyword-looping"></a>**looping**
  複数の対象やパラメータに対して、同じ処理を繰り返す考え方。

## 参考リンク

- [Azure Databricks ワークフローの概要](https://learn.microsoft.com/ja-jp/azure/databricks/workflows/)
- [ジョブの実行を表示および管理する](https://learn.microsoft.com/ja-jp/azure/databricks/workflows/jobs/monitor-job-runs)
- [ジョブの作成と管理を自動化する](https://learn.microsoft.com/ja-jp/azure/databricks/jobs/automate)
- [ジョブのパラメーター化](https://learn.microsoft.com/ja-jp/azure/databricks/jobs/parameters)
- [Lakeflow ジョブの ID、アクセス許可、および特権を管理する](https://learn.microsoft.com/ja-jp/azure/databricks/jobs/privileges)
