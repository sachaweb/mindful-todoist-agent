
import { Message, TodoistTask, ConversationContext } from "../types";
import { supabase } from "@/integrations/supabase/client";

export class AiService {
  private readonly MAX_CONTEXT_MESSAGES = 10;
  private context: ConversationContext = {
    recentMessages: [],
    openTasks: [],
    taskCreationState: null,
  };

  constructor() {
    this.loadContext();
  }

  public hasApiKey(): boolean {
    // Since we're using Edge Function, we don't need to check client-side
    return true;
  }

  public setApiKey(apiKey: string): void {
    // API key is now managed in Supabase secrets, so this is a no-op
    console.log("API key management is now handled by Edge Function");
  }

  public async processMessage(message: string, tasks: TodoistTask[] = []): Promise<string> {
    console.log("AI service processing message:", message);
    
    // Add user message to context
    this.addMessageToContext({
      id: this.generateId(),
      content: message,
      role: "user",
      timestamp: new Date(),
    });

    // Update tasks in context - use current tasks only, don't carry over
    this.context.openTasks = [...tasks]; // Create fresh copy
    this.context.lastQuery = message;
    this.saveContext();

    try {
      // Generate response using Claude proxy
      const response = await this.generateClaudeResponse(message, tasks);
      console.log("Claude response:", response);

      // Add AI response to context
      this.addMessageToContext({
        id: this.generateId(),
        content: response,
        role: "assistant",
        timestamp: new Date(),
      });

      this.saveContext();
      return response;
    } catch (error) {
      console.error("Error in processMessage:", error);
      return "I'm having trouble connecting to the AI service right now. Please try again.";
    }
  }

  private async generateClaudeResponse(message: string, tasks: TodoistTask[]): Promise<string> {
    const systemPrompt = this.buildSystemPrompt(tasks);
    const conversationHistory = this.buildConversationHistory();

    console.log("Calling Claude proxy Edge Function");
    const { data, error } = await supabase.functions.invoke('claude-proxy', {
      body: {
        message,
        tasks: [...tasks], // Send fresh copy of current tasks only
        systemPrompt,
        conversationHistory
      }
    });

    if (error) {
      console.error("Edge Function error:", error);
      throw new Error(`Edge Function error: ${error.message}`);
    }

    if (!data.success) {
      console.error("Claude proxy error:", data.error);
      throw new Error(`Claude API error: ${data.error}`);
    }

    return data.response;
  }

  private buildSystemPrompt(tasks: TodoistTask[]): string {
    const taskList = tasks.length > 0 
      ? tasks.map(t => `- ${t.content}${t.due ? ` (due: ${t.due.string || t.due.date})` : ''} [Priority: ${t.priority}]`).join('\n')
      : "No open tasks";

    return `You are a helpful Todoist task management assistant. You can help users create, update, complete, and organize their tasks using natural language.

Current open tasks:
${taskList}

IMPORTANT TASK CREATION RULES:
- When a user wants to create a SINGLE task, respond with: "I'll create a task "[task content]"."
- When a user wants to create MULTIPLE tasks, respond with: "I'll create the following [exact number] tasks:" followed by each task on a new line in quotes.
- ONLY respond with the tasks from the CURRENT user message - do not include any tasks from previous messages.
- Count the tasks carefully and use the exact number in your response.

Examples:
* Single task: User: "Create a task: Buy groceries" → You: "I'll create a task "Buy groceries"."
* Multiple tasks: User: "Create 3 tasks: buy groceries, call dentist, and finish report" → You: "I'll create the following 3 tasks:\n"Buy groceries"\n"Call dentist"\n"Finish report""

- When a user wants to update a task due date, respond with: "I'll update the due date for your task "[task name]" to [new date]."

- When a user wants to complete a task, acknowledge it naturally and the system will handle completion.

Be conversational and helpful, but ALWAYS use the exact phrases above for task creation and updates so the system can detect and execute them properly.

Keep responses concise but friendly.`;
  }

  private buildConversationHistory(): Array<{ role: string; content: string }> {
    return this.context.recentMessages
      .slice(-5) // Keep last 5 messages for context
      .map(msg => ({
        role: msg.role,
        content: msg.content
      }));
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

  public getContext(): ConversationContext {
    return this.context;
  }

  private addMessageToContext(message: Message): void {
    console.log("Adding message to context:", message);
    this.context.recentMessages.push(message);
    
    if (this.context.recentMessages.length > this.MAX_CONTEXT_MESSAGES) {
      this.context.recentMessages = this.context.recentMessages.slice(
        this.context.recentMessages.length - this.MAX_CONTEXT_MESSAGES
      );
    }
  }

  private saveContext(): void {
    try {
      localStorage.setItem("ai_context", JSON.stringify({
        recentMessages: this.context.recentMessages,
        lastSuggestion: this.context.lastSuggestion,
        lastQuery: this.context.lastQuery,
        taskCreationState: this.context.taskCreationState,
      }));
      console.log("Context saved successfully");
    } catch (error) {
      console.error("Error saving context:", error);
    }
  }

  private loadContext(): void {
    try {
      const storedContext = localStorage.getItem("ai_context");
      if (storedContext) {
        const parsedContext = JSON.parse(storedContext);
        
        if (parsedContext.recentMessages) {
          parsedContext.recentMessages.forEach((msg: any) => {
            msg.timestamp = new Date(msg.timestamp);
          });
        }
        
        this.context = {
          ...this.context,
          ...parsedContext,
          openTasks: [],
        };
        console.log("Context loaded successfully:", this.context);
      }
    } catch (error) {
      console.error("Error loading context:", error);
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 11);
  }
}

const aiService = new AiService();
export default aiService;
