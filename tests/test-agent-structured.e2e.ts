// ============================================================================
// e2e test · testAgent 结构化输出
// 运行 ：npx tsx tests/test-agent-structured.e2e.ts
// ============================================================================
import dotenv from "dotenv";
dotenv.config({ path: new URL("../.env.development", import.meta.url) });

if (!process.env.AI_GATEWAY_API_KEY) {
  console.error("❌ AI_GATEWAY_API_KEY not set.");
  process.exit(2);
}

import { z } from "zod";
import { testAgent } from "../src/mastra/agents/testAgent.ts";

/* const response = await testAgent.generate('Help me plan my day.', {
  structuredOutput: {
    schema: z.array(
      z.object({
        name: z.string(),
        activities: z.array(z.string()),
      }),
    ),
  },
})

console.log(response.object)
 */
/* const response2 = await testAgent.generate('Analyze the TypeScript programming language.', {
  structuredOutput: {
    schema: z.object({
      overview: z.string(),
      strengths: z.array(z.string()),
      weaknesses: z.array(z.string()),
      useCases: z.array(
        z.object({
          scenario: z.string(),
          reasoning: z.string(),
        }),
      ),
      comparison: z.object({
        similarTo: z.array(z.string()),
        differentiators: z.array(z.string()),
      }),
    })
  },
})

console.log(response2.object)
 */

const response3 = await testAgent.generate('Help me plan my day.', {
  structuredOutput: {
    schema: z.array(
      z.object({
        name: z.string(),
        activities: z.array(z.string()),
      }),
    ),
    // jsonPromptInjection · 控制 Mastra 把"请按这个 schema 输出 JSON"这段说明
    //   用什么方式注入到 prompt 里，以配合底层模型的结构化输出能力。
    //
    //   可选值：
    //     · 'system'     → 写入第一条 system 消息（最常见；模型每次都能看到）
    //     · 'inline'     → 追加到当前这条 user 消息的最后（适合"临时改 schema"场景）
    //     · 'append'     → 在消息末尾追加一条新 user 消息（不污染原 query）
    //     · false        → 完全不注入（只依赖 responseFormat.json_schema，适用于
    //                      GPT-4o 等模型原生支持 json_schema 的情况，省 token）
    //     · 'auto' (本处)→ Mastra 根据模型路由自动决策：
    //                         如果模型声明支持 native structured output（如 openai/gpt-4o）
    //                         → 选 false（交给模型原生 json_schema，提示更干净）；
    //                         否则 → 选 'system'（在 system 里补 schema dump）。
    //
    //   作用 ：在 "模型原生不支持 json_schema strict mode" 时，靠这段文本提示
    //          引导模型"自己"输出合法 JSON；在"原生支持"时，注入反而会浪费 token
    //          并可能引入模型把提示也输出的问题。大多数情况用 'auto' 就好。
    jsonPromptInjection: 'auto',
  },
})

console.log(response3.object)