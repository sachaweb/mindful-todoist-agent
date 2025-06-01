
import { TodoistTask } from "../../types";
import { logger } from "../../utils/logger";
import { supabase } from "@/integrations/supabase/client";

export class ResponseGenerator {
  public async generateConversationalResponse(
    message: string, 
    tasks: TodoistTask[], 
    conversationHistory: Array<{ role: string; content: string }>
  ): Promise<string> {
    const systemPrompt = this.buildConversationalPrompt(tasks);

    logger.logClaudeRequest({
      message,
      tasksCount: tasks.length,
      systemPromptLength: systemPrompt.length,
      conversationHistoryLength: conversationHistory.length
    });

    const { data, error } = await supabase.functions.invoke('claude-proxy', {
      body: {
        message,
        tasks: [...tasks],
        systemPrompt,
        conversationHistory
      }
    });

    if (error) {
      logger.error('RESPONSE_GENERATOR', 'Edge Function error', error);
      throw new Error(`Edge Function error: ${error.message}`);
    }

    if (!data.success) {
      logger.error('RESPONSE_GENERATOR', 'Claude proxy error', data.error);
      throw new Error(`Claude API error: ${data.error}`);
    }

    logger.logClaudeResponse(data);
    return data.response;
  }

  private buildConversationalPrompt(tasks: TodoistTask[]): string {
    const taskList = tasks.length > 0 
      ? tasks.map(t => `- ${t.content}${t.due ? ` (due: ${t.due.string || t.due.date})` : ''} [Priority: ${t.priority}]`).join('\n')
      : "No open tasks";

    return `You are a helpful Todoist task management assistant. You can help users manage their tasks using natural language.

Current open tasks:
${taskList}

You should be conversational and helpful. Answer questions about tasks, provide productivity advice, and help users understand their workload. 

DO NOT provide task creation instructions in your responses - the system handles task operations separately.

Keep responses concise but friendly.`;
  }

  public analyzeTasks(tasks: TodoistTask[]): string[] {
    const suggestions: string[] = [];

    if (!tasks || tasks.length === 0) {
      return ["You don't have any open tasks. Would you like to create one?"];
    }

    const urgentTasks = tasks.filter(t => t.priority === 4);
    const dueTodayTasks = tasks.filter(t => {
      if (!t.due) return false;
      const today = new Date().toDateString();
      const taskDate = new Date(t.due.date).toDateString();
      return today === taskDate;
    });

    if (urgentTasks.length > 0) {
      suggestions.push(`You have ${urgentTasks.length} high-priority tasks to focus on.`);
    }

    if (dueTodayTasks.length > 0) {
      suggestions.push(`You have ${dueTodayTasks.length} tasks due today.`);
    }

    if (tasks.length > 10) {
      suggestions.push("You have quite a few open tasks. Would you like help prioritizing them?");
    }

    if (suggestions.length === 0) {
      suggestions.push("What would you like to do with your tasks today?");
    }

    return suggestions;
  }
}
