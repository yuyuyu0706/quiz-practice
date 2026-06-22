# 要点メモ: Unity Catalogを中心としたデータ資産管理

## 本チャプターのポイント

- Unity Catalogは、データ・AI・分析の資産を、発見可能で、安全に、組織横断で使える状態へ整える共通基盤です。
- catalog / schema / table・view・volumeは、資産を整理し、利用者が目的のデータへたどり着くための階層として捉えます。
- 権限設定だけでなく、データの発見可能性、統制、リネージ、監査をまとめて考えることが重要です。
- 開発・検証・本番などの文脈を意識し、同じ名前の資産でも環境や責務が分かるように管理します。
- GRANT / REVOKE / DENY、row filter、column mask、ABACの具体実装は、後続のガバナンス領域で深掘りします。

## 試験での注意点

- 「Unity Catalog = 権限設定だけ」と狭く覚えないようにします。資産整理、発見、統制、リネージまで含めて理解します。
- catalogとschemaは、単なる名前空間ではなく、組織、ドメイン、環境、責務を表す整理単位として考えます。
- table、view、volumeは、扱う資産の種類に応じて配置される管理対象です。詳細な運用設計は別領域で扱います。
- ダッシュボードの数値の根拠をたどる場面では、リネージや監査が重要になります。
- 細かなアクセス制御構文を暗記するより、どの資産を、誰が、どの文脈で使うかを整理する考え方を優先します。

## キーワード一覧

<a id="keyword-unity-catalog"></a>

### Unity Catalog

Azure Databricks上のデータ、AI、分析資産を横断的に管理するための統合ガバナンス基盤です。アクセス制御、発見、リネージ、監査などをまとめて扱います。

<a id="keyword-catalog"></a>

### Catalog

Unity Catalogの最上位に近い資産整理単位です。組織、事業領域、環境などの大きな境界を表すために使います。

<a id="keyword-schema"></a>

### Schema

Catalogの下で、テーブル、ビュー、ボリュームなどをまとめる整理単位です。業務領域や用途ごとに資産を分類するために使います。

<a id="keyword-managed-table"></a>

### Managed Table

Unity Catalogがデータの保存場所も含めて管理するテーブルです。試験では、管理対象の表形式データとして位置づけを押さえます。

<a id="keyword-external-table"></a>

### External Table

外部ストレージ上のデータをUnity Catalogに登録して扱うテーブルです。詳細な保存場所設計や運用判断は別領域で扱います。

<a id="keyword-volume"></a>

### Volume

表形式ではないファイルやディレクトリをUnity Catalogで管理するためのオブジェクトです。画像、CSV、JSON、モデル関連ファイルなどの整理に関係します。

<a id="keyword-data-lineage"></a>

### Data Lineage

データがどこから来て、どの処理を通り、どのテーブル、ビュー、ダッシュボードへ使われたかをたどる考え方です。

<a id="keyword-data-governance"></a>

### Data Governance

データ資産を安全に、信頼できる形で、組織のルールに沿って利用できるようにするための統制全体です。

<a id="keyword-data-discovery"></a>

### Data Discovery

利用者が必要なデータ資産を見つけ、意味や所有者、利用状況を確認できる状態にすることです。

<a id="keyword-principals"></a>

### Principals

ユーザー、グループ、サービスプリンシパルなど、データ資産へアクセスする主体です。この章では主体の考え方に留め、詳細な権限付与は後続領域で扱います。

## 参考リンク

- [Unity Catalog とは - Azure Databricks](https://learn.microsoft.com/ja-jp/azure/databricks/data-governance/unity-catalog/)
- [データベース オブジェクトの探索 - Azure Databricks](https://learn.microsoft.com/ja-jp/azure/databricks/discover/database-objects)
- [Unity カタログのデータ系列 - Azure Databricks](https://learn.microsoft.com/ja-jp/azure/databricks/data-governance/unity-catalog/data-lineage)
- [Azure Databricks 技術用語用語集 - Microsoft Learn](https://learn.microsoft.com/ja-jp/azure/databricks/resources/glossary)
