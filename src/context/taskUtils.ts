
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
      console.log(`🎯 Processing ONLY current batch command with ${taskMatches.length} tasks`);
      
      // Convert matches to unique task contents and clean them
      const uniqueTaskContents = [...new Set(
        taskMatches
          .map(match => match.replace(/"/g, '').trim())
          .filter(task => task.length > 0) // Remove empty tasks
      )];
      
      console.log("Final unique tasks to create from current command:", uniqueTaskContents);
      console.log("Expected task count from AI response:", taskCount);
      console.log("Actual tasks extracted:", uniqueTaskContents.length);
      
      // Validate that we're not processing more tasks than requested
      if (uniqueTaskContents.length > taskCount) {
        console.warn("⚠️ More tasks extracted than expected - possible contamination from previous responses");
        // Take only the number of tasks mentioned in the AI response
        uniqueTaskContents.splice(taskCount);
        console.log("Trimmed to expected count:", uniqueTaskContents);
      }
      
      let successCount = 0;
      let failureCount = 0;
      const createdTasks: string[] = [];
      const detailedResults: string[] = [];
      
      // Process each unique task exactly once
      for (const taskContent of uniqueTaskContents) {
        if (taskContent) {
          console.log(`🚀 Creating task: "${taskContent}"`);
          
          // Parse due date, priority, and labels for each task
          const { cleanContent, dueDate, priority, labels } = parseTaskDetails(taskContent, userMessage);
          
          // Add detailed parsing info
          detailedResults.push(`📋 Task: "${cleanContent}"`);
          detailedResults.push(`   📅 Due string sent to Todoist: ${dueDate ? `"${dueDate}"` : 'None'}`);
          detailedResults.push(`   ⚡ Priority: ${priority} (${priority === 4 ? 'P1-Highest' : priority === 3 ? 'P2-High' : priority === 2 ? 'P3-Medium' : 'P4-Low'})`);
          detailedResults.push(`   🏷️ Labels: ${labels.length > 0 ? labels.join(', ') : 'None'}`);
          
          try {
            const success = await createTask(cleanContent, dueDate, priority, labels);
            if (success) {
              successCount++;
              createdTasks.push(cleanContent);
              detailedResults.push(`   ✅ Result: SUCCESS - Task created in Todoist`);
              console.log(`✅ Successfully created: "${cleanContent}"`);
            } else {
              failureCount++;
              detailedResults.push(`   ❌ Result: FAILED - Task creation failed`);
              console.log(`❌ Failed to create: "${cleanContent}"`);
            }
          } catch (error) {
            failureCount++;
            detailedResults.push(`   💥 Result: ERROR - ${error instanceof Error ? error.message : 'Unknown error'}`);
            console.error(`💥 Error creating task "${cleanContent}":`, error);
          }
          detailedResults.push(''); // Add blank line between tasks
        }
      }
      
      // Add comprehensive summary message to chat
      let summaryMessage = `🎯 BATCH TASK CREATION SUMMARY:\n\n`;
      summaryMessage += detailedResults.join('\n');
      summaryMessage += `📊 FINAL RESULTS:\n`;
      summaryMessage += `✅ Successfully created: ${successCount} task${successCount !== 1 ? 's' : ''}\n`;
      if (failureCount > 0) {
        summaryMessage += `❌ Failed to create: ${failureCount} task${failureCount !== 1 ? 's' : ''}\n`;
      }
      
      const confirmationMessage: Message = {
        id: Math.random().toString(36).substring(2, 11),
        content: summaryMessage.trim(),
        role: "assistant",
        timestamp: new Date(),
      };
      
      addMessageToChat(confirmationMessage);
      console.log("=== BATCH TASK CREATION COMPLETE ===");
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
        matchFound = true;
        console.log("✓ Single task creation pattern matched in user message:", { taskContent });
        break;
      }
    }
  }
  
  // Check for task update intent
  const taskUpdateRegex = /I'll (?:update|change) the due date for (?:your )?task "([^"]+)" to ([^.?!]+)/i;
  const taskUpdateMatch = aiResponse.match(taskUpdateRegex);
  
  if (matchFound && taskContent) {
    console.log(`🎯 CREATING SINGLE TASK: "${taskContent}"`);
    
    // Parse task details from both user message and task content
    const { cleanContent, dueDate: parsedDueDate, priority, labels } = parseTaskDetails(taskContent, userMessage);
    const finalDueDate = dueDate || parsedDueDate; // Use AI-provided due date if available, otherwise parsed
    
    console.log(`📋 Task details:`, { cleanContent, finalDueDate, priority, labels });
    
    // Create detailed pre-creation summary
    let detailMessage = `🎯 CREATING SINGLE TASK:\n\n`;
    detailMessage += `📋 Task content: "${cleanContent}"\n`;
    detailMessage += `📅 Due string sent to Todoist: ${finalDueDate ? `"${finalDueDate}"` : 'None'}\n`;
    detailMessage += `⚡ Priority: ${priority} (${priority === 4 ? 'P1-Highest' : priority === 3 ? 'P2-High' : priority === 2 ? 'P3-Medium' : 'P4-Low'})\n`;
    detailMessage += `🏷️ Labels: ${labels.length > 0 ? labels.join(', ') : 'None'}\n\n`;
    
    // Create the task
    try {
      console.log(`🚀 Calling createTask API with:`, { cleanContent, finalDueDate, priority, labels });
      const success = await createTask(cleanContent, finalDueDate || undefined, priority, labels);
      
      if (success) {
        detailMessage += `✅ RESULT: SUCCESS - Task created successfully in Todoist\n`;
        detailMessage += `📝 NOTE: Check Todoist to verify the due date was parsed correctly by Todoist's natural language processor.`;
        
        // Add a confirmation message to the chat
        const confirmationMessage: Message = {
          id: Math.random().toString(36).substring(2, 11),
          content: detailMessage,
          role: "assistant",
          timestamp: new Date(),
        };
        
        console.log("✅ Task created successfully, adding detailed confirmation message");
        addMessageToChat(confirmationMessage);
      } else {
        detailMessage += `❌ RESULT: FAILED - Task creation failed\n`;
        detailMessage += `🔍 TROUBLESHOOTING: Check your Todoist connection and try again.`;
        
        // Add error message if task creation failed
        const errorMessage: Message = {
          id: Math.random().toString(36).substring(2, 11),
          content: detailMessage,
          role: "assistant",
          timestamp: new Date(),
        };
        
        console.log("❌ Task creation failed, adding detailed error message");
        addMessageToChat(errorMessage);
      }
    } catch (error) {
      console.error("💥 Error creating task from AI intent:", error);
      
      detailMessage += `💥 RESULT: ERROR - ${error instanceof Error ? error.message : 'Unknown error'}\n`;
      detailMessage += `🔍 TROUBLESHOOTING: Check your internet connection and Todoist API access.`;
      
      // Add error message to chat
      const errorMessage: Message = {
        id: Math.random().toString(36).substring(2, 11),
        content: detailMessage,
        role: "assistant",
        timestamp: new Date(),
      };
      
      addMessageToChat(errorMessage);
    }
  }
  else if (taskUpdateMatch) {
    const taskName = taskUpdateMatch[1];
    const newDueDate = taskUpdateMatch[2];
    
    console.log(`🔄 DETECTED TASK UPDATE INTENT: Update "${taskName}" due date to "${newDueDate}"`);
    
    let updateMessage = `🔄 UPDATING TASK DUE DATE:\n\n`;
    updateMessage += `🔍 Searching for task: "${taskName}"\n`;
    updateMessage += `📅 New due date: "${newDueDate}"\n\n`;
    
    try {
      // Use targeted search to find the task
      console.log(`Searching for tasks containing: "${taskName}"`);
      const searchResponse = await todoistApi.searchTasks(taskName);
      
      if (!searchResponse.success) {
        console.error("Failed to search for tasks:", searchResponse.error);
        
        updateMessage += `❌ SEARCH FAILED: ${searchResponse.error || 'Unable to search for tasks'}\n`;
        updateMessage += `🔍 TROUBLESHOOTING: Check your Todoist connection and try again.`;
        
        const errorMessage: Message = {
          id: Math.random().toString(36).substring(2, 11),
          content: updateMessage,
          role: "assistant",
          timestamp: new Date(),
        };
        
        addMessageToChat(errorMessage);
        return;
      }

      const foundTasks = searchResponse.data || [];
      updateMessage += `📊 Search results: Found ${foundTasks.length} task(s)\n`;
      
      // Find the most relevant task (exact match or best partial match)
      const taskToUpdate = foundTasks.find(task => 
        task.content.toLowerCase().includes(taskName.toLowerCase())
      );
      
      if (taskToUpdate) {
        console.log(`Found task to update: ${taskToUpdate.id} - ${taskToUpdate.content}`);
        updateMessage += `✅ Found matching task: "${taskToUpdate.content}" (ID: ${taskToUpdate.id})\n`;
        updateMessage += `📅 Current due date: ${taskToUpdate.due ? taskToUpdate.due.string || taskToUpdate.due.date : 'None'}\n\n`;
        
        // Update the task with new due date
        const updateResponse = await todoistApi.updateTask(taskToUpdate.id, {
          due_string: newDueDate
        });
        
        if (updateResponse.success) {
          updateMessage += `✅ UPDATE SUCCESS: Task due date updated to "${newDueDate}"\n`;
          updateMessage += `📝 NOTE: Check Todoist to verify the new due date was parsed correctly.`;
          
          // Add a confirmation message to the chat
          const confirmationMessage: Message = {
            id: Math.random().toString(36).substring(2, 11),
            content: updateMessage,
            role: "assistant",
            timestamp: new Date(),
          };
          
          addMessageToChat(confirmationMessage);
        } else {
          console.error("Failed to update task:", updateResponse.error);
          
          updateMessage += `❌ UPDATE FAILED: ${updateResponse.error || 'Unknown error'}\n`;
          updateMessage += `🔍 TROUBLESHOOTING: Check your Todoist connection and task permissions.`;
          
          // Add an error message to the chat
          const errorMessage: Message = {
            id: Math.random().toString(36).substring(2, 11),
            content: updateMessage,
            role: "assistant",
            timestamp: new Date(),
          };
          
          addMessageToChat(errorMessage);
        }
      } else {
        console.log(`Task "${taskName}" not found in search results`);
        
        updateMessage += `❌ NO MATCH: No task found containing "${taskName}"\n`;
        if (foundTasks.length > 0) {
          updateMessage += `📋 Available tasks found:\n`;
          foundTasks.slice(0, 5).forEach(task => {
            updateMessage += `   • "${task.content}"\n`;
          });
        }
        updateMessage += `🔍 TROUBLESHOOTING: Try using the exact task name or create a new task instead.`;
        
        // Add a message indicating task not found
        const notFoundMessage: Message = {
          id: Math.random().toString(36).substring(2, 11),
          content: updateMessage,
          role: "assistant",
          timestamp: new Date(),
        };
        
        addMessageToChat(notFoundMessage);
      }
    } catch (error) {
      console.error("Error updating task from AI intent:", error);
      
      updateMessage += `💥 UPDATE ERROR: ${error instanceof Error ? error.message : 'Unknown error'}\n`;
      updateMessage += `🔍 TROUBLESHOOTING: Check your internet connection and try again.`;
      
      // Add an error message to the chat
      const errorMessage: Message = {
        id: Math.random().toString(36).substring(2, 11),
        content: updateMessage,
        role: "assistant",
        timestamp: new Date(),
      };
      
      addMessageToChat(errorMessage);
    }
  } else {
    console.log("❌ No task creation or update intent detected");
  }
};

// FIXED: Improved function to parse task details with better due date extraction
function parseTaskDetails(taskContent: string, userMessage: string): {
  cleanContent: string;
  dueDate: string | undefined;
  priority: number;
  labels: string[];
} {
  let cleanContent = taskContent;
  let dueDate: string | undefined;
  let priority = 1; // Default priority (lowest in Todoist API)
  let labels: string[] = [];

  console.log(`🔍 PARSING TASK DETAILS:`);
  console.log(`   Input task content: "${taskContent}"`);
  console.log(`   Input user message: "${userMessage}"`);

  // IMPROVED: Better due date extraction patterns that handle "call dad next Friday" correctly
  const dueDatePatterns = [
    // Pattern for "task content due date" format
    /^(.+?)\s+due\s+(.+?)(?:\s+with|\s+label|$)/i,
    // Pattern for just "due date" at the end
    /^(.+?)\s+due\s+(.+)$/i,
    // Pattern for "due date" anywhere in the content
    /due\s+([^,]+?)(?:\s+with|\s+label|,|$)/i
  ];

  // Check task content first with improved patterns
  for (const pattern of dueDatePatterns) {
    const match = taskContent.match(pattern);
    if (match) {
      if (pattern.source.startsWith('^(.+?)')) {
        // Patterns that capture both task content and due date
        cleanContent = match[1].trim();
        dueDate = match[2].trim();
        console.log(`📅 EXTRACTED from task content - Task: "${cleanContent}", Due: "${dueDate}"`);
      } else {
        // Pattern that only captures due date
        dueDate = match[1].trim();
        cleanContent = taskContent.replace(/\s+due\s+[^,]+/i, '').trim();
        console.log(`📅 EXTRACTED due date only: "${dueDate}", Cleaned content: "${cleanContent}"`);
      }
      break;
    }
  }

  // If no due date found in task content, check user message
  if (!dueDate) {
    for (const pattern of dueDatePatterns) {
      const match = userMessage.match(pattern);
      if (match) {
        if (pattern.source.includes('(.+?)')) {
          dueDate = match[match.length - 1].trim(); // Get the last capture group (due date)
        } else {
          dueDate = match[1].trim();
        }
        console.log(`📅 EXTRACTED due date from user message: "${dueDate}"`);
        break;
      }
    }
  }

  // Priority mapping - P1=highest priority (4), P4=lowest priority (1)
  const priorityPatterns = [
    { pattern: /\b(urgent|critical|asap|immediately|high.priority|p1)\b/i, priority: 4 }, // Highest priority
    { pattern: /\b(important|high|p2)\b/i, priority: 3 },
    { pattern: /\b(medium|normal|p3)\b/i, priority: 2 },
    { pattern: /\b(low|minor|p4)\b/i, priority: 1 } // Lowest priority
  ];

  // Check both task content and user message for priority keywords
  const fullText = `${taskContent} ${userMessage}`.toLowerCase();
  for (const { pattern, priority: priorityValue } of priorityPatterns) {
    if (pattern.test(fullText)) {
      priority = priorityValue;
      console.log(`⚡ PRIORITY detected: ${priorityValue} (${priorityValue === 4 ? 'P1-Highest' : priorityValue === 3 ? 'P2-High' : priorityValue === 2 ? 'P3-Medium' : 'P4-Low'}) from pattern: ${pattern}`);
      break;
    }
  }

  // Enhanced label extraction and processing
  const labelPatterns = [
    /with\s+labels?\s+([\w\s,\-&]+?)(?:\s+due|\s*$)/i,
    /labels?\s+([\w\s,\-&]+?)(?:\s+due|\s*$)/i
  ];

  for (const pattern of labelPatterns) {
    const match = userMessage.match(pattern) || taskContent.match(pattern);
    if (match) {
      const labelText = match[1];
      console.log(`🏷️ Raw label text found: "${labelText}"`);
      
      // Split by comma and clean up - improved processing
      labels = labelText
        .split(/[,\s]+/) // Split by comma or whitespace
        .map(label => label.trim().toLowerCase())
        .filter(label => label.length > 0 && !['and', 'with', 'labels', 'label'].includes(label));
      
      console.log(`🏷️ Processed labels: [${labels.join(', ')}]`);
      
      // Remove label text from clean content
      cleanContent = cleanContent.replace(match[0], '').trim();
      break;
    }
  }

  console.log(`📋 FINAL PARSED DETAILS:`);
  console.log(`   Clean content: "${cleanContent}"`);
  console.log(`   Due date: ${dueDate ? `"${dueDate}" (will be passed directly to Todoist)` : 'None'}`);
  console.log(`   Priority: ${priority} (${priority === 4 ? 'P1-Highest' : priority === 3 ? 'P2-High' : priority === 2 ? 'P3-Medium' : 'P4-Low'})`);
  console.log(`   Labels: [${labels.join(', ')}]`);

  return {
    cleanContent,
    dueDate, // Pass the raw phrase directly to Todoist
    priority,
    labels
  };
}

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
