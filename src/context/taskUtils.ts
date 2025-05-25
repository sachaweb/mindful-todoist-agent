
import { Message, TodoistTask } from "../types";
import todoistApi from "../services/todoist-api";

// Function to detect and handle task creation intent from AI response
export const handleTaskCreationIntent = async (
  aiResponse: string,
  userMessage: string,
  createTask: (content: string, due?: string, priority?: number, labels?: string[]) => Promise<boolean>,
  addMessageToChat: (message: Message) => void,
  existingTasks: TodoistTask[] = []
): Promise<void> => {
  console.log("Checking for task creation intent in:", aiResponse);
  
  // Extract task content and due date from AI response using regex
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
    const taskName = taskUpdateMatch[1];
    const newDueDate = taskUpdateMatch[2];
    
    console.log(`Detected task update intent: Update "${taskName}" due date to "${newDueDate}"`);
    
    try {
      // Use targeted search instead of relying on existing tasks
      console.log(`Searching for tasks containing: "${taskName}"`);
      const searchResponse = await todoistApi.searchTasks(taskName);
      
      if (!searchResponse.success) {
        console.error("Failed to search for tasks:", searchResponse.error);
        
        const errorMessage: Message = {
          id: Math.random().toString(36).substring(2, 11),
          content: `❌ Failed to search for task "${taskName}". ${searchResponse.error || 'Please try again.'}`,
          role: "assistant",
          timestamp: new Date(),
        };
        
        addMessageToChat(errorMessage);
        return;
      }

      const foundTasks = searchResponse.data || [];
      
      // Find the most relevant task (exact match or best partial match)
      const taskToUpdate = foundTasks.find(task => 
        task.content.toLowerCase().includes(taskName.toLowerCase())
      );
      
      if (taskToUpdate) {
        console.log(`Found task to update: ${taskToUpdate.id} - ${taskToUpdate.content}`);
        
        // Update the task with new due date
        const updateResponse = await todoistApi.updateTask(taskToUpdate.id, {
          due_string: newDueDate
        });
        
        if (updateResponse.success) {
          // Add a confirmation message to the chat
          const confirmationMessage: Message = {
            id: Math.random().toString(36).substring(2, 11),
            content: `✅ Task "${taskName}" due date has been updated to ${newDueDate}.`,
            role: "assistant",
            timestamp: new Date(),
          };
          
          addMessageToChat(confirmationMessage);
        } else {
          console.error("Failed to update task:", updateResponse.error);
          
          // Add an error message to the chat
          const errorMessage: Message = {
            id: Math.random().toString(36).substring(2, 11),
            content: `❌ Failed to update task "${taskName}". ${updateResponse.error || 'Please try again.'}`,
            role: "assistant",
            timestamp: new Date(),
          };
          
          addMessageToChat(errorMessage);
        }
      } else {
        console.log(`Task "${taskName}" not found in search results`);
        
        // Add a message indicating task not found
        const notFoundMessage: Message = {
          id: Math.random().toString(36).substring(2, 11),
          content: `❌ Task "${taskName}" not found. Please check the task name and try again.`,
          role: "assistant",
          timestamp: new Date(),
        };
        
        addMessageToChat(notFoundMessage);
      }
    } catch (error) {
      console.error("Error updating task from AI intent:", error);
      
      // Add an error message to the chat
      const errorMessage: Message = {
        id: Math.random().toString(36).substring(2, 11),
        content: `❌ Error searching for task "${taskName}". Please try again.`,
        role: "assistant",
        timestamp: new Date(),
      };
      
      addMessageToChat(errorMessage);
    }
  }
};

// Function to refresh tasks from Todoist with optional filtering
export const fetchTasks = async (filter?: string): Promise<TodoistTask[]> => {
  if (!todoistApi.hasApiKey()) {
    console.log("No Todoist API key available");
    return [];
  }
  
  try {
    console.log("Fetching tasks from Todoist API with filter:", filter);
    const response = await todoistApi.getTasks(filter);
    
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
