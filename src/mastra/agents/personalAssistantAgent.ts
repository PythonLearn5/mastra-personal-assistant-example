import { gateway } from "@ai-sdk/gateway";
import { Agent } from "@mastra/core/agent";
import { weatherTool } from "../tools";
import { Memory } from "@mastra/memory";
import { MCPClient } from "@mastra/mcp";
import path from "node:path";
import fs from "node:fs";
import { LibSQLStore } from "@mastra/libsql";
import { dailyWorkflow } from "../workflows";

// Resolve project root from runtime CWD (Mastra CLI sets CWD to project root
// before loading the bundled ESM, so this is reliable both in dev and prod).
const PROJECT_ROOT = process.cwd();
const NOTES_DIR = path.join(PROJECT_ROOT, "notes");
const MASTRA_DB_PATH = path.join(PROJECT_ROOT, "mastra.db");

// Ensure notes dir exists so filesystem MCP can serve it.  (Mastra bundles ESM
// and runs from under .mastra/output/, so process.cwd() cannot be trusted.)
try {
  if (!fs.existsSync(NOTES_DIR)) fs.mkdirSync(NOTES_DIR, { recursive: true });
} catch (e) {
  console.warn("[MCP] Failed to ensure notes directory exists:", e);
}

// ---------------------------------------------------------------------------
// MCP servers: conditionally register based on configured env vars.
// Missing / placeholder values are skipped instead of crashing the runtime.
// ---------------------------------------------------------------------------
const servers: Record<string, any> = {
  hackernews: {
    command: "npx",
    args: ["-y", "@devabdultech/hn-mcp-server"],
  },
};

// Only register textEditor when the notes directory is actually reachable.
let textEditorAccessible = false;
try {
  if (fs.existsSync(NOTES_DIR) && fs.statSync(NOTES_DIR).isDirectory()) {
    fs.accessSync(NOTES_DIR, fs.constants.R_OK | fs.constants.W_OK);
    textEditorAccessible = true;
  }
} catch {
  textEditorAccessible = false;
}

if (textEditorAccessible) {
  servers.textEditor = {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", NOTES_DIR],
  };
} else {
  console.warn(`[MCP] Skipping textEditor MCP: notes dir not usable (${NOTES_DIR})`);
}

if (process.env.ZAPIER_MCP_URL && process.env.ZAPIER_MCP_URL !== "your_zapier_mcp_url") {
  try {
    servers.zapier = {
      url: new URL(process.env.ZAPIER_MCP_URL),
    };
  } catch (e) {
    console.warn("[MCP] Skipping Zapier MCP: invalid ZAPIER_MCP_URL");
  }
}

if (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN !== "your_github_token") {
  servers.github = {
    url: new URL("https://api.githubcopilot.com/mcp"),
    requestInit: {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      },
    },
  };
} else {
  console.warn("[MCP] Skipping GitHub MCP: GITHUB_TOKEN not configured");
}

const mcp = new MCPClient({ servers });

let mcpTools: Record<string, any> = {};
try {
  mcpTools = await mcp.listTools();
} catch (err: any) {
  console.warn(
    "[MCP] Failed to get MCP tools, continuing without MCP tools:",
    err?.message || err
  );
}

// ---------------------------------------------------------------------------
// Memory: conversation history + working memory template
// ---------------------------------------------------------------------------
const memory = new Memory({
  storage: new LibSQLStore({
    id: "personalAssistant-store",
    url: `file:${MASTRA_DB_PATH}`,
  }),
  options: {
    lastMessages: 20,
    workingMemory: {
      enabled: true,
      template: `<user>
          <first_name></first_name>
          <username></username>
          <preferences></preferences>
          <interests></interests>
          <conversation_style></conversation_style>
        </user>`,
    },
  },
});

export const personalAssistantAgent = new Agent({
  id: "personalAssistantAgent",
  name: "Personal Assistant",
  instructions: `
      You are a helpful personal assistant that can help with various tasks such as email, 
      monitoring github activity, scheduling social media posts and providing weather information.
      
      You have access to the following tools:
      
      1. Gmail:
         - Use these tools for reading and categorizing emails from Gmail
         - You can categorize emails by priority, identify action items, and summarize content
         - You can also use this tool to send emails
      
      2. GitHub:
         - Use these tools for monitoring and summarizing GitHub activity
         - You can summarize recent commits, pull requests, issues, and development patterns
      
      3. Typefully:
         - Use these tools for 
         - It can also create and manage tweet drafts with Typefully
         - It focuses on AI, Javascript, Typescript, and Science topics
      
      4. Weather:
         - Use this tool for getting weather information for specific locations
         - It can provide details like temperature, humidity, wind conditions, and weather conditions
         - Always ask for the location or if it's not provided try to use your working memory 
           to get the user's last requested location

      5. Hackernews:
         - Use this tool to search for stories on Hackernews
         - You can use it to get the top stories or specific stories
         - You can use it to retrieve comments for stories

      6. Daily Workflow:
         - Use this tool to run the daily workflow which returns a summary of news and github activity

      7. Filesystem:
         - You also have filesystem read/write access to a notes directory. 
         - You can use that to store information such as reminders for later use or organize info for the user.
         - You can use this notes directory to keep track of to do list items for the user.
         - Notes dir: ${NOTES_DIR}
  `,
  model: gateway("openai/gpt-4o"),
  tools: { ...mcpTools, weatherTool },
  workflows: {
    dailyWorkflow,
  },
  memory,
});
