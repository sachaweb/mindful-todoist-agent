
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
      const response = await fetch(`${TODOIST_API_URL}/tasks`, {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const tasks = await response.json();
      return { success: true, data: tasks };
    } catch (error) {
      console.error("Error fetching tasks:", error);
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

      const response = await fetch(`${TODOIST_API_URL}/tasks`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const task = await response.json();
      return { success: true, data: task };
    } catch (error) {
      console.error("Error creating task:", error);
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
