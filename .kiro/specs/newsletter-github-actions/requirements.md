# Requirements Document

## Introduction
本ドキュメントは、GitHub Actionsを使用したニュースレター自動配信システムの要件を定義します。このシステムは、指定されたテーマに基づいてWeb検索を行い、ニュースレターを自動生成し、Resend APIを通じて購読者に配信します。送信先リストはFirestoreで管理され、Workload Identity Federationによるセキュアな認証を使用します。

## Requirements

### Requirement 1: ニュースレター生成機能
**Objective:** As a システム管理者, I want テーマに基づいたニュースレターを自動生成したい, so that 手動でのコンテンツ作成作業を削減できる

#### Acceptance Criteria
1. When GitHub Actionsワークフローが実行された時, the Newsletter Generator shall Firestoreの`/themes/{id}`からプロンプト設定を取得する
2. When プロンプト設定が取得された時, the Newsletter Generator shall プロンプトに基づいてWeb検索を実行する
3. When Web検索結果が取得された時, the Newsletter Generator shall 検索結果を基にニュースレターコンテンツを生成する
4. If プロンプト設定が存在しない場合, then the Newsletter Generator shall エラーログを出力して当該テーマの処理をスキップする
5. If Web検索に失敗した場合, then the Newsletter Generator shall リトライを実行し、3回失敗後にエラーログを出力する

### Requirement 2: メール送信機能
**Objective:** As a 購読者, I want ニュースレターをメールで受信したい, so that 最新のニュース情報を定期的に確認できる

#### Acceptance Criteria
1. When ニュースレターコンテンツが生成された時, the Email Sender shall Resend APIを使用してメールを送信する
2. When メール送信を実行する時, the Email Sender shall Firestoreの`/themes/{theme-id}/mailto/`から送信先リストを取得する
3. The Email Sender shall 送信先リストの全てのメールアドレスに対してニュースレターを送信する
4. If Resend APIへの送信が失敗した場合, then the Email Sender shall エラーログを記録し、失敗した送信先を報告する
5. If 送信先リストが空の場合, then the Email Sender shall 警告ログを出力して処理を完了する

### Requirement 3: Firestore連携機能
**Objective:** As a システム管理者, I want 送信先リストをFirestoreで管理したい, so that 購読者の追加・削除を柔軟に行える

#### Acceptance Criteria
1. The Firestore Connector shall `/themes/{theme-id}/mailto/`コレクションから購読者情報を読み取る
2. The Firestore Connector shall 各購読者ドキュメントから`mailto`(メールアドレス)フィールドを取得する
3. The Firestore Connector shall `/themes/{id}`ドキュメントから`prompt`フィールドを取得する
4. If Firestoreへの接続に失敗した場合, then the Firestore Connector shall エラーログを出力してワークフローを失敗させる

### Requirement 4: セキュリティ認証機能
**Objective:** As a セキュリティ担当者, I want Workload Identity Federationで認証を行いたい, so that サービスアカウントキーを使用せずにセキュアにGCPリソースにアクセスできる

#### Acceptance Criteria
1. The GitHub Actions Workflow shall Workload Identity Federationを使用してGCPへの認証を行う
2. The GitHub Actions Workflow shall サービスアカウントキーファイルをリポジトリに保存しない
3. When ワークフローが実行された時, the GitHub Actions Workflow shall OIDCトークンを使用してFirestoreへのアクセス権限を取得する
4. If 認証に失敗した場合, then the GitHub Actions Workflow shall エラーログを出力してワークフローを停止する

### Requirement 5: スケジュール実行機能
**Objective:** As a 購読者, I want 毎週決まった時間にニュースレターを受信したい, so that 定期的に最新情報を確認できる

#### Acceptance Criteria
1. The GitHub Actions Workflow shall cronスケジュールで毎週月曜日9時(JST)に自動実行される
2. The GitHub Actions Workflow shall 手動トリガー(workflow_dispatch)による実行もサポートする
3. When スケジュール実行が開始された時, the GitHub Actions Workflow shall 全ての有効なテーマに対してニュースレター生成・送信処理を実行する
4. The GitHub Actions Workflow shall 実行結果のサマリーをログに出力する

### Requirement 6: 設定管理機能
**Objective:** As a システム管理者, I want 環境変数とシークレットで設定を管理したい, so that セキュアかつ柔軟に設定を変更できる

#### Acceptance Criteria
1. The GitHub Actions Workflow shall Resend APIキーをGitHub Secretsから取得する
2. The GitHub Actions Workflow shall GCPプロジェクトIDをGitHub変数または環境変数から取得する
3. The GitHub Actions Workflow shall Workload Identity Provider情報をGitHub Secretsから取得する
4. If 必要なシークレットが設定されていない場合, then the GitHub Actions Workflow shall エラーメッセージを出力してワークフローを失敗させる
