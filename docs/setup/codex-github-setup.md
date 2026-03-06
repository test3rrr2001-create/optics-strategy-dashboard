# Codex × GitHub 接続標準手順

## 目的
本手順は、ChatGPT Codex から GitHub リポジトリを安全に接続し、
Environment を作成するまでの標準フローを定義する。

---

## 前提条件

- GitHubアカウントを保有している
- ChatGPT Plus 以上のプランを利用している
- 接続対象リポジトリにアクセス権がある

---

## 接続は3段階構造

Codex接続は以下の3工程がすべて必要。

1. GitHubアプリのインストール（権限付与）
2. ChatGPT側のGitHub連携（OAuth認証）
3. Codex Environment作成（作業環境構築）

どれか1つでも欠けると接続できない。

---

## 手順

### Step1 GitHubでConnectorをインストール

1. GitHub → Settings
2. Applications
3. Installed GitHub Apps
4. ChatGPT Codex Connector をインストール
5. 対象リポジトリを選択
6. Save

---

### Step2 ChatGPT側GitHub連携（最重要）

1. ChatGPTを開く
2. 左下アイコン → 設定
3. 連携（Connectors）
4. GitHub が「接続済み」になっていることを確認

未接続の場合はここで接続する。

※ Connectorインストールとは別工程

---

### Step3 CodexでEnvironment作成

1. Codexを開く
2. 環境を作成
3. 組織を選択
4. リポジトリを選択
5. 環境作成

---

## 接続確認方法

Environment作成後、以下を実行する。

このリポジトリの構成を説明してください  
READMEがあれば要約してください  

ファイル一覧が表示されれば成功。

---

## 運用ルール

- いきなり修正させない
- まずは構成理解・要約から始める
- 本番リポジトリは最小権限で接続する

---

## 更新履歴

2026-03-06 初版作成
