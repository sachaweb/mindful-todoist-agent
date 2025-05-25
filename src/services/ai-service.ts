
import { Message, TodoistTask, ConversationContext } from "../types";

export class AiService {
  private readonly MAX_CONTEXT_MESSAGES = 10;
  private context: ConversationContext = {
    recentMessages: [],
    openTasks: [],
    taskCreationState: null,
  };
  private apiKey: string | null = null;

  constructor() {
    this.loadContext();
    this.loadApiKey();
  }

  public setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    this.saveApiKey(apiKey);
  }

  public hasApiKey(): boolean {
    return !!this.apiKey;
  }

  private saveApiKey(apiKey: string): void {
    localStorage.setItem("claude_api_key", apiKey);
  }

  private loadApiKey(): void {
    this.apiKey = localStorage.getItem("claude_api_key");
  }

  public async processMessage(message: string, tasks: TodoistTask[] = []): Promise<string> {
    console.log("AI service processing message:", message);
    
    if (!this.apiKey) {
      return "Please set your Claude API key first to use the AI assistant.";
    }
    
    // Add user message to context
    this.addMessageToContext({
      id: this.generateId(),
      content: message,
      role: "user",
      timestamp: new Date(),
    });

    // Update tasks in context
    this.context.openTasks = tasks;
    this.context.lastQuery = message;
    this.saveContext();

    // Generate response using Claude
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
  }

  private async generateClaudeResponse(message: string, tasks: TodoistTask[]): Promise<string> {
    try {
      const systemPrompt = this.buildSystemPrompt(tasks);
      const conversationHistory = this.buildConversationHistory();

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 1000,
          system: systemPrompt,
          messages: [...conversationHistory, { role: "user", content: message }],
        }),
      });

      if (!response.ok) {
        console.error("Claude API error:", response.status, response.statusText);
        return "Sorry, I encountered an error while processing your request. Please check your API key and try again.";
      }

      const data = await response.json();
      return data.content[0].text;
    } catch (error) {
      console.error("Error calling Claude API:", error);
      return "Sorry, I encountered an error while processing your request. Please try again.";
    }
  }

  private buildSystemPrompt(tasks: TodoistTask[]): string {
    const taskList = tasks.length > 0 
      ? tasks.map(t => `- ${t.content}${t.due ? ` (due: ${t.due.string || t.due.date})` : ''} [Priority: ${t.priority}]`).join('\n')
      : "No open tasks";

    return `You are a helpful Todoist task management assistant. You can help users create, update, complete, and organize their tasks using natural language.

Current open tasks:
${taskList}

When a user wants to create a task, respond with: "I'll create a task "[task content]" with due date [due date]." (if due date mentioned) or "I'll create a task "[task content]"." (if no due date).

When a user wants to update a task due date, respond with: "I'll update the due date for your task "[task name]" to [new date]."

When a user wants to complete a task, acknowledge it naturally.

Be conversational, helpful, and focus on task management. Keep responses concise but friendly.`;
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
