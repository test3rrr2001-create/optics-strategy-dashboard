# 実装計画 - Gemini APIおよびデータベースエラーの修正

ユーザーから報告された2つの問題を修正します：
1. プロンプト入力時のエラー（Gemini APIキーの無効化、または環境変数の不一致が原因の可能性）。
2. 競合監視セクションで発生するデータベースエラー：`column projects_1.name does not exist`。

分析の結果、以下の原因が推測されます：
- Gemini API エラーは、`.env` 内のキーが無効・欠落しているか、環境が一致していないため。
- `competitor-results.js` での DB エラーは、`.select("*, projects(name)")` という結合処理が、`projects` テーブルとのリレーションまたはカラム名の不一致により失敗しているため。

## 提案する変更内容

### 環境設定
#### [MODIFY] [.env](file:///c:/Users/kaiha/.gemini/antigravity/scratch/optics-strategy-dashboard/.env)
- `GEMINI_API_KEY` の検証と更新。
- 不足している場合、`SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` を追加する。

### 診断ツール
#### [MODIFY] [test-gemini-diag-v2.ps1](file:///c:/Users/kaiha/.gemini/antigravity/scratch/optics-strategy-dashboard/test-gemini-diag-v2.ps1)
- `.env` から API キーを読み取るロジックをより堅牢に修正する。

### AIサマリー API
#### [MODIFY] [ai-summary.js](file:///c:/Users/kaiha/.gemini/antigravity/scratch/optics-strategy-dashboard/api/dashboard/ai-summary.js)
- エラーハンドリングを改善し、汎用的な「メンテナンス中」メッセージではなく、フロントエンドに具体的なフィードバックを提供する。
- プロンプトが正しくフォーマットされているか確認し、JSONのパースエラーを引き起こす文字を適切に処理する。

### 競合監視 API
#### [MODIFY] [competitor-results.js](file:///c:/Users/kaiha/.gemini/antigravity/scratch/optics-strategy-dashboard/api/dashboard/competitor-results.js)
- 問題となっている結合処理 `.select("*, projects(name)")` を削除し、`results.js` の手法と同様に JavaScript 側で手動でプロジェクト名をマッピングする。これにより、スキーマに依存するエラーを回避する。

## 検証計画

### 自動テスト
- 修正した `test-gemini-diag-v2.ps1` を実行し、APIの接続性を確認する。
- 新たに診断スクリプト `test-supabase-connectivity.ps1` を作成し、Supabaseへのアクセスを確認する。

### 手動検証
- 修正後、変更をコミットしてデプロイする。
- 実際のダッシュボード画面「競合監視」と「AI戦略サマリー」にアクセスし、エラー表示がなく意図した通りに動作することを確認する。
