# Research & Design Decisions

---
**Purpose**: GitHub Actionsを使用したニュースレター自動配信システムの技術調査と設計決定を記録する。

**Usage**:
- 外部依存関係の調査結果を文書化
- アーキテクチャ決定のトレードオフを記録
- 将来の監査や再利用のための参照を提供
---

## Summary
- **Feature**: `newsletter-github-actions`
- **Discovery Scope**: Complex Integration（複数の外部サービス連携、セキュリティ認証）
- **Key Findings**:
  - Workload Identity Federationはサービスアカウントキーより安全で推奨される認証方式
  - Resend APIはレート制限が2リクエスト/秒（デフォルト）、バッチ送信で最大100件対応
  - GitHub Actionsのcronスケジュールは常にUTC基準、JST 9:00はUTC 0:00に設定が必要

## Research Log

### Workload Identity Federation認証
- **Context**: GitHub ActionsからGCPリソース（Firestore）へのセキュアなアクセス方法の調査
- **Sources Consulted**:
  - [google-github-actions/auth GitHub Repository](https://github.com/google-github-actions/auth)
  - [Enabling keyless authentication from GitHub Actions](https://cloud.google.com/blog/products/identity-security/enabling-keyless-authentication-from-github-actions)
  - [Configure Workload Identity Federation with deployment pipelines](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)
- **Findings**:
  - サービスアカウントキーは非推奨、Workload Identity Federationが推奨
  - 短期間有効なOAuth 2.0トークンを使用（デフォルト1時間）
  - GitHub OIDCトークンは5分で期限切れ
  - 必須入力: `workload_identity_provider`（プロジェクト番号を含む完全パス）
  - 出力: `credentials_file_path`, `access_token`
  - IAM権限の伝播に最大5分かかる場合がある
- **Implications**:
  - ワークフローには`id-token: 'write'`権限が必要
  - `workload_identity_provider`はシークレットとして管理
  - サービスアカウントにFirestore読み取り権限を付与

### Resend API
- **Context**: メール送信サービスの仕様とレート制限の調査
- **Sources Consulted**:
  - [Resend API Rate Limit](https://resend.com/docs/api-reference/rate-limit)
  - [Send emails with Node.js](https://resend.com/nodejs)
  - [Mastering Email Rate Limits](https://dalenguyen.me/blog/2025-09-07-mastering-email-rate-limits-resend-api-cloud-run-debugging)
- **Findings**:
  - エンドポイント: `POST https://api.resend.com/emails`
  - 認証: Bearer token（`Authorization: Bearer re_xxxxxxxxx`）
  - レート制限: デフォルト2リクエスト/秒
  - 最大受信者: 1リクエストあたり50件
  - バッチ送信: 最大100件/リクエスト
  - Idempotency-Keyヘッダーで重複送信防止（24時間有効）
  - レート制限時は429エラーを返す（例外ではなくエラーオブジェクト）
  - Node.js SDK: `resend` パッケージ v6.6.0
- **Implications**:
  - 複数購読者への送信はバッチ処理を推奨
  - レート制限エラーの明示的なチェックが必要
  - リトライ時はバックオフ戦略を実装

### Firestore Node.js SDK
- **Context**: FirestoreへのサーバーサイドアクセスとGitHub Actions連携の調査
- **Sources Consulted**:
  - [Cloud Firestore Node.js client library](https://cloud.google.com/nodejs/docs/reference/firestore/latest)
  - [googleapis/nodejs-firestore](https://github.com/googleapis/nodejs-firestore)
- **Findings**:
  - `@google-cloud/firestore`パッケージを使用
  - Application Default Credentials（ADC）による認証をサポート
  - Workload Identity Federation経由で認証情報を自動取得可能
  - `GOOGLE_APPLICATION_CREDENTIALS`環境変数または`google-github-actions/auth`の出力を使用
- **Implications**:
  - `google-github-actions/auth`の`credentials_file_path`出力を環境変数に設定
  - Firestoreクライアントは認証情報を自動検出

### GitHub Actions Cronスケジュール
- **Context**: 日本時間でのスケジュール実行方法の調査
- **Sources Consulted**:
  - [GitHub Actions Cron with Timezone](https://zenn.dev/blancpanda/articles/github-actions-cron-timezone-jst)
  - [GitHub Community Discussion #13454](https://github.com/orgs/community/discussions/13454)
- **Findings**:
  - GitHub ActionsのcronはUTC時間のみサポート
  - JST（UTC+9）への変換が必要
  - 毎週月曜日9:00 JST = 毎週日曜日24:00 UTC = 毎週月曜日0:00 UTC
  - cron式: `0 0 * * 1`（毎週月曜日0:00 UTC = JST 9:00）
  - 正時のスケジュールは避けることを推奨（サーバー負荷）
- **Implications**:
  - `cron: '0 0 * * 1'`で毎週月曜日JST 9:00に実行
  - TZ環境変数でログ出力時のタイムゾーン調整が可能

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| モノリシックスクリプト | 単一のTypeScriptファイルで全処理 | シンプル、依存少 | テスト困難、保守性低 | 不採用 |
| レイヤードアーキテクチャ | Infrastructure/Application/Domain層 | 関心の分離、テスト容易 | 小規模には過剰 | 採用候補 |
| 関数型パイプライン | 純粋関数のチェーン | 副作用の分離、テスト容易 | 学習コスト | 部分採用 |

**Selected**: レイヤードアーキテクチャ（簡易版）+ 関数型パイプライン

## Design Decisions

### Decision: TypeScriptによる実装
- **Context**: GitHub Actionsで実行するスクリプト言語の選択
- **Alternatives Considered**:
  1. Python — 豊富なライブラリ、型ヒントは限定的
  2. TypeScript — 型安全性、Resend公式SDK対応
  3. Go — コンパイル必要、GitHub Actions向けセットアップが複雑
- **Selected Approach**: TypeScriptを採用
- **Rationale**:
  - Resend公式Node.js SDKが利用可能
  - 型安全性によるバグ防止
  - GitHub Actionsでのセットアップが容易
- **Trade-offs**: Node.jsランタイムが必要、起動時間がGoより遅い
- **Follow-up**: Node.js 20.x LTSを使用

### Decision: Workload Identity Federation認証
- **Context**: GCPリソースへのセキュアなアクセス方法
- **Alternatives Considered**:
  1. サービスアカウントキー — 静的認証情報、セキュリティリスク
  2. Workload Identity Federation — 動的トークン、キーレス
- **Selected Approach**: Workload Identity Federationを採用
- **Rationale**:
  - サービスアカウントキーの管理が不要
  - 短期間有効なトークンによるセキュリティ向上
  - Google推奨のベストプラクティス
- **Trade-offs**: 初期設定が複雑、IAM伝播に時間がかかる場合がある
- **Follow-up**: GCPプロジェクトでのWIF設定手順を文書化

### Decision: バッチ処理によるメール送信
- **Context**: 複数購読者へのメール送信方式
- **Alternatives Considered**:
  1. 個別送信 — シンプルだがレート制限に抵触しやすい
  2. バッチ送信 — 効率的、Resend APIがサポート
- **Selected Approach**: バッチ送信を採用（最大100件/リクエスト）
- **Rationale**:
  - レート制限（2リクエスト/秒）への対応
  - API呼び出し回数の削減
- **Trade-offs**: エラー時の個別リトライが複雑
- **Follow-up**: 部分的な送信失敗時のハンドリング戦略を検討

### Decision: テーマごとの独立処理
- **Context**: 複数テーマのニュースレター処理方式
- **Alternatives Considered**:
  1. 並列処理 — 高速だがエラー伝播が複雑
  2. 逐次処理 — シンプル、エラー分離が容易
- **Selected Approach**: 逐次処理を採用
- **Rationale**:
  - 1テーマの失敗が他テーマに影響しない
  - ログの追跡が容易
  - レート制限への自然な対応
- **Trade-offs**: 処理時間が長くなる可能性
- **Follow-up**: テーマ数増加時に並列化を検討

## Risks & Mitigations

- **Risk 1**: Resend APIレート制限超過 — バッチ送信とリトライバックオフで緩和
- **Risk 2**: Workload Identity Federation設定ミス — 詳細なトラブルシューティングガイドを準備、IAM伝播待機時間を考慮
- **Risk 3**: Web検索API失敗 — 3回リトライ後にスキップ、エラーログ記録
- **Risk 4**: Firestore接続障害 — 接続タイムアウト設定、エラー時はワークフロー全体を失敗

## References
- [google-github-actions/auth](https://github.com/google-github-actions/auth) — GCP認証用GitHub Action
- [Resend API Documentation](https://resend.com/docs/api-reference/emails/send-email) — メール送信API仕様
- [Cloud Firestore Node.js Client](https://cloud.google.com/nodejs/docs/reference/firestore/latest) — Firestore SDK参照
- [Enabling keyless authentication from GitHub Actions](https://cloud.google.com/blog/products/identity-security/enabling-keyless-authentication-from-github-actions) — Workload Identity Federationガイド
- [Resend Rate Limit](https://resend.com/docs/api-reference/rate-limit) — レート制限仕様
