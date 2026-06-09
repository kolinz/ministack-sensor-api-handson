# ministack-sensor-api-handson — MiniStack + Express + Node-RED（Docker Compose 一式）

## 構成

```
ministack-sensor-api-handson/
├── docker-compose.yml   # MiniStack + Express API + Node-RED
├── api/
│   ├── Dockerfile
│   ├── package.json
│   └── index.js
└── node-red/
    ├── Dockerfile
    ├── entrypoint.sh
    └── flows.json
```

## サービス構成

| サービス | コンテナ名 | ポート | 役割 |
|---|---|---|---|
| ministack | sensor-ministack | 4566 | DynamoDB ローカル再現（MiniStack） |
| api | sensor-api | 3000 | REST API（Express） |
| nodered | sensor-nodered | 1880 | フロー送信（Node-RED） |

---

## セットアップ・操作手順

### ステップ 1 — Docker Compose でバックグラウンド起動

```bash
git clone https://github.com/kolinz/ministack-sensor-api-handson.git
cd ministack-sensor-api-handson
docker compose up --build -d
```

`-d` をつけることでバックグラウンド起動となり、同じターミナルで続けて作業できます。

起動順序は自動制御されます：
1. MiniStack が起動・ヘルスチェック通過
2. Express API が起動・DynamoDB テーブル自動作成
3. Node-RED が起動

起動状況の確認：
```bash
docker compose ps
```

> **ℹ️ MiniStack について**
> LocalStack Community版は2026年3月に終了しました。本プロジェクトでは代替として MiniStack（MIT ライセンス・無料・認証不要）を使用しています。

---

### ステップ 2 — Python 仮想環境の作成と有効化

システム全体の Python 環境を汚さないよう、仮想環境を作成してから pip を使います。

```bash
python3 -m venv myvenv
source ./myvenv/bin/activate
```

有効化されるとプロンプトの先頭に `(myvenv)` が表示されます。

> **次回以降** は作成不要です。有効化だけ実行してください：
> ```bash
> source ./myvenv/bin/activate
> ```

---

### ステップ 3 — awscli-local と AWS CLI のインストール（初回のみ）

```bash
pip install awscli-local
pip install awscli
```

---

### ステップ 4 — AWS CLI の初期設定（初回のみ）

LocalStack はキーを検証しないため、ダミー値で構いません：

```bash
aws configure
# AWS Access Key ID     : test
# AWS Secret Access Key : test
# Default region name   : ap-northeast-1
# Default output format : json
```

---

### ステップ 5 — credentials ファイルのパーミッション修正

`aws configure` 実行後に以下の WARNING が表示された場合：

```
[WARNING]: The file '/home/<user>/.aws/credentials' is accessible by other users.
```

以下のコマンドで修正してください：

```bash
chmod 600 ~/.aws/credentials
chmod 600 ~/.aws/config
```

---

### ステップ 6 — インストール確認

```bash
aws --version
awslocal --version
```

両方のバージョンが表示されれば準備完了です。

---

### ステップ 7 — REST API でセンサーデータを登録

```bash
# データ登録
curl -X POST http://localhost:3000/sensors \
  -H "Content-Type: application/json" \
  -d '{
    "sensor_name": "temp-sensor-01",
    "temperature": 24.5,
    "date": "2026-06-08",
    "time": "14:30:00"
  }'

# 全件取得
curl http://localhost:3000/sensors

# センサー名で絞り込み
curl http://localhost:3000/sensors/temp-sensor-01

# 死活確認
curl http://localhost:3000/health
```

---

### ステップ 8 — DynamoDB の確認

AWS CLI を直接使う場合：
```bash
aws --endpoint-url=http://localhost:4566 dynamodb list-tables --region ap-northeast-1
aws --endpoint-url=http://localhost:4566 dynamodb scan --table-name SensorData --region ap-northeast-1
```

---

### ステップ 9 — Node-RED でのデータ送信

#### 9-1. flows.json のインポート（初回のみ）

フローが自動読み込みされていない場合は、手動でインポートします。

1. ブラウザで http://localhost:1880 を開く
2. 右上のハンバーガーメニュー（≡）をクリック
3. **Import** を選択
4. **`node-red/flows.json`** をウィンドウ内にドラッグ＆ドロップ。あるいは、[node-red/flows.json](https://github.com/kolinz/ministack-sensor-api-handson/blob/main/node-red/flows.json) のコードをコピーして貼り付け。
5. **Import** ボタンをクリック
6. 画面上部に **「センサーデータ送信」** タブが表示されたらクリックして切り替える
7. 右上の **Deploy** ボタン（赤）をクリックして反映

#### 9-2. データ送信

1. **`テストデータ注入`** ノードの左端のボタンをクリック
2. 画面右側のデバッグパネルにレスポンスが表示されることを確認

`テストデータ注入` ノードをダブルクリックすると payload を自由に編集できます：
```json
{
  "sensor_name": "temp-sensor-02",
  "temperature": 30.1,
  "date": "2026-06-08",
  "time": "15:00:00"
}
```

---

## 停止・再起動

```bash
# 停止（データは保持）
docker compose down

# 再起動
docker compose up -d

# Python 仮想環境を終了する場合
deactivate
```

> **補足** `deactivate` はターミナルを閉じる前や、仮想環境を使い終わったタイミングで実行してください。
> 次回作業時は `source ./myvenv/bin/activate` で再度有効化できます。

---

## Named Volume 一覧

| ボリューム名 | 内容 |
|---|---|
| sensor-ministack-data | DynamoDB データ |
| sensor-api-logs | api.log |
| sensor-nodered-data | Node-RED フロー・設定・追加ノード |

```bash
docker volume ls
```
