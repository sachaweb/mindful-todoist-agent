import { Message, TodoistTask } from "../types";
import todoistApi from "../services/todoist-api";

// Function to detect and handle task creation intent from AI response
export const handleTaskCreationIntent = async (
  aiResponse: string,
  userMessage: string,
  createTask: (content: string, due?: string, priority?: number, labels?: string[]) => Promise<boolean>,
  addMessageToChat: (message: Message) => void
): Promise<void> => {
  console.log("=== TASK CREATION INTENT DETECTION ===");
  console.log("AI Response:", aiResponse);
  console.log("User Message:", userMessage);
  
  // Check for multiple task creation intent first
  const multipleTaskPattern = /I'll create (?:the following )?(\d+) tasks?[:\s]*\n?((?:"[^"]+"\s*\n?)*)/i;
  const multipleTaskMatch = aiResponse.match(multipleTaskPattern);
  
  if (multipleTaskMatch) {
    console.log("✓ Multiple task creation detected");
    const taskCount = parseInt(multipleTaskMatch[1]);
    const tasksSection = multipleTaskMatch[2] || "";
    
    // Extract individual task names from quoted strings
    const taskMatches = tasksSection.match(/"([^"]+)"/g);
    
    if (taskMatches && taskMatches.length > 0) {
      console.log(`🎯 Creating ${taskMatches.length} separate tasks`);
      
      let successCount = 0;
      let failureCount = 0;
      const createdTasks: string[] = [];
      
      for (const taskMatch of taskMatches) {
        const taskContent = taskMatch.replace(/"/g, '').trim();
        if (taskContent) {
          console.log(`🚀 Creating individual task: "${taskContent}"`);
          
          try {
            const success = await createTask(taskContent, undefined, 1, []);
            if (success) {
              successCount++;
              createdTasks.push(taskContent);
              console.log(`✅ Successfully created: "${taskContent}"`);
            } else {
              failureCount++;
              console.log(`❌ Failed to create: "${taskContent}"`);
            }
          } catch (error) {
            failureCount++;
            console.error(`💥 Error creating task "${taskContent}":`, error);
          }
        }
      }
      
      // Add summary message to chat
      let summaryMessage = "";
      if (successCount > 0) {
        summaryMessage += `✅ Successfully created ${successCount} task${successCount > 1 ? 's' : ''}:\n`;
        createdTasks.forEach(task => {
          summaryMessage += `• ${task}\n`;
        });
      }
      
      if (failureCount > 0) {
        summaryMessage += `❌ Failed to create ${failureCount} task${failureCount > 1 ? 's' : ''}.`;
      }
      
      const confirmationMessage: Message = {
        id: Math.random().toString(36).substring(2, 11),
        content: summaryMessage.trim(),
        role: "assistant",
        timestamp: new Date(),
      };
      
      addMessageToChat(confirmationMessage);
      return; // Exit early since we handled multiple tasks
    }
  }
  
  // Fallback to original single task creation logic
  const taskCreationPatterns = [
    /I'll create (?:a )?task[:\s]*"?([^"]+)"?(?:\s*with due date\s+([^.?!]+))?/i,
    /I'll create (?:a )?task[:\s]*([^.?!]+?)(?:\s*with due date\s+([^.?!]+))?(?:\s*for you)?[.!]?$/i,
    /Creating (?:a )?task[:\s]*"?([^"]+)"?(?:\s*due\s+([^.?!]+))?/i,
    /Task created[:\s]*"?([^"]+)"?(?:\s*due\s+([^.?!]+))?/i
  ];
  
  // Also check if user message directly asks to create a task
  const userTaskPatterns = [
    /create (?:a )?task[:\s]*"?([^"]+)"?/i,
    /add (?:a )?task[:\s]*"?([^"]+)"?/i,
    /new task[:\s]*"?([^"]+)"?/i,
    /task[:\s]*"?([^"]+)"?/i
  ];
  
  let taskContent = "";
  let dueDate = "";
  let matchFound = false;
  
  // First check AI response for task creation intent
  for (const pattern of taskCreationPatterns) {
    const match = aiResponse.match(pattern);
    if (match) {
      taskContent = match[1].trim();
      dueDate = match[2] ? match[2].trim() : "";
      matchFound = true;
      console.log("✓ Single task creation pattern matched in AI response:", { taskContent, dueDate });
      break;
    }
  }
  
  // If no match in AI response, check user message
  if (!matchFound) {
    for (const pattern of userTaskPatterns) {
      const match = userMessage.match(pattern);
      if (match) {
        taskContent = match[1].trim();
        // Extract due date from user message if present
        const dueDateMatch = userMessage.match(/(?:due|by|on)\s+([^.?!]+)/i);
        dueDate = dueDateMatch ? dueDateMatch[1].trim() : "";
        matchFound = true;
        console.log("✓ Single task creation pattern matched in user message:", { taskContent, dueDate });
        break;
      }
    }
  }
  
  // Check for task update intent
  const taskUpdateRegex = /I'll (?:update|change) the due date for (?:your )?task "([^"]+)" to ([^.?!]+)/i;
  const taskUpdateMatch = aiResponse.match(taskUpdateRegex);
  
  if (matchFound && taskContent) {
    let priority = 1; // Default priority
    
    console.log(`🎯 CREATING SINGLE TASK: "${taskContent}" due: "${dueDate}"`);
    
    // Check if high priority was mentioned
    if (aiResponse.toLowerCase().includes("high priority") || 
        aiResponse.toLowerCase().includes("urgent") || 
        userMessage.toLowerCase().includes("urgent") ||
        userMessage.toLowerCase().includes("important")) {
      priority = 4;
      console.log("⚡ High priority detected");
    }
    
    // Extract labels if mentioned
    const labels: string[] = [];
    if (aiResponse.toLowerCase().includes("label") || userMessage.toLowerCase().includes("label")) {
      const labelRegex = /labels?\s+([\w\s,]+)/i;
      const labelMatch = aiResponse.match(labelRegex) || userMessage.match(labelRegex);
      if (labelMatch) {
        const labelText = labelMatch[1];
        labels.push(...labelText.split(",").map(l => l.trim()));
        console.log("🏷️ Labels detected:", labels);
      }
    }
    
    // Create the task
    try {
      console.log(`🚀 Calling createTask API with:`, { taskContent, dueDate, priority, labels });
      const success = await createTask(taskContent, dueDate || undefined, priority, labels);
      
      if (success) {
        // Add a confirmation message to the chat
        const confirmationMessage: Message = {
          id: Math.random().toString(36).substring(2, 11),
          content: `✅ Task "${taskContent}" has been created successfully in Todoist${dueDate ? ` with due date ${dueDate}` : ''}.`,
          role: "assistant",
          timestamp: new Date(),
        };
        
        console.log("✅ Task created successfully, adding confirmation message");
        addMessageToChat(confirmationMessage);
      } else {
        // Add error message if task creation failed
        const errorMessage: Message = {
          id: Math.random().toString(36).substring(2, 11),
          content: `❌ Failed to create task "${taskContent}" in Todoist. Please try again or check your connection.`,
          role: "assistant",
          timestamp: new Date(),
        };
        
        console.log("❌ Task creation failed, adding error message");
        addMessageToChat(errorMessage);
      }
    } catch (error) {
      console.error("💥 Error creating task from AI intent:", error);
      
      // Add error message to chat
      const errorMessage: Message = {
        id: Math.random().toString(36).substring(2, 11),
        content: `❌ Error creating task "${taskContent}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        role: "assistant",
        timestamp: new Date(),
      };
      
      addMessageToChat(errorMessage);
    }
  }
  else if (taskUpdateMatch) {
    const taskName = taskUpdateMatch[1];
    const newDueDate = taskUpdateMatch[2];
    
    console.log(`Detected task update intent: Update "${taskName}" due date to "${newDueDate}"`);
    
    try {
      // Use targeted search to find the task
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
  } else {
    console.log("❌ No task creation or update intent detected");
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
