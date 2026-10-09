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
})