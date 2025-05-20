
import { Message, TodoistTask } from "../types";

export interface TodoistAgentContextProps {
  messages: Message[];
  isLoading: boolean;
  apiKeySet: boolean;
  suggestions: string[];
  tasks: TodoistTask[];
  setApiKey: (key: string) => Promise<boolean>;
  sendMessage: (content: string) => Promise<void>;
  refreshTasks: () => Promise<void>;
  createTask: (content: string, due?: string, priority?: number, labels?: string[]) => Promise<boolean>;
  completeTask: (taskId: string) => Promise<boolean>;
}

export interface TodoistAgentProviderProps {
  children: React.ReactNode;
}
