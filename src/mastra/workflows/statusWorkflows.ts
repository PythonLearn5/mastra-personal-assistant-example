import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({
  id: 'step-1',
  inputSchema: z.object({ message: z.string() }),
  outputSchema: z.object({ formatted: z.string() }),
  stateSchema: z.object({ counter: z.number() }),
  execute: async ({ inputData, state, setState }) => {
    // Read from state
    console.log(state.counter)

    // Update state for subsequent steps
    setState({ ...state, counter: state.counter + 1 })

    return { formatted: inputData.message.toUpperCase() }
  },
})

const step2 = createStep({
  id: 'step-2',
  inputSchema: z.object({ formatted: z.string() }),
  outputSchema: z.object({ emphasized: z.string() }),
  stateSchema: z.object({ counter: z.number() }),
  execute: async ({ inputData, state, setState }) => {
    console.log(state.counter)
    // step2 · 接 step1 的 { formatted }，再加感叹号并递增 counter
    setState({ ...state, counter: state.counter + 1 });
    return { emphasized: `${inputData.formatted}!` };
  },
})

const childWorkflow = createWorkflow({
  id: "child-workflow",
  inputSchema: z.object({
    message: z.string()
  }),
  outputSchema: z.object({
    emphasized: z.string()
  })
})
  .then(step1)
  .then(step2)
  .commit();

export const testWorkflow = createWorkflow({
  id: "test-workflow",
  inputSchema: z.object({
    message: z.string()
  }),
  outputSchema: z.object({
    emphasized: z.string()
  })
})
  .then(childWorkflow)
  //.then(step1)
  //.then(step2)
  .commit();