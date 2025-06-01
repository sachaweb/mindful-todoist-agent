
import { Message, TodoistTask, ConversationContext } from "../types";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "../utils/logger";
import { validateUserInput } from "../utils/validators";

export class AiService {
  private readonly MAX_CONTEXT_MESSAGES = 10;
  private context: ConversationContext = {
    recentMessages: [],
    openTasks: [],
    taskCreationState: null,
  };

  constructor() {
    this.loadContext();
    logger.info('AI_SERVICE', 'AiService initialized');
  }

  public hasApiKey(): boolean {
    // Since we're using Edge Function, we don't need to check client-side
    return true;
  }

  public setApiKey(apiKey: string): void {
    // API key is now managed in Supabase secrets, so this is a no-op
    logger.info('AI_SERVICE', 'API key management is now handled by Edge Function');
  }

  public async processMessage(message: string, tasks: TodoistTask[] = []): Promise<string> {
    logger.logUserInput(message);
    
    // Validate user input
    const inputValidation = validateUserInput({ input: message });
    if (!inputValidation.success) {
      logger.error('AI_SERVICE', 'Invalid user input', inputValidation.errors);
      return "I'm sorry, but your message couldn't be processed. Please try rephrasing it.";
    }

    const validatedInput = inputValidation.data!.input;
    logger.info('AI_SERVICE', 'Processing validated message', { original: message, validated: validatedInput });
    
    // Add user message to context
    this.addMessageToContext({
      id: this.generateId(),
      content: validatedInput,
      role: "user",
      timestamp: new Date(),
    });

    // Update tasks in context - use current tasks only, don't carry over
    this.context.openTasks = [...tasks]; // Create fresh copy
    this.context.lastQuery = validatedInput;
    this.saveContext();

    try {
      // Generate response using Claude proxy
      const response = await this.generateClaudeResponse(validatedInput, tasks);
      logger.info('AI_SERVICE', 'Claude response received', { response });

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
      logger.error('AI_SERVICE', 'Error in processMessage', error);
      return "I'm having trouble connecting to the AI service right now. Please try again.";
    }
  }

  private async generateClaudeResponse(message: string, tasks: TodoistTask[]): Promise<string> {
    const systemPrompt = this.buildSystemPrompt(tasks);
    const conversationHistory = this.buildConversationHistory();

    logger.logClaudeRequest({
      message,
      tasksCount: tasks.length,
      systemPromptLength: systemPrompt.length,
      conversationHistoryLength: conversationHistory.length
    });

    const { data, error } = await supabase.functions.invoke('claude-proxy', {
      body: {
        message,
        tasks: [...tasks], // Send fresh copy of current tasks only
        systemPrompt,
        conversationHistory
      }
    });

    if (error) {
      logger.error('AI_SERVICE', 'Edge Function error', error);
      throw new Error(`Edge Function error: ${error.message}`);
    }

    if (!data.success) {
      logger.error('AI_SERVICE', 'Claude proxy error', data.error);
      throw new Error(`Claude API error: ${data.error}`);
    }

    logger.logClaudeResponse(data);
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
- PRESERVE due dates, priorities, and labels from the user's original request in the task content.

Examples:
* Single task: User: "Create a task: Buy groceries" → You: "I'll create a task "Buy groceries"."
* Task with due date: User: "Call mom due next Friday" → You: "I'll create a task "Call mom due next Friday"."
* Urgent task: User: "Fix server issue urgently" → You: "I'll create a task "Fix server issue urgently"."
* Task with labels: User: "Gym workout with labels health, fitness" → You: "I'll create a task "Gym workout with labels health, fitness"."
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
    logger.debug('AI_SERVICE', 'Adding message to context', message);
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
      logger.debug('AI_SERVICE', 'Context saved successfully');
    } catch (error) {
      logger.error('AI_SERVICE', 'Error saving context', error);
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
        logger.debug('AI_SERVICE', 'Context loaded successfully', this.context);
      }
    } catch (error) {
      logger.error('AI_SERVICE', 'Error loading context', error);
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 11);
  }
}

const aiService = new AiService();
export default aiService;
