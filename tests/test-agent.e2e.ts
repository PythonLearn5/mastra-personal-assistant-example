// ============================================================================
// Simple e2e test · testAgent (1 city, 1 generate call)
//
// 用途 ：1 个地点 → 1 次 agent.generate() → 打印回复与调用工具情况
// 费用 ：~0.0005 USD / run（走 AI Gateway → GPT-4o）
// 运行 ：npx tsx tests/test-agent.e2e.ts
// ============================================================================
import dotenv from "dotenv";
dotenv.config({ path: new URL("../.env.development", import.meta.url) });

if (!process.env.AI_GATEWAY_API_KEY) {
  console.error("❌ AI_GATEWAY_API_KEY not set.");
  process.exit(2);
}

import { testAgent } from "../src/mastra/agents/testAgent.ts";

const res: any = await testAgent.generate("上海现在的天气怎么样？一句话回答，包含温度数字和天气状况。", { maxSteps: 4 });

console.log(`reply: ${(res.text ?? "").trim()}`);
console.log(`toolCalls=${res.toolCalls?.length ?? 0}  toolResults=${res.toolResults?.length ?? 0}  finishReason=${res.finishReason ?? "stop"}`);

const ok = /\d/.test(res.text ?? "");
process.exit(ok ? 0 : 1);
