以下の仕様のgithub-actionsを作成できるか検討してください

1. 指定したプロンプトに応じてネットを検索してニュースレターを作成

- プロンプトは/themes/{id}
  - prompt: string;

2. resend APIで送信
3. 送信先リストはFirestoreとしてください

- セキュリティは Workload Identity Federation
- /themes/{theme-id}/mailto/
  - mailto: string; // email address
  - createdAt: Date;

4. 毎週月曜日9時に実行
