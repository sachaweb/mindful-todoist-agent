import { Message, TodoistTask, ConversationContext } from "../types";

// This simulates an AI service - in a real implementation, this would connect to an LLM API
export class AiService {
  private readonly MAX_CONTEXT_MESSAGES = 5;
  private context: ConversationContext = {
    recentMessages: [],
    openTasks: [],
  };

  constructor() {
    this.loadContext();
  }

  public async processMessage(message: string, tasks: TodoistTask[] = []): Promise<string> {
    // Add user message to context
    this.addMessageToContext({
      id: this.generateId(),
      content: message,
      role: "user",
      timestamp: new Date(),
    });

    // Update tasks in context
    this.context.openTasks = tasks;

    // Save context
    this.saveContext();

    // Process the message and generate a response
    const response = await this.generateResponse(message);

    // Add AI response to context
    this.addMessageToContext({
      id: this.generateId(),
      content: response,
      role: "assistant",
      timestamp: new Date(),
    });

    // Save updated context
    this.saveContext();

    return response;
  }

  public analyzeTasks(tasks: TodoistTask[]): string[] {
    const suggestions: string[] = [];

    if (!tasks || tasks.length === 0) {
      return ["You don't have any open tasks. Would you like to create one?"];
    }

    // Group similar tasks based on simple patterns
    const callTasks = tasks.filter(t => 
      t.content.toLowerCase().includes("call") || 
      t.content.toLowerCase().includes("phone") || 
      t.content.toLowerCase().includes("meeting")
    );

    const emailTasks = tasks.filter(t => 
      t.content.toLowerCase().includes("email") || 
      t.content.toLowerCase().includes("send") || 
      t.content.toLowerCase().includes("write to")
    );

    const urgentTasks = tasks.filter(t => t.priority === 4);

    // Generate suggestions based on task groups
    if (callTasks.length >= 2) {
      suggestions.push(`You have ${callTasks.length} call/meeting tasks - would you like to batch them together?`);
    }

    if (emailTasks.length >= 2) {
      suggestions.push(`I noticed ${emailTasks.length} email-related tasks - consider setting aside a specific time for emails.`);
    }

    if (urgentTasks.length > 0) {
      suggestions.push(`You have ${urgentTasks.length} high-priority tasks to focus on.`);
    }

    if (tasks.length > 10) {
      suggestions.push("You have quite a few open tasks. Would you like help prioritizing them?");
    }

    if (suggestions.length === 0) {
      // Default suggestion
      suggestions.push("What would you like to do with your tasks today?");
    }

    return suggestions;
  }

  public getContext(): ConversationContext {
    return this.context;
  }

  private addMessageToContext(message: Message): void {
    this.context.recentMessages.push(message);
    
    // Keep only the most recent messages
    if (this.context.recentMessages.length > this.MAX_CONTEXT_MESSAGES) {
      this.context.recentMessages = this.context.recentMessages.slice(
        this.context.recentMessages.length - this.MAX_CONTEXT_MESSAGES
      );
    }
  }

  private async generateResponse(message: string): Promise<string> {
    // In a real implementation, this would call an LLM API
    // Here we'll use a simple rule-based approach for the MVP
    
    const lowerMessage = message.toLowerCase();
    
    // Handle task creation
    if (lowerMessage.includes("add task") || lowerMessage.includes("create task") || lowerMessage.startsWith("add ")) {
      return "I'll help you add that task. What details would you like to include?";
    }
    
    // Handle task completion
    if (lowerMessage.includes("complete") || lowerMessage.includes("mark as done") || lowerMessage.includes("finish task")) {
      return "I'll mark that task as complete for you.";
    }
    
    // Handle task listing
    if (lowerMessage.includes("show tasks") || lowerMessage.includes("list tasks") || lowerMessage.includes("my tasks")) {
      return "Here are your current tasks. Would you like me to help you organize them?";
    }
    
    // Handle help requests
    if (lowerMessage.includes("help") || lowerMessage.includes("what can you do")) {
      return "I can help you manage your Todoist tasks. Try asking me to create tasks, complete tasks, or suggest ways to organize your task list.";
    }
    
    // Default response
    return "I'm your Todoist assistant. I can help you create, update and complete tasks, as well as suggest ways to organize them. What would you like to do?";
  }

  private saveContext(): void {
    localStorage.setItem("ai_context", JSON.stringify({
      recentMessages: this.context.recentMessages,
      lastSuggestion: this.context.lastSuggestion,
      // Note: We don't store tasks as they can get stale quickly
    }));
  }

  private loadContext(): void {
    const storedContext = localStorage.getItem("ai_context");
    if (storedContext) {
      const parsedContext = JSON.parse(storedContext);
      
      // Restore timestamps as Date objects
      if (parsedContext.recentMessages) {
        parsedContext.recentMessages.forEach((msg: any) => {
          msg.timestamp = new Date(msg.timestamp);
        });
      }
      
      this.context = {
        ...this.context,
        ...parsedContext,
        openTasks: [], // Always fetch fresh tasks
      };
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 11);
  }
}

// Create a singleton instance
const aiService = new AiService();
export default aiService;
