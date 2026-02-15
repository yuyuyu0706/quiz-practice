# DEA 50問 練習アプリ（MVP）

Databricks Certified Data Engineer Associate（DEA）対策向けの、HTML/CSS/JavaScriptのみで動作する学習用Webアプリです。

## 起動方法

### 推奨（ローカルサーバ）
`file://` 直接オープンでは `questions.json` の読み込み時にCORS制約が出る場合があります。
以下のいずれかでローカルサーバ起動を推奨します。

- VS Code: **Live Server** 拡張を使って `dea-quiz-app/index.html` を開く
- Python がある場合:

```bash
cd dea-quiz-app
python -m http.server 8000
```

その後 `http://localhost:8000` にアクセスします。

## 主要機能

- ホーム/設定画面
  - セクション（1〜5）絞り込み
  - 出題モード（通常/ランダム/間違いのみ/ブックマークのみ）
  - 出題数（10/20/50/全問）
  - 続きから再開（中断セッションがある場合のみ表示）
  - 中断データを削除（やり直し）
- クイズ画面
  - 1問ずつ表示、A〜Dの4択回答
  - 回答確定で正誤判定（✅/❌）
  - 正解選択肢の強調表示
  - 解説表示の切替
  - 前へ/次へ
  - キーボード操作（A-D, 1-4, Enter, ←/→）
  - ブックマーク機能
  - 中断してホームへ（現在状態を保存）
- 結果画面
  - スコア（正答数/出題数/正答率）
  - セクション別正答率
  - 間違い問題一覧
  - 間違いのみ復習開始

## questions.json の追加・編集方法

`questions.json` は以下形式の配列です。

```json
[
  {
    "id": "Q1",
    "section": "1",
    "sectionTitle": "Databricks Intelligence Platform",
    "question": "問題文",
    "choices": {
      "A": "選択肢A",
      "B": "選択肢B",
      "C": "選択肢C",
      "D": "選択肢D"
    },
    "answer": "C",
    "explanation": "Markdown形式の解説（段落・箇条書き・```sql / ```python のコードフェンス対応）",
    "references": [
      { "title": "公式ドキュメント名", "url": "https://docs.databricks.com/..." }
    ]
  }
]
```

- `id` は重複しない値にしてください（例: `Q1`〜`Q50`）
- `answer` は `A/B/C/D` のいずれか
- `section` は `1`〜`5` 想定

## localStorage 保存内容

- `deaQuizProgress`: 問題ごとの学習履歴
  - `seenCount`, `correctCount`, `wrongCount`, `lastAnsweredAt`, `bookmark`
- `deaQuizSettings`: ホーム画面の設定値
- `deaQuizActiveSession`: 進行中セッション（出題順、回答、現在位置、採点状況、保存時刻）

## localStorage リセット方法

ブラウザDevToolsのConsoleで以下を実行:

```js
localStorage.removeItem('deaQuizProgress');
localStorage.removeItem('deaQuizSettings');
localStorage.removeItem('deaQuizActiveSession');
```

または、対象サイトのストレージをブラウザ設定から削除してください。


## 高度解説（Markdown）と参考リンク

- `explanation` は Markdown 文字列として扱われます。
  - 段落（空行区切り）
  - 箇条書き（`- `）
  - コードフェンス（` ```sql ` / ` ```python `）
- `references` は任意フィールドです。未指定または空配列なら非表示です。
- 参考リンクは新しいタブで開くように `target="_blank"` + `rel="noopener noreferrer"` を付与しています。
- 既存の中断/再開セッションには新フィールドを保存しないため、古いセッションでも後方互換で表示できます。
