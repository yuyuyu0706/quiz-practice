# 要点メモ: Governance and Securityの全体像

## 本チャプターのポイント

- Governance and Securityは、データを閉じるためではなく、必要な人が必要な範囲で安全に使えるようにするための領域です。
- Unity Catalogを中心に、データ資産、権限、監査、行・列レベルの制御を一元的に考えます。
- 最小権限、役割単位の権限設計、managed / external tableの管理責任、ABACによるスケールを整理します。

## 試験での注意点

- 個人へ直接権限を付けるより、groupやservice principalを使った役割単位の設計を優先します。
- managed tableとexternal tableは、保存場所だけでなく管理責任の違いとして理解します。
- row-level securityやcolumn maskingは、テーブルを複製せずに利用者ごとの見え方を変える仕組みとして押さえます。

## キーワード一覧

- <a id="keyword-unity-catalog"></a>**Unity Catalog**
  データ資産、権限、監査、リネージを統一的に管理するDatabricksのガバナンス基盤。

- <a id="keyword-managed-table"></a>**managed table**
  Databricksがデータとメタデータを一体で管理しやすいテーブル。

- <a id="keyword-external-table"></a>**external table**
  既存ストレージや外部管理のデータを、Unity Catalog上のテーブルとして扱う仕組み。

- <a id="keyword-grant"></a>**GRANT**
  user、group、service principalなどに権限を付与する操作。

- <a id="keyword-revoke"></a>**REVOKE**
  付与済みの権限を取り消す操作。

- <a id="keyword-deny"></a>**DENY**
  特定の操作を明示的に拒否する考え方。

- <a id="keyword-row-level-security"></a>**row-level security**
  利用者や所属に応じて、同じテーブル内で見える行を変える制御。

- <a id="keyword-column-masking"></a>**column masking**
  メールアドレスや個人情報などの機密列を、利用者に応じてマスクする制御。

- <a id="keyword-abac"></a>**ABAC**
  データ分類や利用者属性などの属性に基づいてアクセス制御を行う考え方。

- <a id="keyword-user"></a>**user**
  Databricksを利用する個人アカウント。

- <a id="keyword-group"></a>**group**
  複数のuserをまとめ、役割単位で権限を管理するための単位。

- <a id="keyword-service-principal"></a>**service principal**
  ジョブや自動化処理など、アプリケーションやサービスが使う非個人の実行主体。

## 参考リンク

- [Unity Catalog とは](https://learn.microsoft.com/ja-jp/azure/databricks/data-governance/unity-catalog/)
- [Unity Catalog 権限リファレンス](https://learn.microsoft.com/ja-jp/azure/databricks/data-governance/unity-catalog/access-control/privileges-reference)
- [外部テーブル](https://learn.microsoft.com/ja-jp/azure/databricks/sql/language-manual/sql-ref-external-tables)
- [行フィルターと列マスクを手動で適用する](https://learn.microsoft.com/ja-jp/azure/databricks/data-governance/unity-catalog/filters-and-masks/manually-apply)
- [Unity Catalog での属性ベースのアクセス制御](https://learn.microsoft.com/ja-jp/azure/databricks/data-governance/unity-catalog/abac/)
