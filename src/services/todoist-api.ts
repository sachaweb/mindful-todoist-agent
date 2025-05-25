import { TodoistTask, TodoistApiResponse } from "../types";

const TODOIST_API_URL = "https://api.todoist.com/rest/v2";

export class TodoistApi {
  private apiKey: string | null = null;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.apiKey = apiKey;
      this.saveApiKey(apiKey);
    } else {
      this.apiKey = this.loadApiKey();
    }
  }

  // API Key management
  public setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    this.saveApiKey(apiKey);
  }

  public hasApiKey(): boolean {
    return !!this.apiKey;
  }

  private saveApiKey(apiKey: string): void {
    localStorage.setItem("todoist_api_key", apiKey);
  }

  private loadApiKey(): string | null {
    return localStorage.getItem("todoist_api_key");
  }

  // Task operations
  public async getTasks(): Promise<TodoistApiResponse> {
    if (!this.apiKey) {
      return { success: false, error: "No API key set" };
    }

    try {
      console.log("Making request to Todoist API with key:", this.apiKey.substring(0, 8) + "...");
      
      const response = await fetch(`${TODOIST_API_URL}/tasks`, {
        method: "GET",
        headers: this.getHeaders(),
        mode: 'cors', // Explicitly set CORS mode
      });

      console.log("Response status:", response.status);
      console.log("Response headers:", response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API error response:", errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const tasks = await response.json();
      console.log("Successfully parsed tasks:", tasks);
      return { success: true, data: tasks };
    } catch (error) {
      console.error("Detailed error in getTasks:", error);
      
      if (error instanceof TypeError && error.message === "Failed to fetch") {
        return {
          success: false,
          error: "Network error: Unable to connect to Todoist API. This might be due to CORS restrictions or network issues.",
        };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  public async createTask(content: string, due?: string, priority?: number, labels?: string[]): Promise<TodoistApiResponse> {
    if (!this.apiKey) {
      return { success: false, error: "No API key set" };
    }

    try {
      const body: any = { content };
      
      if (due) body.due_string = due;
      if (priority) body.priority = priority;
      if (labels && labels.length > 0) body.labels = labels;

      console.log("Creating task with data:", body);

      const response = await fetch(`${TODOIST_API_URL}/tasks`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        mode: 'cors',
      });

      console.log("Create task response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Create task error response:", errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const task = await response.json();
      return { success: true, data: task };
    } catch (error) {
      console.error("Error creating task:", error);
      
      if (error instanceof TypeError && error.message === "Failed to fetch") {
        return {
          success: false,
          error: "Network error: Unable to connect to Todoist API.",
        };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  public async updateTask(taskId: string, updates: Partial<TodoistTask>): Promise<TodoistApiResponse> {
    if (!this.apiKey) {
      return { success: false, error: "No API key set" };
    }

    try {
      const response = await fetch(`${TODOIST_API_URL}/tasks/${taskId}`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      // For successful updates, Todoist returns 204 No Content
      return { success: true };
    } catch (error) {
      console.error("Error updating task:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  public async completeTask(taskId: string): Promise<TodoistApiResponse> {
    if (!this.apiKey) {
      return { success: false, error: "No API key set" };
    }

    try {
      const response = await fetch(`${TODOIST_API_URL}/tasks/${taskId}/close`, {
        method: "POST",
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return { success: true };
    } catch (error) {
      console.error("Error completing task:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Helper methods
  private getHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }
}

// Create a singleton instance
const todoistApi = new TodoistApi();
export default todoistApi;
