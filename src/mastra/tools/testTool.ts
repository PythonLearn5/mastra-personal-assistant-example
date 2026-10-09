import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const testTool = createTool({
  id: 'test-tool',
  description: 'Fetches weather for a location',
  inputSchema: z.object({
    location: z.string(),
  }),
  outputSchema: z.object({
    location: z.string(),
    temperatureCelsius: z.number(),
    conditions: z.string(),
  }),
  execute: async ({ location }, { abortSignal }) => {
    const response = await fetch(`https://wttr.in/${location}?format=j1`, {
      signal: abortSignal,
    })
    const data = await response.json()

    return {
      location,
      temperatureCelsius: Number(data.current_condition[0].temp_C),
      conditions: data.current_condition[0].weatherDesc[0].value,
    }
  },

  // toModelOutput · 最小示例
  //   入参：execute 的真实返回值（已 Zod 校验）
  //   时机：仅 agent.generate/stream 回填给模型时调用，tool.execute() 不触发
  //   效果：模型只看到这里返回的精简版；应用层仍拿到 {location, temperatureCelsius, conditions}
  //   返回：推荐 {type:'content', value:[{type:'text',text}]}，兼容所有 provider
  //         （裸 string 在 Vercel AI Gateway / OpenAI 下会 400）
  toModelOutput: (output) => ({
    type: 'content',
    value: [
      {
        type: 'text',
        text: `${output.location}: ${output.temperatureCelsius}°C, ${output.conditions}`,
      },
    ],
  }),
});
