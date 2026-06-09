const express = require("express");
const fs = require("fs");
const path = require("path");
const { DynamoDBClient, CreateTableCommand, ListTablesCommand } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");

const app = express();
app.use(express.json());

// ── ログ（コンソール + /app/logs/api.log に永続化）──
const LOG_DIR = "/app/logs";
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const logStream = fs.createWriteStream(path.join(LOG_DIR, "api.log"), { flags: "a" });
function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(" ")}`;
  console.log(line);
  logStream.write(line + "\n");
}

// ── DynamoDB クライアント（LocalStack Desktop に接続）──
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "ap-northeast-1",
  endpoint: process.env.DYNAMODB_ENDPOINT || "http://host.docker.internal:4566",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test",
  },
});

const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME || "SensorData";

// ── 起動時にテーブルを作成（なければ）──
async function ensureTable() {
  try {
    const { TableNames } = await client.send(new ListTablesCommand({}));
    if (TableNames.includes(TABLE_NAME)) {
      log(`[DynamoDB] テーブル "${TABLE_NAME}" は既に存在します`);
      return;
    }
    await client.send(
      new CreateTableCommand({
        TableName: TABLE_NAME,
        KeySchema: [
          { AttributeName: "sensor_name", KeyType: "HASH" },
          { AttributeName: "timestamp",   KeyType: "RANGE" },
        ],
        AttributeDefinitions: [
          { AttributeName: "sensor_name", AttributeType: "S" },
          { AttributeName: "timestamp",   AttributeType: "S" },
        ],
        BillingMode: "PAY_PER_REQUEST",
      })
    );
    log(`[DynamoDB] テーブル "${TABLE_NAME}" を作成しました`);
  } catch (err) {
    log(`[DynamoDB] テーブル初期化エラー: ${err.message}`);
  }
}

// ── POST /sensors  センサーデータ登録 ──
app.post("/sensors", async (req, res) => {
  const { sensor_name, temperature, date, time } = req.body;

  if (!sensor_name || temperature === undefined || !date || !time) {
    return res.status(400).json({
      error: "必須フィールドが不足しています",
      required: ["sensor_name", "temperature", "date", "time"],
    });
  }

  const timestamp = `${date}T${time}`;
  const item = {
    sensor_name:  String(sensor_name),
    timestamp,
    temperature:  Number(temperature),
    date:         String(date),
    time:         String(time),
    created_at:   new Date().toISOString(),
  };

  try {
    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    log(`[POST /sensors] 登録: ${JSON.stringify(item)}`);
    return res.status(201).json({ message: "登録成功", item });
  } catch (err) {
    log(`[POST /sensors] エラー: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /sensors  全件取得 ──
app.get("/sensors", async (req, res) => {
  try {
    const { Items } = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
    return res.json({ count: Items.length, items: Items });
  } catch (err) {
    log(`[GET /sensors] エラー: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /sensors/:sensor_name  センサー名で絞り込み ──
app.get("/sensors/:sensor_name", async (req, res) => {
  const { sensor_name } = req.params;
  try {
    const { Items } = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "sensor_name = :sn",
        ExpressionAttributeValues: { ":sn": sensor_name },
      })
    );
    return res.json({ count: Items.length, items: Items });
  } catch (err) {
    log(`[GET /sensors/:name] エラー: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /health ──
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ── 起動 ──
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  log(`[API] http://0.0.0.0:${PORT} で起動しました`);
  await ensureTable();
});
