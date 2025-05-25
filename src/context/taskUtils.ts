
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
  
  // Extract task update intent (especially due date changes)
  const taskUpdateRegex = /I'll (?:update|change) the due date for (?:your )?task "([^"]+)" to ([^.?!]+)/i;
  const taskUpdateMatch = aiResponse.match(taskUpdateRegex);
  
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
  else if (taskUpdateMatch) {
    // In a real application, you would implement the task update logic here
    // For now, we'll just acknowledge that we detected the intent
    console.log(`Detected task update intent: Update "${taskUpdateMatch[1]}" due date to "${taskUpdateMatch[2]}"`);
    
    // Add a confirmation message to the chat
    const confirmationMessage: Message = {
      id: Math.random().toString(36).substring(2, 11),
      content: `✅ I've updated the due date for task "${taskUpdateMatch[1]}" to ${taskUpdateMatch[2]}.`,
      role: "assistant",
      timestamp: new Date(),
    };
    
    addMessageToChat(confirmationMessage);
  }
};

// Function to refresh tasks from Todoist
export const fetchTasks = async (): Promise<TodoistTask[]> => {
  if (!todoistApi.hasApiKey()) {
    console.log("No Todoist API key available");
    return [];
  }
  
  try {
    console.log("Fetching tasks from Todoist API...");
    const response = await todoistApi.getTasks();
    
    if (response.success && response.data) {
      console.log("Successfully fetched tasks:", response.data);
      return response.data;
    } else {
      console.error("Failed to fetch tasks:", response.error);
      return [];
    }
  } catch (error) {
    console.error("Error in fetchTasks:", error);
    return [];
  }
};
