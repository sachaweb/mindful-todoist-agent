
import { TodoistTask, TodoistApiResponse } from "../types";
import { supabase } from "@/integrations/supabase/client";

export class TodoistApi {
  private apiKeySet: boolean = true; // Always true since we use Edge Function
  private lastRequestTime: number = 0;
  private minRequestInterval: number = 5000; // Increased to 5 seconds between requests
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue: boolean = false;

  constructor() {
    // No need to manage API key locally anymore
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
  public async getTasks(): Promise<TodoistApiResponse> {
    return this.queueRequest(async () => {
      try {
        console.log("Calling Edge Function to get tasks...");
        
        const { data, error } = await supabase.functions.invoke('todoist-proxy', {
          body: { action: 'getTasks' }
        });

        if (error) {
          console.error("Edge Function error:", error);
          return { success: false, error: error.message };
        }

        if (data.success) {
          console.log("Successfully fetched tasks via Edge Function:", data.data);
          return { success: true, data: data.data };
        } else {
          console.error("Todoist API error:", data.error);
          
          // Handle rate limiting specifically
          if (data.error && data.error.includes('429')) {
            return { success: false, error: "Rate limited by Todoist. Please wait a moment before trying again." };
          }
          
          return { success: false, error: data.error };
        }
      } catch (error) {
        console.error("Error calling Edge Function:", error);
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
        console.log("Creating task via Edge Function:", { content, due, priority, labels });

        const { data, error } = await supabase.functions.invoke('todoist-proxy', {
          body: { 
            action: 'createTask', 
            data: { 
              content, 
              due_string: due, 
              priority, 
              labels 
            } 
          }
        });

        if (error) {
          console.error("Edge Function error:", error);
          return { success: false, error: error.message };
        }

        if (data.success) {
          console.log("Successfully created task via Edge Function:", data.data);
          return { success: true, data: data.data };
        } else {
          console.error("Todoist API error:", data.error);
          
          // Handle rate limiting specifically
          if (data.error && data.error.includes('429')) {
            return { success: false, error: "Rate limited by Todoist. Please wait a moment before trying again." };
          }
          
          return { success: false, error: data.error };
        }
      } catch (error) {
        console.error("Error calling Edge Function:", error);
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
        console.log("Updating task via Edge Function:", { taskId, updates });

        const { data, error } = await supabase.functions.invoke('todoist-proxy', {
          body: { 
            action: 'updateTask', 
            data: { taskId, updates } 
          }
        });

        if (error) {
          console.error("Edge Function error:", error);
          return { success: false, error: error.message };
        }

        if (data.success) {
          console.log("Successfully updated task via Edge Function");
          return { success: true };
        } else {
          console.error("Todoist API error:", data.error);
          
          // Handle rate limiting specifically
          if (data.error && data.error.includes('429')) {
            return { success: false, error: "Rate limited by Todoist. Please wait a moment before trying again." };
          }
          
          return { success: false, error: data.error };
        }
      } catch (error) {
        console.error("Error calling Edge Function:", error);
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
        console.log("Completing task via Edge Function:", taskId);

        const { data, error } = await supabase.functions.invoke('todoist-proxy', {
          body: { 
            action: 'completeTask', 
            data: { taskId } 
          }
        });

        if (error) {
          console.error("Edge Function error:", error);
          return { success: false, error: error.message };
        }

        if (data.success) {
          console.log("Successfully completed task via Edge Function");
          return { success: true };
        } else {
          console.error("Todoist API error:", data.error);
          
          // Handle rate limiting specifically
          if (data.error && data.error.includes('429')) {
            return { success: false, error: "Rate limited by Todoist. Please wait a moment before trying again." };
          }
          
          return { success: false, error: data.error };
        }
      } catch (error) {
        console.error("Error calling Edge Function:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    });
  }
}

// Create a singleton instance
const todoistApi = new TodoistApi();
export default todoistApi;
