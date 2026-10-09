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
  "  memory=", !!(((personalAssistantAgent as any).memory) ?? (typeof (personalAssistantAgent as any).listTools === "function")),
  "  workflows=", Object.keys((await (personalAssistantAgent as any).listWorkflows?.()) ?? ((personalAssistantAgent as any).workflows) ?? {}),
);

// Mastra v1: 工具必须用异步 agent.listTools() 拿（同步的 .tools 属性不再存在）。
// 这个函数会合并 MCP / workflow / memory 等工具，并给 MCP 工具自动加上 <server>_ 前缀。
const listedTools: Record<string, any> = (await (personalAssistantAgent as any).listTools?.()) ?? (personalAssistantAgent as any).tools ?? {};
const toolNames = Object.keys(listedTools);
const toolCount = toolNames.length;
console.log("   tools registered:", toolCount);
console.log("   tool names (first 15):", toolNames.slice(0, 15).join(", "));

// 快速前缀分布（一眼能看出 textEditor_/hackernews_/github_ 三个 MCP namespace 是否都连上了）
const prefixCount = new Map<string, number>();
for (const n of toolNames) {
  const p = n.includes("_") ? n.slice(0, n.indexOf("_")) : "(no-prefix)";
  prefixCount.set(p, (prefixCount.get(p) ?? 0) + 1);
}
console.log("   前缀分布:", [...prefixCount.entries()].map(([p, c]) => `${p}×${c}`).join(", "));

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
