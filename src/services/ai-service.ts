
import { Message, TodoistTask, ConversationContext } from "../types";

// This simulates an AI service - in a real implementation, this would connect to an LLM API
export class AiService {
  private readonly MAX_CONTEXT_MESSAGES = 10; // Increased from 5 to provide more context
  private context: ConversationContext = {
    recentMessages: [],
    openTasks: [],
    taskCreationState: null, // Track the state of task creation
  };

  constructor() {
    this.loadContext();
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

    // Update tasks in context
    this.context.openTasks = tasks;
    
    // Save the last query for context
    this.context.lastQuery = message;

    // Save context
    this.saveContext();

    // Process the message and generate a response
    const response = await this.generateResponse(message);
    console.log("AI service generated response:", response);

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
    console.log("Adding message to context:", message);
    this.context.recentMessages.push(message);
    
    // Keep only the most recent messages
    if (this.context.recentMessages.length > this.MAX_CONTEXT_MESSAGES) {
      this.context.recentMessages = this.context.recentMessages.slice(
        this.context.recentMessages.length - this.MAX_CONTEXT_MESSAGES
      );
    }
  }

  private async generateResponse(message: string): Promise<string> {
    // Enhanced rule-based response system with natural language processing
    const lowerMessage = message.toLowerCase().trim();
    
    // Improved context awareness - look at previous messages
    const recentUserMessages = this.context.recentMessages
      .filter(msg => msg.role === "user")
      .slice(-3);
    
    const recentAIMessages = this.context.recentMessages
      .filter(msg => msg.role === "assistant")
      .slice(-3);
    
    console.log("Recent context - User messages:", recentUserMessages);
    console.log("Recent context - AI messages:", recentAIMessages);
    console.log("Current task creation state:", this.context.taskCreationState);
    
    // Check if we're in the middle of creating a task
    if (this.context.taskCreationState) {
      console.log("Processing message in task creation flow", this.context.taskCreationState);
      const { taskContent, dueDate, waitingFor } = this.context.taskCreationState;
      
      // Handle response to priority/labels question
      if (waitingFor === 'priorityOrLabels') {
        // If user says no, complete the task creation
        if (['no', 'nope', 'not needed', 'don\'t need', 'not necessary'].includes(lowerMessage)) {
          // Reset task creation state
          this.context.taskCreationState = null;
          return `Great! I'll create your task "${taskContent}"${dueDate ? ` with due date ${dueDate}` : ''} without additional priority or labels. The task has been added to your Todoist.`;
        }
        
        // If user says yes or provides priority info
        if (lowerMessage.includes('yes') || lowerMessage.includes('high') || lowerMessage.includes('important')) {
          this.context.taskCreationState.waitingFor = 'labelConfirmation';
          return `I'll set this task to high priority. Would you like me to add any labels to it as well?`;
        }
        
        // If user provides label info directly
        if (lowerMessage.includes('label') || lowerMessage.includes('tag')) {
          // Reset task creation state - task is complete
          this.context.taskCreationState = null;
          return `I've created your task "${taskContent}"${dueDate ? ` with due date ${dueDate}` : ''} and added the labels you requested. The task has been added to your Todoist.`;
        }
      }
      
      // Handle response to label question
      if (waitingFor === 'labelConfirmation') {
        // Reset task creation state - we're done with the task
        this.context.taskCreationState = null;
        
        if (['no', 'nope', 'not needed', 'don\'t need', 'not necessary'].includes(lowerMessage)) {
          return `Got it! I've created your task "${taskContent}"${dueDate ? ` with due date ${dueDate}` : ''} with high priority but no labels. The task has been added to your Todoist.`;
        }
        
        return `Perfect! I've created your task "${taskContent}"${dueDate ? ` with due date ${dueDate}` : ''} with high priority and the labels you requested. The task has been added to your Todoist.`;
      }
      
      // Handle response to due date question
      if (waitingFor === 'dueDate') {
        let extractedDueDate = '';
        
        if (lowerMessage.includes('tomorrow')) {
          extractedDueDate = 'tomorrow';
        } else if (lowerMessage.includes('today')) {
          extractedDueDate = 'today';
        } else if (lowerMessage.includes('next week')) {
          extractedDueDate = 'next week';
        } else if (['no', 'nope', 'not needed', 'don\'t need', 'not necessary'].includes(lowerMessage)) {
          // User doesn't want to set a due date
          this.context.taskCreationState = {
            taskContent,
            dueDate: '',
            waitingFor: 'priorityOrLabels'
          };
          return `No problem. Would you like to set a priority or add labels to this task?`;
        } else {
          extractedDueDate = 'the date you specified';
        }
        
        // Update task state and ask about priority
        this.context.taskCreationState = {
          taskContent,
          dueDate: extractedDueDate,
          waitingFor: 'priorityOrLabels'
        };
        
        return `I'll create a task "${taskContent}" with due date ${extractedDueDate}. Would you like to add any priority or labels?`;
      }
    }
    
    // Task Creation - start of flow
    if (
      lowerMessage.includes("create") || 
      lowerMessage.includes("add") || 
      lowerMessage.includes("make") || 
      lowerMessage.startsWith("add ") ||
      (lowerMessage.startsWith("i need to") && !lowerMessage.includes("?"))
    ) {
      // Extract task details
      let taskContent = message;
      let dueDate = "";
      
      // Try to extract due date information
      if (lowerMessage.includes("tomorrow")) {
        dueDate = "tomorrow";
      } else if (lowerMessage.includes("today")) {
        dueDate = "today";
      } else if (lowerMessage.includes("next week")) {
        dueDate = "next week";
      }
      
      // Start the task creation flow by tracking state
      if (dueDate) {
        this.context.taskCreationState = {
          taskContent,
          dueDate,
          waitingFor: 'priorityOrLabels'
        };
        return `I'll create a task "${taskContent}" with due date ${dueDate}. Would you like to add any priority or labels?`;
      } else {
        this.context.taskCreationState = {
          taskContent,
          dueDate: '',
          waitingFor: 'dueDate'
        };
        return `I'll create a task "${taskContent}". Would you like to set a due date for this task?`;
      }
    }
    
    // Task Update
    if (lowerMessage.includes("update") || lowerMessage.includes("change") || lowerMessage.includes("edit")) {
      return "I'll help you update that task. Which part would you like to change? The due date, priority, or description?";
    }
    
    // Task Completion
    if (lowerMessage.includes("complete") || lowerMessage.includes("mark as done") || lowerMessage.includes("finish task")) {
      return "Great! I'll mark that task as complete for you. Is there anything else you'd like to accomplish today?";
    }
    
    // Task Retrieval/Listing
    if (
      lowerMessage.includes("show") || 
      lowerMessage.includes("list") || 
      lowerMessage.includes("what are my") || 
      lowerMessage.includes("my tasks") ||
      lowerMessage.includes("display") ||
      lowerMessage.includes("view") ||
      lowerMessage.includes("see")
    ) {
      if (this.context.openTasks && this.context.openTasks.length > 0) {
        return `You have ${this.context.openTasks.length} open tasks. You can see them in the panel on the right. Would you like me to help you organize them?`;
      } else {
        return "You don't have any open tasks at the moment. Would you like to create one?";
      }
    }
    
    // Task Grouping/Batching
    if (
      lowerMessage.includes("group") || 
      lowerMessage.includes("batch") || 
      lowerMessage.includes("organize") || 
      lowerMessage.includes("categorize") ||
      lowerMessage.includes("bundle")
    ) {
      return "I can help you group similar tasks together. Would you like to group them by category, due date, or priority?";
    }
    
    // Task Prioritization
    if (lowerMessage.includes("prioritize") || lowerMessage.includes("important") || lowerMessage.includes("urgent")) {
      return "I'll help you prioritize your tasks. Would you like to focus on due date, importance, or effort required?";
    }
    
    // Help requests
    if (lowerMessage.includes("help") || lowerMessage.includes("what can you do")) {
      return "I can help you manage your Todoist tasks in several ways:\n- Create new tasks\n- Update existing tasks\n- Complete tasks\n- List and organize your tasks\n- Group similar tasks together\n- Provide productivity suggestions\n\nJust tell me what you'd like to do!";
    }
    
    // Default varying responses
    const defaultResponses = [
      "I'm here to help manage your Todoist tasks. What would you like me to help you with today?",
      "How can I assist with your task management? Would you like to create, update, or organize your tasks?",
      "I can help with creating, updating, or organizing your Todoist tasks. What would you like to do?",
      "Ready to help with your tasks! Would you like to add a new task, check your current ones, or get some organization tips?"
    ];
    
    return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
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
        console.log("Context loaded successfully:", this.context);
      } else {
        console.log("No stored context found");
      }
    } catch (error) {
      console.error("Error loading context:", error);
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 11);
  }
}

// Create a singleton instance
const aiService = new AiService();
export default aiService;
