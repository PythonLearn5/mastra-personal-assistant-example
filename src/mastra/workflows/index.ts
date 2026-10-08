import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

/**
 * Step 1: Fetch latest HN stories via personalAssistantAgent
 */
const fetchLatestHackerNewsStep = createStep({
  id: "fetch-latest-hacker-news",
  description: "Fetches the latest Hacker News stories with the Personal Assistant",
  inputSchema: z.object({}),
  outputSchema: z.object({
    hnData: z.string(),
  }),
  execute: async ({ mastra, getStepResult }) => {
    const agent = mastra.getAgent("personalAssistantAgent");
    const prompt = `
      Use the Hacker News tools available to search for 5 latest stories about:
      - AI
      - TypeScript
      - Javascript
      
      Return only the stories as a summary in markdown format. 
      If there are no stories, return "No Hacker News stories found".
    `;
    const result = await agent.generate(prompt, { maxSteps: 10 });

    return {
      hnData: result.text ?? "No Hacker News stories found",
    };
  },
});

/**
 * Step 2: Fetch recent GitHub activity via personalAssistantAgent
 */
const fetchLatestGithubActivityStep = createStep({
  id: "fetch-latest-github-activity",
  description: "Fetches the latest GitHub activity with the Personal Assistant",
  inputSchema: z.object({}),
  outputSchema: z.object({
    githubData: z.string(),
  }),
  execute: async ({ mastra, getStepResult }) => {
    const agent = mastra.getAgent("personalAssistantAgent");
    const { hnData } = getStepResult(fetchLatestHackerNewsStep) as { hnData: string };
    const prompt = `
      Monitor GitHub for recent activity using the GitHub tools.
      
      Look for:
      1. Recent commits
      2. Pull requests
      3. Issues
      
      Summary should be formatted in markdown.

      Here is the latest data from the Hacker News step:
      ${hnData}

      If you cannot find any GitHub activity, return "No GitHub activity found".
    `;
    const result = await agent.generate(prompt, { maxSteps: 10 });

    return {
      githubData: result.text ?? "No GitHub activity found",
    };
  },
});

/**
 * Step 3: Produce a combined daily digest
 */
const produceDailyDigestStep = createStep({
  id: "produce-daily-digest",
  description: "Produces the daily digest based on the daily workflow steps",
  inputSchema: z.object({}),
  outputSchema: z.object({
    dailyDigest: z.string(),
  }),
  execute: async ({ getStepResult }) => {
    const { hnData } = getStepResult(fetchLatestHackerNewsStep) as { hnData: string };
    const { githubData } = getStepResult(fetchLatestGithubActivityStep) as {
      githubData: string;
    };

    return {
      dailyDigest: `
# Daily Digest

## Latest Hacker News
${hnData}

## Recent GitHub Activity
${githubData}
      `.trim(),
    };
  },
});

/**
 * Workflow: chains steps above
 */
export const dailyWorkflow = createWorkflow({
  id: "daily-workflow",
  description:
    "This workflow gets all the data needed for a personal assistant to send a daily briefing",
  inputSchema: z.object({
    firstName: z.string(),
  }),
  outputSchema: z.object({
    email: z.string(),
    subject: z.string(),
  }),
  schedule: {
    cron: "0 8 * * *", // Every day at 8am
  },
})
  .then(fetchLatestHackerNewsStep)
  .then(fetchLatestGithubActivityStep)
  .then(produceDailyDigestStep)
  .commit();
