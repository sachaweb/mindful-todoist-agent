
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
    // Enhanced rule-based response system
    const lowerMessage = message.toLowerCase();
    
    // Handle questions about bundling or grouping tasks
    if (lowerMessage.includes("bundle") || lowerMessage.includes("group") || lowerMessage.includes("batch")) {
      return "To bundle similar tasks together, I can help you identify tasks with similar themes. Would you like me to group your tasks by category, priority, or due date?";
    }
    
    // Handle task retrieval requests
    if (lowerMessage.includes("retrieve") || lowerMessage.includes("show") || lowerMessage.includes("display") || lowerMessage.includes("list tasks") || lowerMessage.includes("my tasks")) {
      return "I've refreshed your task list. You can see your tasks in the panel on the right. Would you like me to help you organize them in any specific way?";
    }
    
    // Handle task creation
    if (lowerMessage.includes("add task") || lowerMessage.includes("create task") || lowerMessage.startsWith("add ")) {
      return "I'll help you add that task. What details would you like to include? You can specify a due date, priority level, or project.";
    }
    
    // Handle task completion
    if (lowerMessage.includes("complete") || lowerMessage.includes("mark as done") || lowerMessage.includes("finish task")) {
      return "I'll mark that task as complete for you. You can also complete tasks directly from the task panel on the right by clicking the checkmark button.";
    }
    
    // Handle prioritization requests
    if (lowerMessage.includes("prioritize") || lowerMessage.includes("important") || lowerMessage.includes("urgent")) {
      return "I can help you prioritize your tasks. Would you like to sort them by due date, importance, or difficulty?";
    }
    
    // Handle scheduling queries
    if (lowerMessage.includes("schedule") || lowerMessage.includes("when") || lowerMessage.includes("time")) {
      return "I can help you schedule your tasks. Would you like me to suggest time blocks for your tasks based on their priority and estimated duration?";
    }
    
    // Handle help requests
    if (lowerMessage.includes("help") || lowerMessage.includes("what can you do")) {
      return "I can help you manage your Todoist tasks in several ways:\n- Create tasks with natural language\n- Complete tasks\n- Organize and prioritize your task list\n- Bundle similar tasks together\n- Suggest time management strategies\n\nJust let me know what you'd like assistance with!";
    }
    
    // Default varying responses
    const defaultResponses = [
      "I'm here to help with your tasks. Would you like to create a new task, view your current ones, or get some organizational suggestions?",
      "How can I assist with your task management today? I can help create, organize, or complete tasks.",
      "I'm your Todoist assistant. Let me know if you'd like to add a task, review your current tasks, or get productivity suggestions.",
      "Is there a specific aspect of your task management I can help with today?"
    ];
    
    return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
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
