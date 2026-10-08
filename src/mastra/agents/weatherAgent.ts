import { gateway } from "@ai-sdk/gateway";
import { Agent } from "@mastra/core/agent";
import { weatherTool } from "../tools";

export const weatherAgent = new Agent({
  id: "weatherAgent",
  name: "Weather Agent",
  instructions: `
      You are a helpful personal assistant that can help with the weather.
  `,
  model: gateway("openai/gpt-4o"),
  tools: { weatherTool },
});
