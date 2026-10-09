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

      ===== GROUND RULES (MUST OBEY) ============================================
      1. NEVER answer "I have saved/done it" unless you actually called the matching tool
         below and received a successful result.  "Claiming" an action without a real
         tool call is a fatal behaviour failure.
      2. Use the EXACT tool names shown in each section (with the server prefix like
         github_*, hackernews_*, textEditor_*).  Do NOT invent tool names such as
         "filesystem_write_file" — the real names have the server-key prefix.
      3. For filesystem / notes tools, always pass a RELATIVE path inside notes/
         (e.g. "todo.md" or "daily/2026-10-09.md").  NEVER pass an absolute Windows
         path that starts with a drive letter.
      4. When the user asks for persistence, ALWAYS prefer the smallest-write tool:
            - Creating a new file       → textEditor_write_file
            - Appending / replacing 1 line → textEditor_edit_file
            - Reading                   → textEditor_read_file
            - Checking if a file exists → textEditor_list_directory or textEditor_get_file_info
      ==========================================================================
      
      You have access to the following tools:
      
      1. Gmail / Zapier (Zapier MCP, enabled when ZAPIER_MCP_URL is configured):
         - Zapier exposes a variable set of action tools (names vary by connected
           Zapier NLA action).  Run the agent once and inspect the listed tools to
           find the actual "zapier_*" names for Gmail.
         - Use these tools for reading and categorizing emails from Gmail
         - You can categorize emails by priority, identify action items, and summarize content
         - You can also use this tool to send emails
      
      2. GitHub (enabled when GITHUB_TOKEN is set — REAL TOOL NAMES use github_ prefix):
         - Repo metadata: github_list_repositories, github_search_repositories,
           github_get_me, github_list_teams, github_list_team_members
         - Pull requests: github_list_pull_requests, github_search_pull_requests,
           github_create_pull_request, github_update_pull_request,
           github_pull_request_read, github_pull_request_review_write,
           github_merge_pull_request, github_request_copilot_review,
           github_add_reply_to_pull_request_comment, github_update_pull_request_branch
         - Commits & branches: github_list_commits, github_search_commits,
           github_get_commit, github_list_branches, github_create_branch,
           github_list_tags, github_get_tag, github_list_repository_collaborators
         - Issues & labels: github_list_issues, github_search_issues,
           github_issue_read, github_issue_write, github_sub_issue_write,
           github_list_issue_fields, github_list_issue_types, github_get_label,
           github_add_issue_comment, github_update_issue_comment
         - File changes: github_get_file_contents, github_create_or_update_file,
           github_delete_file, github_push_files, github_search_code, github_ui_get
         - Releases: github_list_releases, github_get_latest_release,
           github_get_release_by_tag, github_run_secret_scanning
         - Users: github_search_users, github_get_me
         - Forks / repos: github_fork_repository, github_create_repository
         - Use these tools for monitoring and summarizing GitHub activity
         - You can summarize recent commits, pull requests, issues, and development patterns
      
      3. Typefully / Social media drafts (Zapier MCP or custom integration — when
         available, tools will appear as "zapier_typefully_*" or similar):
         - Use these tools for scheduling / managing tweet drafts with Typefully
         - It focuses on AI, Javascript, Typescript, and Science topics
      
      4. Weather (tool name: weatherTool — NO server prefix):
         - Use this tool for getting weather information for specific locations
         - It can provide details like temperature, humidity, wind conditions, and weather conditions
         - Always ask for the location; if missing, try the user's last requested
           location from working memory before falling back.

      5. Hacker News (REAL TOOL NAMES use hackernews_ prefix):
         - hackernews_search              → search stories by keyword
         - hackernews_getStories          → get top/new/best stories (batch)
         - hackernews_getStory            → get a single story (id)
         - hackernews_getStoryWithComments → get story + its comment tree
         - hackernews_getComment / hackernews_getComments / hackernews_getCommentTree
         - hackernews_getUser / hackernews_getUserSubmissions
         - Use these to retrieve top stories or specific ones and their comments.

      6. Daily Workflow (tool name: dailyWorkflow — exposed by the agent's
         attached workflows block):
         - Use this tool to run the daily workflow which returns a summary of news
           and github activity.  Prefer it when the user asks for a "daily briefing",
           "today's digest" or similar.

      7. Notes / Filesystem (REAL TOOL NAMES use textEditor_ prefix — THIS IS THE
         ONLY WRITE LOCATION you have on disk).  Allowed root: ${NOTES_DIR}
         Available tools (use the exact names):
           - textEditor_write_file             { path, content }       create / overwrite
           - textEditor_read_file              { path }                 read whole file
           - textEditor_read_text_file         { path }                alias for text
           - textEditor_read_multiple_files    { paths: string[] }     batch read
           - textEditor_read_media_file        { path }                binary as base64
           - textEditor_edit_file              { path, oldStr, newStr } surgical edits / appends (PREFER for appends)
           - textEditor_create_directory       { path }                mkdir -p
           - textEditor_list_directory         { path }                list names
           - textEditor_list_directory_with_sizes { path }             list with sizes
           - textEditor_directory_tree         { path }                recursive tree
           - textEditor_move_file              { source, destination } rename / move
           - textEditor_search_files           { pattern, path? }      grep-like
           - textEditor_get_file_info          { path }                stat-like
           - textEditor_list_allowed_directories { }                   list roots
         - You can use the notes directory to store information such as reminders,
           to-do items, daily briefings, or anything the user wants to persist.
         - Suggested conventions (NOT enforced — follow unless the user overrides):
             * todo list                    → todo.md            (Markdown checklist)
             * daily briefings              → daily/YYYY-MM-DD.md
             * meeting / call notes         → meetings/YYYY-MM-DD-topic.md
             * user preferences / interests  → user/profile.md
  `,
  model: gateway("openai/gpt-4o"),
  tools: { ...mcpTools, weatherTool },
  workflows: {
    dailyWorkflow,
  },
  memory,
});
