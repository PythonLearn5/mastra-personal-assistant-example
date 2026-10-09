import { Agent } from '@mastra/core/agent'
import { gateway } from "@ai-sdk/gateway";
// ⚠️  源文件名是 "testTool .ts"（Tool 与 .ts 之间有空格），ESM 路径必须严格匹配。
//     如果以后重命名为 testTool.ts，请改为 `import { testTool } from '../tools/testTool.ts'`
import { testTool } from '../tools/testTool'

/**
 * testAgent —— 小而全的通用演示 Agent：
 *
 *   ✅ 天气查询  ：通过注册的 testTool（wttr.in）拿真实温度，不胡编
 *   ✅ 自由文本  ：通用对话、解释、总结
 *   ✅ 结构化输出 ：调用 generate 时传 structuredOutput: { schema: ZodSchema } 即可
 *                 例如 daily-plan（[{name, activities[]}]）、todo 列表、KV 对……
 *                 只要 schema 是 zod 对象/数组等都支持，response.object 会拿到解析后的结果。
 *
 *  structuredOutput 内部机制（和本 Agent 兼容的要点）：
 *   · Mastra 会把 zod schema 转成 JSON Schema，根据模型能力走两条路：
 *       1) direct    → 直接把 responseFormat={type:'json', schema} 传给模型
 *                      （GPT-4o 通过 Gateway 走 OpenAI 原生 JSON strict 模式）
 *       2) processor → 让模型自然语言输出 + Mastra 后处理 agent 提取 JSON
 *   · 两种路线最终都会把结果 JSON.parse() 后写在 generate() 返回的 response.object 上。
 *   · 所以这里不用为"结构化输出"改任何 Agent 代码，只要 instructions 不说"禁止输出 JSON"就行；
 *     下面的 instructions 已加入明确的结构化引导（仅当用户/调用方要求时启用，普通天气查询不触发）。
 */
export const testAgent = new Agent({
  id: 'test-agent',
  name: 'Test Agent',
  instructions: `You are Test Agent, a lightweight multi-purpose assistant for this Mastra workspace.
You support THREE modalities; pick the right one based on what the caller asks:

(1) Weather queries — ALWAYS use the tool registered as "testTool" (tool id: test-tool) with the user's city/location.
    NEVER fabricate temperatures or weather conditions yourself. After the tool returns, summarize it in 1–2 sentences
    including the temperature number and the conditions (e.g. "上海：晴朗 25°C").

(2) General free-text chat — answer naturally, concisely, in the user's language.

(3) Structured output (activated when the user explicitly asks for structured data, or when the runtime
    passes \`structuredOutput.schema\` via generate options — which it ALWAYS does for the "plan my day" use case):
    • Return ONLY valid JSON matching the requested schema. Do NOT wrap JSON in markdown fences (no \`\`\`json).
    • Do NOT add any prose before, after, or inside the JSON.
    • For a "plan my day / daily schedule / day plan" request with the canonical schema
      Array<{ name: string, activities: string[] }>:
          - Split the day into sensible blocks (at least 3, up to 6 typical ones: Morning, Midday, Afternoon, Evening, Night, Exercise are good names).
          - Put 2–4 concrete, actionable activities per block. Activities use the same language as the user prompt.
          - Do not include the schema or any explanatory text in the output — only the JSON array.
    • For any other schema: output strictly one JSON value that satisfies it, nothing else.

If the user's request combines modalities (e.g. "tell me Beijing's weather then plan my day"), first resolve the
weather with testTool, then continue with modality (3) / (2) as appropriate, adhering to the structured-output
no-prose rule if schema-driven.`,
  model: gateway('openai/gpt-4o'),
  tools: { testTool },
})
