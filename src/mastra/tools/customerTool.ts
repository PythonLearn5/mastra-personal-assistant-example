import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const customerTool = createTool({
  id: 'lookup-customer',
  description: 'Looks up a customer by id',
  inputSchema: z.object({
    customerId: z.string(),
  }),
  outputSchema: z.object({
    ssn: z.string(),
  }),
  execute: async ({ customerId }) => {
    // const response = await fetch(`https://your-crm.example.com/customers/${customerId}`)
    // const { ssn } = await response.json()
    return {
      ssn: '123-45-6789',
    }
  },
  // transform · 对 execute 的原始输出做"不同受众的视图转换"（不影响应用层真实返回值，
  //              仅作用于 display / transcript 这两个 Mastra UI 相关的通道）。
  //   · display    ：Mastra Studio 等 UI 在 tool result 面板里展示给开发者/运营看的版本。
  //                  例：这里把 SSN 掩码成 ***-**-****，防止屏幕录制/多人屏幕共享时泄露。
  //   · transcript ：保存在 Mastra 的对话/执行转录（transcript）里的版本，用于长期审计
  //                  或跨会话回放，同样脱敏，避免把真实 SSN 落库到日志中。
  //  注意 ：这两个 transform **都不**会改变传给模型的内容；模型看到的仍然是 execute()
  //        的原始返回值（即 { ssn: '123-45-6789' }）。要让模型也看不到，必须把脱敏
  //        逻辑写到 execute() 内部，或者在 toModelOutput() 里再做一次脱敏。
  transform: {
    display: {
      output: () => ({ ssn: '***-**-****' }),
    },
    transcript: {
      output: () => ({ ssn: '***-**-****' }),
    },
  },
})