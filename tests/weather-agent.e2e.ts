// ============================================================================
// Test 2 · WeatherAgent 端到端测试（走 AI Gateway → GPT-4o，产生少量 API 费用）
//
// 目的 ：验证 Agent 能正确 decide→call tool→use result→summarize
// 前提 ：.env.development 中 AI_GATEWAY_API_KEY 必须已配置（本脚本显式加载）
// 费用 ：~0.0003 USD / run
// 运行 ：yarn test:weather-agent
// ============================================================================
import dotenv from "dotenv";
dotenv.config({ path: new URL("../.env.development", import.meta.url) });

import { weatherAgent } from "../src/mastra/agents/weatherAgent.js";

if (!process.env.AI_GATEWAY_API_KEY) {
  console.error("❌ AI_GATEWAY_API_KEY not set.  Check .env.development exists & has the key.");
  process.exit(2);
}

const queries = [
  { loc: "上海天气？一句话中文回答，含温度和状况。", expect: /2\d|阴天|晴|雨|多云/ },
  { loc: "What's London weather now? Reply in 1 short English sentence.", expect: /temperature|degrees|C|cloud|rain|sunny|overcast/i },
];

for (const { loc, expect } of queries) {
  process.stdout.write(`\n💬  Q: ${loc}\n`);
  const res = await weatherAgent.generate(loc, { maxSteps: 4 });
  const ok = expect.test(res.text ?? "");
  console.log(`   ${ok ? "✅" : "❌"}  A: ${res.text?.replace(/\n/g, " ") ?? ""}`);
  console.log(`       toolCalls=${res.toolCalls?.length ?? 0}  toolResults=${res.toolResults?.length ?? 0}  textLen=${res.text?.length ?? 0}`);
}
