![AI Newsletter](docs/images/banner.png)

<p align="right">
  <a href="README.md">English</a> | <strong>日本語</strong>
</p>

# AI Newsletter

GitHub Actionsを使用したAI駆動の自動ニュースレター配信システム。Firestoreからテーマと購読者を取得し、AIがコンテンツを生成してResend APIでメールを配信します。

## 機能

- 毎週月曜日 9:00 JST に自動実行（cron スケジュール）
- 手動実行対応（dry-run モード付き）
- Firestoreからテーマ別の購読者リストを取得
- Resend APIによるバッチメール送信（100件/リクエスト）
- Workload Identity Federation によるキーレス認証

## 必要条件

- Node.js 20.x 以上
- Google Cloud Platform プロジェクト
- Firestore データベース
- Resend アカウント

## セットアップ

### 1. リポジトリのクローンと依存関係のインストール

```bash
git clone <repository-url>
cd ai-newsletter
npm install
```

### 2. 環境変数ファイルの作成

`.env.sample` をコピーして `.env` を作成し、値を設定します：

```bash
cp .env.sample .env
# .env を編集して実際の値を設定
```

以降の手順で `.env` の値を環境変数として使用します：

```bash
source .env
```

### 3. Resend のセットアップ

1. [Resend](https://resend.com) にサインアップ
2. ドメインを追加し、DNS レコードを設定して認証
3. [API Keys](https://resend.com/api-keys) から API キーを作成
4. `.env` の `RESEND_API_KEY` と `FROM_EMAIL` を設定

### 4. GCP Workload Identity Federation の設定

GitHub ActionsからGCPリソースにアクセスするために、Workload Identity Federationを設定します。

`.env` で `CLOUDSDK_CORE_PROJECT` を設定しているため、`--project` フラグは省略できます。

#### 必要なAPIの有効化

まず、必要なGoogle Cloud APIを有効化します：

```bash
# Firestore APIの有効化
gcloud services enable firestore.googleapis.com

# IAM Service Account Credentials APIの有効化（Workload Identity Federationに必要）
gcloud services enable iamcredentials.googleapis.com
```

#### Workload Identityの設定

```bash
# Workload Identity Poolの作成
gcloud iam workload-identity-pools create $POOL_NAME \
  --location="global" \
  --display-name="GitHub Actions Pool"

# OIDC Providerの作成
gcloud iam workload-identity-pools providers create-oidc $PROVIDER_NAME \
  --location="global" \
  --workload-identity-pool=$POOL_NAME \
  --display-name="GitHub Actions Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# サービスアカウントの作成
gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
  --display-name="Newsletter Service Account"

# Firestoreへのアクセス権限を付与
gcloud projects add-iam-policy-binding $CLOUDSDK_CORE_PROJECT \
  --member="serviceAccount:${SERVICE_ACCOUNT_NAME}@${CLOUDSDK_CORE_PROJECT}.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

# GitHub ActionsがサービスアカウントをImpersonateできるように設定
gcloud iam service-accounts add-iam-policy-binding \
  ${SERVICE_ACCOUNT_NAME}@${CLOUDSDK_CORE_PROJECT}.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$(gcloud projects describe $CLOUDSDK_CORE_PROJECT --format='value(projectNumber)')/locations/global/workloadIdentityPools/${POOL_NAME}/attribute.repository/${GITHUB_REPO}"
```

### 5. Firestoreデータの作成

#### サンプルデータのインストール（推奨）

AIコーディングエージェントのニュースを配信するサンプルテーマをインストールできます：

```bash
npm run install:ainews
```

このスクリプトは以下を作成します：
- テーマ: `ai-coding-agents`（AIコーディングエージェントの最新ニュース）
- 購読者: git config の user.email を自動取得して登録

#### データ構造

Firestore のデータ構造は以下の通りです：

```
themes/
  └── {theme-id}/
        ├── prompt: string        # テーマのプロンプト
        └── mailto/
              └── {subscriber-id}/
                    └── mailto: string  # 購読者のメールアドレス
```

### 6. GitHub Secrets/Variables の登録

セットアップスクリプトを実行して一括登録：

```bash
./scripts/setup-secrets.sh
```

このスクリプトは以下を自動で行います：
- `.env` から設定値を読み込み
- GCPから `WORKLOAD_IDENTITY_PROVIDER` を自動取得
- `SERVICE_ACCOUNT_EMAIL` を自動生成
- GitHub Secrets/Variables に登録

#### 手動で設定する場合

リポジトリの Settings > Secrets and variables > Actions で以下を設定：

**Secrets（機密情報）**

| Name | Description |
|------|-------------|
| `RESEND_API_KEY` | Resend APIキー |
| `FROM_EMAIL` | 送信元メールアドレス |
| `WORKLOAD_IDENTITY_PROVIDER` | WIF プロバイダーの完全パス |
| `SERVICE_ACCOUNT_EMAIL` | サービスアカウントのメール |

**Variables（非機密情報）**

| Name | Description |
|------|-------------|
| `CLOUDSDK_CORE_PROJECT` | GCPプロジェクトID |

## 開発

### ビルド

```bash
npm run build
```

### テスト

```bash
# テスト実行
npm test

# ウォッチモード
npm run test:watch
```

### Lint

```bash
npm run lint
```

### ローカル実行

```bash
# .env ファイルを読み込んで実行
source .env && npm start
```

#### GCP認証の設定

ローカル実行には Firestore へのアクセス権限が必要です。以下のいずれかの方法で設定してください：

**方法1: Application Default Credentials（推奨）**

キーファイル不要で、gcloud CLI の認証情報を使用します：

```bash
gcloud auth application-default login
```

**方法2: サービスアカウントキー**

サービスアカウントのJSONキーファイルを使用します。`.env` に追加してください：

```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

## ワークフローの手動実行

GitHub Actions タブから手動でワークフローを実行できます：

1. Actions タブを開く
2. "Newsletter Delivery" ワークフローを選択
3. "Run workflow" をクリック
4. オプションで dry_run を有効化（メール送信なしでテスト）
5. "Run workflow" で実行

## アーキテクチャ

```
src/
├── index.ts                    # メインエントリーポイント
├── application/
│   ├── newsletter-generator.ts # ニュースレター生成オーケストレーション
│   ├── email-sender.ts         # Resend APIによるメール送信
│   ├── content-generator-service.ts  # コンテンツ生成
│   └── web-search-service.ts   # Web検索サービス
├── domain/
│   └── types.ts                # ドメイン型定義
└── infrastructure/
    └── firestore-connector.ts  # Firestore接続
```

## ライセンス

MIT
