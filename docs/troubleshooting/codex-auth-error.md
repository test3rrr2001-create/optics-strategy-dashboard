# Codex GitHub認証エラー対処法

## 症状

Codex 環境作成時に

GitHub アカウントがありません  
Codexを使用するには、GitHubアカウントが必要です  

と表示される。

---

## 原因

GitHubアプリはインストール済みだが、
ChatGPT側のGitHub OAuth認証が未接続。

---

## 認証構造の理解

GitHubアプリのインストール
≠
ChatGPTアカウントへのGitHub連携

両方必要。

---

## 確認手順

1. ChatGPT → 設定 → 連携
2. GitHubが「接続済み」になっているか確認
3. 未接続なら接続する

---

## セッション不整合時のリセット手順

1. GitHubからログアウト
2. ChatGPTからログアウト
3. ブラウザを閉じる
4. GitHubに先にログイン
5. ChatGPTにログイン
6. 再度接続

---

## よくある誤解

メールアドレスは関係ない。

重要なのはOAuth認証状態。

---

## 再発防止チェックリスト

□ GitHub Connector インストール済み  
□ ChatGPT GitHub連携済み  
□ 組織表示確認  
□ リポジトリ表示確認  
□ Environment作成成功  

---

## 更新履歴

2026-03-06 初版作成
