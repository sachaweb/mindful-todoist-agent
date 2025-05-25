
import { TodoistTask, TodoistApiResponse } from "../types";
import { supabase } from "@/integrations/supabase/client";

export class TodoistApi {
  private apiKeySet: boolean = true; // Always true since we use Edge Function

  constructor() {
    // No need to manage API key locally anymore
  }

  // API Key management - simplified since Edge Function handles the key
  public setApiKey(apiKey: string): void {
    // API key is managed in Edge Function, just mark as set
    this.apiKeySet = true;
  }

  public hasApiKey(): boolean {
    return this.apiKeySet;
  }

  // Task operations using Edge Function
  public async getTasks(): Promise<TodoistApiResponse> {
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
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error("Error calling Edge Function:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  public async createTask(content: string, due?: string, priority?: number, labels?: string[]): Promise<TodoistApiResponse> {
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
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error("Error calling Edge Function:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  public async updateTask(taskId: string, updates: any): Promise<TodoistApiResponse> {
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
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error("Error calling Edge Function:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  public async completeTask(taskId: string): Promise<TodoistApiResponse> {
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
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error("Error calling Edge Function:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// Create a singleton instance
const todoistApi = new TodoistApi();
export default todoistApi;
