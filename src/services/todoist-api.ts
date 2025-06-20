import { TodoistTask, TodoistApiResponse } from "../types";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "../utils/logger";
import { validateSingleTaskCreation, validateTaskUpdate, validateTodoistResponse, ValidationResult } from "../utils/validators";
import { SingleTaskCreationInput, TaskUpdateInput } from "../schemas/taskSchemas";

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
          logger.debug('TODOIST_API', `Rate limiting: waiting ${delay}ms before next request`);
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
        logger.info('TODOIST_API', 'Starting getTasks request', { filter, hasFilter: !!filter });
        
        const requestPayload = { 
          action: 'getTasks',
          data: filter ? { filter } : {} // Only pass filter if it exists
        };

        logger.debug('TODOIST_API', 'getTasks request payload', requestPayload);

        const { data, error } = await supabase.functions.invoke('todoist-proxy', {
          body: requestPayload
        });

        if (error) {
          logger.error('TODOIST_API', 'Edge Function error in getTasks', { 
            error: error.message,
            stack: error.stack,
            code: error.code
          });
          return { success: false, error: error.message };
        }

        logger.debug('TODOIST_API', 'Raw Edge Function response for getTasks', data);

        const validationResult = validateTodoistResponse(data);
        if (!validationResult.success) {
          logger.error('TODOIST_API', 'Invalid response format from getTasks', {
            validationErrors: validationResult.errors,
            rawResponse: data
          });
          return { success: false, error: 'Invalid response format from Todoist API' };
        }

        if (data.success) {
          logger.info('TODOIST_API', 'getTasks completed successfully', { 
            taskCount: data.data?.length || 0,
            hasData: !!data.data
          });
          return { success: true, data: data.data };
        } else {
          logger.error('TODOIST_API', 'Todoist API error in getTasks', {
            apiError: data.error,
            errorType: typeof data.error,
            fullResponse: data
          });
          
          if (data.error && data.error.includes('429')) {
            return { success: false, error: "Rate limited by Todoist. Please wait a moment before trying again." };
          }
          
          return { success: false, error: data.error };
        }
      } catch (error) {
        logger.error('TODOIST_API', 'Exception in getTasks', {
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined,
          errorType: typeof error
        });
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
        logger.info('TODOIST_API', 'Starting createTask request', { 
          content, 
          due, 
          priority, 
          labels,
          priorityType: typeof priority,
          labelsType: typeof labels,
          labelsLength: labels?.length
        });

        // Build the task creation input object - ALWAYS include all fields that have values
        const taskCreationInput: any = {
          content: content
        };

        // Add due_string if provided
        if (due && due.trim() !== '') {
          taskCreationInput.due_string = due;
          logger.debug('TODOIST_API', 'Added due_string to task input', { due_string: due });
        }

        // ALWAYS include priority as an integer between 1 and 4
        // Default to 4 (low priority) if not provided or invalid
        let priorityValue = 4; // Default to low priority
        if (typeof priority === 'number' && priority >= 1 && priority <= 4) {
          priorityValue = priority;
        }
        taskCreationInput.priority = priorityValue;
        
        logger.info('TODOIST_API', 'PRIORITY ALWAYS INCLUDED IN TASK INPUT', { 
          originalPriority: priority,
          finalPriority: priorityValue,
          priorityType: typeof priorityValue,
          todoistDisplay: priorityValue === 1 ? 'P1 (urgent/red)' : 
                         priorityValue === 2 ? 'P2 (high/orange)' : 
                         priorityValue === 3 ? 'P3 (medium/blue)' : 
                         priorityValue === 4 ? 'P4 (low/default)' : 'unknown'
        });

        // Add labels if provided
        if (labels && Array.isArray(labels) && labels.length > 0) {
          taskCreationInput.labels = labels;
          logger.debug('TODOIST_API', 'Added labels to task input', { labels });
        }

        logger.info('TODOIST_API', 'FINAL TASK INPUT OBJECT BEFORE VALIDATION', { 
          taskCreationInput,
          hasContent: !!taskCreationInput.content,
          hasDueString: !!taskCreationInput.due_string,
          hasPriority: taskCreationInput.priority !== undefined,
          hasLabels: !!taskCreationInput.labels,
          priorityValue: taskCreationInput.priority,
          priorityType: typeof taskCreationInput.priority
        });

        // Validate input before making API call
        const taskValidation = validateSingleTaskCreation(taskCreationInput);

        if (!taskValidation.success) {
          logger.error('TODOIST_API', 'Task validation failed in createTask', {
            validationErrors: taskValidation.errors,
            inputData: taskCreationInput
          });
          return { 
            success: false, 
            error: `Invalid task data: ${taskValidation.errors?.map(e => e.message).join(', ')}` 
          };
        }

        const validatedTask = taskValidation.data!;
        
        logger.info('TODOIST_API', 'TASK VALIDATION PASSED - SENDING TO EDGE FUNCTION', { 
          validatedTask,
          hasPriorityAfterValidation: validatedTask.priority !== undefined,
          priorityValueAfterValidation: validatedTask.priority,
          priorityTypeAfterValidation: typeof validatedTask.priority
        });

        const edgeFunctionPayload = { 
          action: 'createTask', 
          data: validatedTask
        };

        logger.info('TODOIST_API', 'COMPLETE EDGE FUNCTION PAYLOAD BEING SENT TO TODOIST', {
          payload: JSON.stringify(edgeFunctionPayload, null, 2),
          dataObject: edgeFunctionPayload.data,
          dataPriority: edgeFunctionPayload.data.priority,
          dataPriorityType: typeof edgeFunctionPayload.data.priority,
          expectedTodoistDisplay: edgeFunctionPayload.data.priority === 1 ? 'P1 (urgent/red)' : 
                                  edgeFunctionPayload.data.priority === 2 ? 'P2 (high/orange)' : 
                                  edgeFunctionPayload.data.priority === 3 ? 'P3 (medium/blue)' : 
                                  edgeFunctionPayload.data.priority === 4 ? 'P4 (low/default)' : 'unknown'
        });

        const { data, error } = await supabase.functions.invoke('todoist-proxy', {
          body: edgeFunctionPayload
        });

        if (error) {
          logger.error('TODOIST_API', 'Edge Function error in createTask', {
            error: error.message,
            stack: error.stack,
            code: error.code,
            details: error.details
          });
          return { success: false, error: error.message };
        }

        logger.info('TODOIST_API', 'FULL EDGE FUNCTION RESPONSE', {
          response: JSON.stringify(data, null, 2),
          success: data?.success,
          hasData: !!data?.data,
          hasError: !!data?.error
        });

        const responseValidation = validateTodoistResponse(data);
        if (!responseValidation.success) {
          logger.error('TODOIST_API', 'Invalid create response format', {
            validationErrors: responseValidation.errors,
            rawResponse: data
          });
          return { success: false, error: 'Invalid response format from Todoist API' };
        }

        if (data.success) {
          logger.info('TODOIST_API', 'Task created successfully', { 
            createdTask: data.data,
            createdTaskId: data.data?.id,
            createdTaskPriority: data.data?.priority,
            createdTaskContent: data.data?.content,
            createdTaskDue: data.data?.due,
            actualTodoistPriorityDisplay: data.data?.priority === 1 ? 'P1 (urgent/red)' : 
                                         data.data?.priority === 2 ? 'P2 (high/orange)' : 
                                         data.data?.priority === 3 ? 'P3 (medium/blue)' : 
                                         data.data?.priority === 4 ? 'P4 (low/default)' : 'unknown'
          });
          return { success: true, data: data.data };
        } else {
          logger.error('TODOIST_API', 'TODOIST API ERROR DETAILS', {
            apiError: data.error,
            errorMessage: data.error,
            errorType: typeof data.error,
            fullErrorResponse: data,
            requestPayload: validatedTask
          });
          
          if (data.error && data.error.includes('429')) {
            return { success: false, error: "Rate limited by Todoist. Please wait a moment before trying again." };
          }
          
          return { success: false, error: data.error };
        }
      } catch (error) {
        logger.error('TODOIST_API', 'Exception in createTask', {
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined,
          errorType: typeof error,
          inputData: { content, due, priority, labels }
        });
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
