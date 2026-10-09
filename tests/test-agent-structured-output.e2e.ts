// ============================================================================
// e2e test · testAgent 结构化输出
//
// 验证 ：testAgent.generate('Help me plan my day.', { structuredOutput }) 的
//        response.object 真的是 Zod parse 通过的 Array<{name, activities: string[]}>。
// 费用 ：~0.0005 USD / run（GPT-4o + JSON strict）
// 运行 ：npx tsx tests/test-agent-structured-output.e2e.ts
// ============================================================================
import dotenv from "dotenv";
dotenv.config({ path: new URL("../.env.development", import.meta.url) });

if (!process.env.AI_GATEWAY_API_KEY) {
  console.error("❌ AI_GATEWAY_API_KEY not set.");
  process.exit(2);
}

import { z } from "zod";
import { testAgent } from "../src/mastra/agents/testAgent.ts";

// —— 用户示例里的 schema，一字不差保留（数组外层包，子对象是 {name, activities: string[]}）
const DayPlanSchema = z.array(
  z.object({
    name: z.string(),
    activities: z.array(z.string()),
  }),
);

const SCHEMA_NAME = "DayPlan";

console.log(`🤖 testAgent.id   =`, (testAgent as any).id ?? "<missing>");
console.log(`📐 schema         = z.array(z.object({ name, activities: z.array(z.string()) }))`);
console.log(`💬 query          = Help me plan my day.\n`);

const started = Date.now();
process.stdout.write("▶️  generate  ");

// 按用户给出的调用方式一字不差：generate(query, { structuredOutput: { schema } })
const res: any = await testAgent.generate("Help me plan my day.", {
  structuredOutput: {
    schema: DayPlanSchema,
    // 可选：structuredOutput.name / description 可以给模型（Mastra 透传到 OpenAI JSON schema name）
    // 这里不填也能用。
  },
  maxSteps: 4,
});

console.log(`(${Date.now() - started}ms)`);

const text = (res.text ?? "").trim();
console.log(`\n💡 reply.text (${text.length} chars, first 200):\n   ${text.slice(0, 200)}${text.length > 200 ? "…" : ""}`);
console.log(`   text 全是 JSON? ${/^\s*[[{]/.test(text) && /[\]}]\s*$/.test(text) ? "大概是" : "可能混入了说明文本"}`);

// ------------------------------------------------------------
// 核心断言：response.object 存在 + Zod parse 通过
// ------------------------------------------------------------
console.log(`\n🧪 response.object 校验（DayPlanSchema safeParse）：`);
const obj = res.object;
console.log(`   typeof object  =`, typeof obj);
console.log(`   isArray?       =`, Array.isArray(obj));
console.log(`   length         =`, Array.isArray(obj) ? obj.length : "n/a");

let okParse = false;
if (obj === undefined || obj === null) {
  console.error(`   ❌ response.object = ${String(obj)} —— Mastra 没拿到结构化结果（常见：网关不转发 responseFormat.json_schema，或模型输出了 markdown fence，JSON.parse 失败）。看 reply.text 内容是否含 markdown。`);
  okParse = false;
} else {
  const parsed = DayPlanSchema.safeParse(obj);
  if (!parsed.success) {
    okParse = false;
    console.error(`   ❌ Zod safeParse FAIL`);
    const issues = parsed.error.issues;
    for (const iss of issues.slice(0, 8)) console.log(`      · path=${JSON.stringify(iss.path)}  message=${iss.message}`);
    if (issues.length > 8) console.log(`      · …（还有 ${issues.length - 8} 条错误）`);
    console.log(`      对象预览: ${JSON.stringify(obj, null, 2).slice(0, 600)}`);
  } else {
    okParse = true;
    const data = parsed.data;
    console.log(`   ✅ Zod safeParse PASS（${data.length} blocks）`);
    for (let i = 0; i < Math.min(6, data.length); i++) {
      const b = data[i];
      console.log(`      [${i + 1}] ${b.name}  ·  ${b.activities.length} 个活动：${b.activities.slice(0, 3).join(" / ")}${b.activities.length > 3 ? ` (+${b.activities.length - 3})` : ""}`);
    }
  }
}

// 附加：object 与 text 的一致性（当两个都存在时，对比 text JSON 是否等价）
console.log(`\n📝 附加一致性检查：`);
if (text && obj !== undefined && obj !== null) {
  try {
    const textJson = JSON.parse(text);
    const eq = JSON.stringify(textJson) === JSON.stringify(obj);
    console.log(`   text JSON 与 object JSON 完全一致？  ${eq ? "✅ 是" : "⚠️  否（Mastra 可能对 JSON 做过重排或 processor 阶段重写，不影响使用）"}`);
  } catch {
    console.log(`   ⚠️  text 本身不是纯 JSON（模型可能在 JSON 前后加了说明文字，属正常；Mastra 仍能拿到 object）`);
  }
}

console.log(`\n${okParse ? "🎉 OVERALL PASS" : "💥 OVERALL FAIL"}`);
process.exit(okParse ? 0 : 1);
