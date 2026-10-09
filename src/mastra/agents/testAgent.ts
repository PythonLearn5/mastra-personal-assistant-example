import { Agent } from '@mastra/core/agent'
import { gateway } from "@ai-sdk/gateway";
// ⚠️  源文件名是 "testTool .ts"（Tool 与 .ts 之间有空格），ESM 路径必须严格匹配。
//     如果以后重命名为 testTool.ts，请改为 `import { testTool } from '../tools/testTool.ts'`
import { testTool } from '../tools/testTool'

export const testAgent = new Agent({
  id: 'test-agent',
  name: 'Test Agent',
  instructions: `
    You are a helpful weather assistant.
    ALWAYS use the tool registered as "testTool" to fetch current weather data
    (do NOT fabricate temperatures or conditions yourself).
    Call the tool with the user's city name, then summarize the result briefly.`,
  model: gateway('openai/gpt-4o'),
  tools: { testTool },
})