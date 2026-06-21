# 要点メモ: Implementing CI/CDの全体像

## 本チャプターのポイント

- CI/CDは、Databricks上のノートブック、SQL、ジョブ、パイプライン定義を安全に変更するための仕組みです。
- dev / stg / prodでは、対象データ、権限、カタログ、ジョブ設定、外部接続先が異なるため、環境差分を管理する必要があります。
- 手動反映ではなく、Git、レビュー、検証、deployment、promotionを通じて再現可能に変更を届けることが重要です。

## 試験での注意点

- CI/CDを単なるアプリケーションコードのデプロイとして扱う選択肢には注意します。
- 環境ごとの設定差分をコード本体に埋め込むのではなく、設定や変数として管理する考え方を押さえます。
- 本番データへ影響する変更は、テスト、レビュー、段階的なpromotionを通じて安全に反映します。

## キーワード一覧

- <a id="keyword-ci"></a>**CI**
  変更内容をテストや検証にかけ、本番へ進めてよいかを確認する継続的インテグレーション。

- <a id="keyword-cd"></a>**CD**
  検証済みの定義を環境へ安全に反映する継続的デリバリーまたはデプロイ。

- <a id="keyword-git"></a>**Git**
  ノートブック、SQL、ジョブ定義などの変更履歴を管理するバージョン管理の仕組み。

- <a id="keyword-branch"></a>**branch**
  本番へ影響させずに変更を分離して開発・検証するための作業単位。

- <a id="keyword-pull-request"></a>**pull request**
  変更内容をレビューし、マージ前に品質や影響を確認するための仕組み。

- <a id="keyword-dev"></a>**dev**
  開発者が変更を試す環境。

- <a id="keyword-stg"></a>**stg**
  本番に近い条件で動作確認するステージング環境。

- <a id="keyword-prod"></a>**prod**
  業務・分析利用者に実際のデータを提供する本番環境。

- <a id="keyword-environment"></a>**environment**
  dev、stg、prodなど、データ・権限・設定が分かれた実行環境。

- <a id="keyword-declarative-automation-bundles"></a>**Declarative Automation Bundles**
  旧称Databricks Asset Bundles。ジョブやパイプラインなどのDatabricks資源をコードとして定義し、環境へ配布する仕組み。

- <a id="keyword-bundle-validate"></a>**bundle validate**
  Bundlesの定義や設定が妥当かをデプロイ前に確認する検証操作。

- <a id="keyword-deployment"></a>**deployment**
  検証済みの定義を特定の環境へ反映すること。

- <a id="keyword-promotion"></a>**promotion**
  devからstg、prodへ段階的に同じ定義を進めること。

## 参考リンク

- [宣言型オートメーション バンドルとは](https://learn.microsoft.com/ja-jp/azure/databricks/dev-tools/bundles/)
- [Azure Databricks の CI/CD](https://learn.microsoft.com/ja-jp/azure/databricks/dev-tools/ci-cd/)
- [Databricks Git フォルダーを使用した CI/CD](https://learn.microsoft.com/ja-jp/azure/databricks/repos/ci-cd)
- [宣言型オートメーション バンドルの構成](https://learn.microsoft.com/ja-jp/azure/databricks/dev-tools/bundles/settings)
- [ジョブの作成と管理を自動化する](https://learn.microsoft.com/ja-jp/azure/databricks/jobs/automate)
