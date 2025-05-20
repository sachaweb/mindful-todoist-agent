
import { Message, TodoistTask } from "../types";
import todoistApi from "../services/todoist-api";

// Function to detect and handle task creation intent from AI response
export const handleTaskCreationIntent = async (
  aiResponse: string,
  userMessage: string,
  createTask: (content: string, due?: string, priority?: number, labels?: string[]) => Promise<boolean>,
  addMessageToChat: (message: Message) => void
): Promise<void> => {
  console.log("Checking for task creation intent in:", aiResponse);
  
  // Extract task content and due date from AI response using regex
  // Example: "I'll create a task "Buy groceries" with due date tomorrow."
  const taskCreationRegex = /I'll create (?:a )?task "([^"]+)"(?: with due date ([^.?!]+))?/i;
  const taskCreationMatch = aiResponse.match(taskCreationRegex);
  
  if (taskCreationMatch) {
    const content = taskCreationMatch[1];
    const dueDate = taskCreationMatch[2] || "";
    let priority = 1; // Default priority
    
    console.log(`Detected task creation intent: "${content}" due: "${dueDate}"`);
    
    // Check if high priority was mentioned
    if (aiResponse.toLowerCase().includes("high priority")) {
      priority = 4;
    }
    
    // Extract labels if mentioned
    const labels: string[] = [];
    if (aiResponse.toLowerCase().includes("labels")) {
      // This is a simplistic implementation - in a real app, you'd want more 
      // sophisticated logic to extract actual labels
      const labelRegex = /labels? ([\w\s,]+)/i;
      const labelMatch = aiResponse.match(labelRegex);
      if (labelMatch) {
        const labelText = labelMatch[1];
        labels.push(...labelText.split(",").map(l => l.trim()));
      }
    }
    
    // Create the task
    if (content) {
      try {
        console.log(`Creating task: "${content}", due: "${dueDate}", priority: ${priority}, labels: [${labels.join(", ")}]`);
        const success = await createTask(content, dueDate, priority, labels);
        
        if (success) {
          // Add a confirmation message to the chat
          const confirmationMessage: Message = {
            id: Math.random().toString(36).substring(2, 11),
            content: `✅ Task "${content}" has been created${dueDate ? ` with due date ${dueDate}` : ''}.`,
            role: "assistant",
            timestamp: new Date(),
          };
          
          addMessageToChat(confirmationMessage);
        }
      } catch (error) {
        console.error("Error creating task from AI intent:", error);
      }
    }
  }
};

// Function to refresh tasks from Todoist
export const fetchTasks = async (): Promise<TodoistTask[]> => {
  if (!todoistApi.hasApiKey()) return [];
  
  const response = await todoistApi.getTasks();
  
  if (response.success && response.data) {
    return response.data;
  }
  
  return [];
};
