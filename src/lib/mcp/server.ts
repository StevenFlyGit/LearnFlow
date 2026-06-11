import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function buildMcpServer(_userId: string): McpServer {
  const server = new McpServer({ name: "learnflow-mcp", version: "1.0.0" });

  // Tool: list_domains — list all learning domains
  server.tool(
    "list_domains",
    "List all learning domains in LearnFlow",
    {},
    async () => ({
      content: [{ type: "text" as const, text: "Domains are stored in the browser's IndexedDB. Use the LearnFlow web app to manage domains." }],
    })
  );

  // Tool: get_today_tasks — describe today's learning tasks
  server.tool(
    "get_today_tasks",
    "Get today's learning tasks across all domains",
    {},
    async () => ({
      content: [{ type: "text" as const, text: "Today's tasks are computed from nodes with in_progress status or startDate <= today. Open the LearnFlow Daily Dashboard to see them." }],
    })
  );

  // Tool: generate_learning_plan — suggest a learning plan for a domain
  server.tool(
    "generate_learning_plan",
    "Generate a structured learning plan for a given topic",
    { topic: z.string().describe("The topic or domain to learn"), dailyHours: z.number().optional().describe("Daily hours available (default: 2)") },
    async ({ topic, dailyHours = 2 }) => ({
      content: [{ type: "text" as const, text: `To generate a learning plan for "${topic}" (${dailyHours}h/day), open LearnFlow, create a new domain, and click "AI 生成知识树". The AI will produce a hierarchical knowledge tree tailored to your schedule.` }],
    })
  );

  // Tool: sync_to_notion — guide Notion sync
  server.tool(
    "sync_to_notion",
    "Guide the user to sync their knowledge tree to Notion",
    {},
    async () => ({
      content: [{ type: "text" as const, text: "To sync to Notion: 1) Configure your Notion Integration Token in the Token Config page, 2) Go to the Notion Sync page, 3) Select nodes to sync, 4) Click Sync." }],
    })
  );

  // Tool: search_rss_by_topic — RSS search guidance
  server.tool(
    "search_rss_by_topic",
    "Find RSS articles related to a learning topic",
    { topic: z.string().describe("The topic keyword to search for") },
    async ({ topic }) => ({
      content: [{ type: "text" as const, text: `To find RSS articles about "${topic}": open the RSS page in LearnFlow and use the search bar to filter articles by keyword. You can also find related RSS links when editing a knowledge node's notes.` }],
    })
  );

  return server;
}
