import { Tool, ToolDefinition, ToolContext, ToolResult } from "../types";
import { config } from "../../config";
import { logger } from "../../utils/logger";

export class WebSearchTool implements Tool {
  definition: ToolDefinition = {
    name: "web_search",
    description:
      "Search the web using DuckDuckGo (or SearXNG if configured). Returns titles, URLs, and snippets.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query",
        },
        count: {
          type: "string",
          description: "Number of results (default 5, max 10)",
        },
      },
      required: ["query"],
    },
  };

  async execute(
    args: Record<string, unknown>,
    _ctx: ToolContext,
  ): Promise<ToolResult> {
    const query = String(args.query);
    const count = Math.min(parseInt(String(args.count ?? "5"), 10), 10);

    // Use SearXNG if configured, otherwise DuckDuckGo HTML search
    if (config.searxngUrl) {
      return this.searchSearXNG(query, count);
    }
    return this.searchDuckDuckGo(query, count);
  }

  private async searchDuckDuckGo(
    query: string,
    count: number,
  ): Promise<ToolResult> {
    try {
      // DuckDuckGo instant answer API (free, no key)
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;
      const response = await fetch(url);
      const data = await response.json() as any;

      const results: any[] = [];

      // Abstract (main answer)
      if (data.Abstract) {
        results.push({
          title: data.Heading,
          url: data.AbstractURL,
          snippet: data.Abstract,
        });
      }

      // Related topics
      for (const topic of (data.RelatedTopics ?? []).slice(0, count)) {
        if (topic.Text) {
          results.push({
            title: topic.Text?.substring(0, 80),
            url: topic.FirstURL,
            snippet: topic.Text,
          });
        }
      }

      if (results.length === 0) {
        // Fallback: use DuckDuckGo Lite HTML scraping
        return this.searchDDGLite(query, count);
      }

      return { success: true, data: results };
    } catch (err) {
      logger.error({ err }, "DuckDuckGo search failed");
      return {
        success: false,
        error: `Search failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  private async searchDDGLite(
    query: string,
    count: number,
  ): Promise<ToolResult> {
    try {
      const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "NPBot/1.0",
        },
      });
      const html = await response.text();

      // Extract result links and snippets from DDG Lite HTML
      const results: any[] = [];
      const linkRegex = /<a[^>]+class="result-link"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
      const snippetRegex = /<td class="result-snippet">([^<]+)<\/td>/g;

      let linkMatch;
      const links: { url: string; title: string }[] = [];
      while ((linkMatch = linkRegex.exec(html)) !== null) {
        links.push({ url: linkMatch[1], title: linkMatch[2].trim() });
      }

      let snippetMatch;
      const snippets: string[] = [];
      while ((snippetMatch = snippetRegex.exec(html)) !== null) {
        snippets.push(snippetMatch[1].trim());
      }

      for (let i = 0; i < Math.min(links.length, count); i++) {
        results.push({
          title: links[i].title,
          url: links[i].url,
          snippet: snippets[i] ?? "",
        });
      }

      return {
        success: true,
        data: results.length > 0 ? results : "No results found",
      };
    } catch (err) {
      return {
        success: false,
        error: `Search failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  private async searchSearXNG(
    query: string,
    count: number,
  ): Promise<ToolResult> {
    try {
      const url = `${config.searxngUrl}/search?q=${encodeURIComponent(query)}&format=json&engines=google,bing,duckduckgo`;
      const response = await fetch(url);
      const data = await response.json() as any;

      const results = (data.results ?? []).slice(0, count).map((r: any) => ({
        title: r.title,
        url: r.url,
        snippet: r.content,
      }));

      return { success: true, data: results };
    } catch (err) {
      return {
        success: false,
        error: `SearXNG search failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
