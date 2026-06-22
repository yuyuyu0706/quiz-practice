# 要点メモ: LakehouseとDelta Lakeの位置づけ

## 本チャプターのポイント

- [Lakehouse](#keyword-lakehouse)は、データレイクの柔軟性とデータウェアハウスの管理性を組み合わせるアーキテクチャの考え方です。
- データレイクだけでは、品質、スキーマ、履歴、更新・削除の管理が弱くなりやすい点を押さえます。
- データウェアハウスだけでは、多様な形式の生データやAI・機械学習向けデータ活用で柔軟性が足りない場合があります。
- [Delta Lake](#keyword-delta-lake)は、Lakehouse上のデータを信頼できるテーブルとして扱うための中核技術です。
- Delta Lakeの代表キーワードとして、[ACIDトランザクション](#keyword-acid-transaction)、[スキーマ管理](#keyword-schema-management)、[履歴管理](#keyword-history-management)、更新・削除を押さえます。

## 試験での注意点

- LakehouseとDelta Lakeを同じ意味として扱わないようにします。
- Lakehouseは全体のアーキテクチャ、Delta Lakeはテーブル信頼性を支える技術、という役割分担で整理します。
- データレイクは「保存に強い」、データウェアハウスは「整理済み分析に強い」と考え、どちらか一方だけで万能と覚えないようにします。
- Delta LakeはBIツールそのものではなく、分析やパイプラインの前提になる信頼できるテーブル管理を支えるものです。

## キーワード一覧

<a id="keyword-lakehouse"></a>

### Lakehouse

データレイクとデータウェアハウスの利点を組み合わせ、柔軟な保存と管理された分析を両立しようとする考え方です。

<a id="keyword-delta-lake"></a>

### Delta Lake

データレイク上のファイルを、信頼性の高いテーブルとして扱いやすくするオープンソースのストレージレイヤーです。

<a id="keyword-acid-transaction"></a>

### ACIDトランザクション

データ操作の一貫性や信頼性を保つための性質です。複数の処理が関わるテーブル更新でも、途中で壊れた状態になりにくくします。

<a id="keyword-schema-management"></a>

### スキーマ管理

テーブルの列名やデータ型を管理し、想定外の構造変更によるデータ品質の低下を防ぎやすくします。

<a id="keyword-history-management"></a>

### 履歴管理

テーブルの変更履歴を確認し、必要に応じて過去の状態を追跡しやすくする考え方です。

## 参考リンク

- [Azure Databricks とは](https://learn.microsoft.com/ja-jp/azure/databricks/introduction/)
- [Azure Databricks の Delta Lake とは](https://learn.microsoft.com/ja-jp/azure/databricks/delta/)
- [Azure Databricksでの ACID 保証とは](https://learn.microsoft.com/ja-jp/azure/databricks/lakehouse/acid)
- [テーブル履歴の操作](https://learn.microsoft.com/ja-jp/azure/databricks/delta/history)
