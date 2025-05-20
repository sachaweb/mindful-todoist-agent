
export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  status?: 'sending' | 'sent' | 'error';
}

export interface TodoistTask {
  id: string;
  content: string;
  priority: number; // 1-4, 4 is highest
  due?: {
    date: string;
    string?: string;
    datetime?: string;
  };
  labels: string[];
  completed: boolean;
  project_id?: string;
}

export interface ConversationContext {
  recentMessages: Message[];
  openTasks?: TodoistTask[];
  lastSuggestion?: string;
  lastQuery?: string;
}

export interface TodoistApiResponse {
  success: boolean;
  data?: any;
  error?: string;
}
