import { TodoistTask, TodoistApiResponse } from "../types";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "../utils/logger";
import { validateTask, validateTaskUpdate, validateTodoistResponse, ValidationResult } from "../utils/validators";
import { TaskInput, TaskUpdateInput } from "../schemas/taskSchemas";

export class TodoistApi {
  private apiKeySet: boolean = true; // Always true since we use Edge Function
  private lastRequestTime: number = 0;
  private minRequestInterval: number = 2000; // Reduced to 2 seconds since we're making fewer calls
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue: boolean = false;

  constructor() {
    logger.info('TODOIST_API', 'TodoistApi initialized');
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const requestFn = this.requestQueue.shift();
      if (requestFn) {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.minRequestInterval) {
          const delay = this.minRequestInterval - timeSinceLastRequest;
          console.log(`Rate limiting: waiting ${delay}ms before next request`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        this.lastRequestTime = Date.now();
        await requestFn();
      }
    }

    this.isProcessingQueue = false;
  }

  private async queueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const wrappedRequest = async () => {
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };
      
      this.requestQueue.push(wrappedRequest);
      this.processQueue();
    });
  }

  // API Key management - simplified since Edge Function handles the key
  public setApiKey(apiKey: string): void {
    // API key is managed in Edge Function, just mark as set
    this.apiKeySet = true;
  }

  public hasApiKey(): boolean {
    return this.apiKeySet;
  }

  // Task operations using Edge Function with queue
  public async getTasks(filter?: string): Promise<TodoistApiResponse> {
    return this.queueRequest(async () => {
      try {
        logger.logTodoistCall('getTasks', { filter });
        
        const { data, error } = await supabase.functions.invoke('todoist-proxy', {
          body: { 
            action: 'getTasks',
            data: filter ? { filter } : {} // Only pass filter if it exists
          }
        });

        if (error) {
          logger.error('TODOIST_API', 'Edge Function error', error);
          return { success: false, error: error.message };
        }

        const validationResult = validateTodoistResponse(data);
        if (!validationResult.success) {
          logger.error('TODOIST_API', 'Invalid response format', validationResult.errors);
          return { success: false, error: 'Invalid response format from Todoist API' };
        }

        if (data.success) {
          logger.logTodoistResponse('getTasks', data);
          return { success: true, data: data.data };
        } else {
          logger.error('TODOIST_API', 'Todoist API error', data.error);
          
          if (data.error && data.error.includes('429')) {
            return { success: false, error: "Rate limited by Todoist. Please wait a moment before trying again." };
          }
          
          return { success: false, error: data.error };
        }
      } catch (error) {
        logger.error('TODOIST_API', 'Error calling Edge Function', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    });
  }

  public async createTask(content: string, due?: string, priority?: number, labels?: string[]): Promise<TodoistApiResponse> {
    return this.queueRequest(async () => {
      try {
        // Log the priority value being received
        logger.info('TODOIST_API', 'Creating task with priority', { 
          content, 
          due, 
          priority, 
          labels,
          priorityType: typeof priority
        });

        // Validate input before making API call
        const taskValidation = validateTask({
          content,
          due_string: due,
          priority,
          labels
        });

        if (!taskValidation.success) {
          logger.error('TODOIST_API', 'Task validation failed', taskValidation.errors);
          return { 
            success: false, 
            error: `Invalid task data: ${taskValidation.errors?.map(e => e.message).join(', ')}` 
          };
        }

        const validatedTask = taskValidation.data!;
        
        // Log the validated priority value
        logger.info('TODOIST_API', 'Validated task data', { 
          validatedPriority: validatedTask.priority,
          originalPriority: priority
        });
        
        logger.logTodoistCall('createTask', validatedTask);

        const requestBody = { 
          content: validatedTask.content, 
          due_string: validatedTask.due_string, 
          priority: validatedTask.priority, 
          labels: validatedTask.labels 
        };

        // Log the exact request body being sent to Todoist
        logger.info('TODOIST_API', 'Sending request to Todoist API', { 
          requestBody,
          priorityBeingSent: requestBody.priority
        });

        const { data, error } = await supabase.functions.invoke('todoist-proxy', {
          body: { 
            action: 'createTask', 
            data: requestBody
          }
        });

        if (error) {
          logger.error('TODOIST_API', 'Edge Function error', error);
          return { success: false, error: error.message };
        }

        const responseValidation = validateTodoistResponse(data);
        if (!responseValidation.success) {
          logger.error('TODOIST_API', 'Invalid create response format', responseValidation.errors);
          return { success: false, error: 'Invalid response format from Todoist API' };
        }

        if (data.success) {
          // Log the created task to verify priority was set correctly
          logger.info('TODOIST_API', 'Task created successfully', { 
            createdTask: data.data,
            createdTaskPriority: data.data?.priority
          });
          logger.logTodoistResponse('createTask', data);
          return { success: true, data: data.data };
        } else {
          logger.error('TODOIST_API', 'Todoist API error', data.error);
          
          if (data.error && data.error.includes('429')) {
            return { success: false, error: "Rate limited by Todoist. Please wait a moment before trying again." };
          }
          
          return { success: false, error: data.error };
        }
      } catch (error) {
        logger.error('TODOIST_API', 'Error calling Edge Function', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    });
  }

  public async updateTask(taskId: string, updates: any): Promise<TodoistApiResponse> {
    return this.queueRequest(async () => {
      try {
        // Validate update input
        const updateValidation = validateTaskUpdate({ taskId, updates });
        
        if (!updateValidation.success) {
          logger.error('TODOIST_API', 'Task update validation failed', updateValidation.errors);
          return { 
            success: false, 
            error: `Invalid update data: ${updateValidation.errors?.map(e => e.message).join(', ')}` 
          };
        }

        const validatedUpdate = updateValidation.data!;
        logger.logTodoistCall('updateTask', validatedUpdate);

        const { data, error } = await supabase.functions.invoke('todoist-proxy', {
          body: { 
            action: 'updateTask', 
            data: validatedUpdate
          }
        });

        if (error) {
          logger.error('TODOIST_API', 'Edge Function error', error);
          return { success: false, error: error.message };
        }

        const responseValidation = validateTodoistResponse(data);
        if (!responseValidation.success) {
          logger.error('TODOIST_API', 'Invalid update response format', responseValidation.errors);
          return { success: false, error: 'Invalid response format from Todoist API' };
        }

        if (data.success) {
          logger.logTodoistResponse('updateTask', data);
          return { success: true };
        } else {
          logger.error('TODOIST_API', 'Todoist API error', data.error);
          
          if (data.error && data.error.includes('429')) {
            return { success: false, error: "Rate limited by Todoist. Please wait a moment before trying again." };
          }
          
          return { success: false, error: data.error };
        }
      } catch (error) {
        logger.error('TODOIST_API', 'Error calling Edge Function', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    });
  }

  public async completeTask(taskId: string): Promise<TodoistApiResponse> {
    return this.queueRequest(async () => {
      try {
        if (!taskId || taskId.trim().length === 0) {
          logger.error('TODOIST_API', 'Invalid task ID for completion', { taskId });
          return { success: false, error: 'Task ID is required for completion' };
        }

        logger.logTodoistCall('completeTask', { taskId });

        const { data, error } = await supabase.functions.invoke('todoist-proxy', {
          body: { 
            action: 'completeTask', 
            data: { taskId } 
          }
        });

        if (error) {
          logger.error('TODOIST_API', 'Edge Function error', error);
          return { success: false, error: error.message };
        }

        const responseValidation = validateTodoistResponse(data);
        if (!responseValidation.success) {
          logger.error('TODOIST_API', 'Invalid complete response format', responseValidation.errors);
          return { success: false, error: 'Invalid response format from Todoist API' };
        }

        if (data.success) {
          logger.logTodoistResponse('completeTask', data);
          return { success: true };
        } else {
          logger.error('TODOIST_API', 'Todoist API error', data.error);
          
          if (data.error && data.error.includes('429')) {
            return { success: false, error: "Rate limited by Todoist. Please wait a moment before trying again." };
          }
          
          return { success: false, error: data.error };
        }
      } catch (error) {
        logger.error('TODOIST_API', 'Error calling Edge Function', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    });
  }

  // Method to search for tasks by content
  public async searchTasks(query: string): Promise<TodoistApiResponse> {
    if (!query || query.trim().length === 0) {
      logger.warn('TODOIST_API', 'Empty search query provided');
      return { success: false, error: 'Search query cannot be empty' };
    }
    
    return this.getTasks(query);
  }
}

// Create a singleton instance
const todoistApi = new TodoistApi();
export default todoistApi;
