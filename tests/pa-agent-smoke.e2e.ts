// ============================================================================
// Test 3 · Personal Assistant · Startup Smoke（走 AI Gateway，产生少量 API 费用）
//
// 目的 ：验证 MCP 服务器启动、工具注册、workflow 挂载、Memory 存储全链路 OK
// 前提 ：AI_GATEWAY_API_KEY 已配置（本脚本加载 .env.development）
// 运行 ：yarn test:pa-smoke
// ============================================================================
import dotenv from "dotenv";
dotenv.config({ path: new URL("../.env.development", import.meta.url) });

// dynamic import so MCP init logs come AFTER we print "starting…"
console.log("⏳ Loading personalAssistantAgent (MCP servers + Memory)...");
const { personalAssistantAgent } = await import("../src/mastra/agents/personalAssistantAgent.js");

console.log("✅ Agent loaded");
console.log(
  "   id=", (personalAssistantAgent as any).id ?? "<missing>",
  "  memory=", !!((personalAssistantAgent as any).memory),
  "  workflows=", Object.keys((personalAssistantAgent as any).workflows ?? {}),
);

const toolCount = Object.keys((personalAssistantAgent as any).tools ?? {}).length;
console.log("   tools registered:", toolCount);
console.log("   tool names (first 15):", Object.keys((personalAssistantAgent as any).tools ?? {}).slice(0, 15).join(", "));

if (toolCount < 3) {
  console.warn("⚠️  Expected HN + filesystem + weather = at least 3 tools.  MCP might not have connected.");
}

// Send a trivial greeting to verify stream loop + model inference work end-to-end.
console.log("\n🤖 Sending greeting (tiny inference cost)...");
const res = await personalAssistantAgent.generate(
  "你好，请用一句话自我介绍（不调用工具）。",
  { maxSteps: 1 },
);
console.log("✅ reply:", (res.text ?? "").replace(/\n/g, " ").slice(0, 300));
console.log("   finishReason=", (res as any).finishReason ?? "stop");
