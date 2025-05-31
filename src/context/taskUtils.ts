
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
  console.log("=== TASK CREATION INTENT DETECTION ===");
  console.log("AI Response:", aiResponse);
  console.log("User Message:", userMessage);
  console.log("Existing tasks:", existingTasks.length);
  
  // Check for task update intent first
  const taskUpdateRegex = /(?:change|update|modify|set).*?(?:task|the)\s*"?([^"]+?)"?\s*(?:to be )?(?:due|to)\s+([^.?!]+)/i;
  const taskUpdateMatch = aiResponse.match(taskUpdateRegex) || userMessage.match(taskUpdateRegex);
  
  if (taskUpdateMatch) {
    const taskName = taskUpdateMatch[1].trim();
    const newDueDate = taskUpdateMatch[2].trim();
    
    console.log(`🔄 DETECTED TASK UPDATE INTENT: Update "${taskName}" due date to "${newDueDate}"`);
    await handleTaskUpdate(taskName, newDueDate, addMessageToChat, existingTasks);
    return;
  }
  
  // Check for multiple task creation intent
  const multipleTaskPattern = /I'll create (?:the following )?(\d+) tasks?[:\s]*\n?((?:"[^"]+"\s*\n?)*)/i;
  const multipleTaskMatch = aiResponse.match(multipleTaskPattern);
  
  if (multipleTaskMatch) {
    console.log("✓ Multiple task creation detected");
    const taskCount = parseInt(multipleTaskMatch[1]);
    const tasksSection = multipleTaskMatch[2] || "";
    
    // Extract individual task names from quoted strings
    const taskMatches = tasksSection.match(/"([^"]+)"/g);
    
    if (taskMatches && taskMatches.length > 0) {
      console.log(`🎯 Processing batch command with ${taskMatches.length} tasks`);
      
      // Convert matches to unique task contents and clean them
      const uniqueTaskContents = [...new Set(
        taskMatches
          .map(match => match.replace(/"/g, '').trim())
          .filter(task => task.length > 0)
      )];
      
      // Process each task with duplicate detection
      for (const taskContent of uniqueTaskContents) {
        const { cleanContent, dueDate, priority, labels } = parseTaskDetails(taskContent, userMessage);
        await handleSingleTaskCreation(cleanContent, dueDate, priority, labels, createTask, addMessageToChat, existingTasks);
      }
      return;
    }
  }
  
  // Handle single task creation
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
  
  if (matchFound && taskContent) {
    console.log(`🎯 CREATING SINGLE TASK: "${taskContent}"`);
    const { cleanContent, dueDate: parsedDueDate, priority, labels } = parseTaskDetails(taskContent, userMessage);
    const finalDueDate = dueDate || parsedDueDate;
    
    await handleSingleTaskCreation(cleanContent, finalDueDate, priority, labels, createTask, addMessageToChat, existingTasks);
  } else {
    console.log("❌ No task creation or update intent detected");
  }
};

// Function to handle individual task creation with duplicate detection
async function handleSingleTaskCreation(
  cleanContent: string,
  dueDate: string | undefined,
  priority: number,
  labels: string[],
  createTask: (content: string, due?: string, priority?: number, labels?: string[]) => Promise<boolean>,
  addMessageToChat: (message: Message) => void,
  existingTasks: TodoistTask[]
): Promise<void> {
  console.log(`📋 Processing task creation: "${cleanContent}"`);
  
  // Check for duplicate tasks
  const duplicates = existingTasks.filter(task => 
    task.content.toLowerCase().includes(cleanContent.toLowerCase()) ||
    cleanContent.toLowerCase().includes(task.content.toLowerCase())
  );
  
  if (duplicates.length > 0) {
    let duplicateMessage = `🔍 DUPLICATE TASK DETECTED:\n\n`;
    duplicateMessage += `You want to create: "${cleanContent}"\n\n`;
    duplicateMessage += `But I found ${duplicates.length} similar task${duplicates.length > 1 ? 's' : ''}:\n`;
    
    duplicates.forEach((task, index) => {
      duplicateMessage += `${index + 1}. "${task.content}"`;
      if (task.due) duplicateMessage += ` (Due: ${task.due.string || task.due.date})`;
      duplicateMessage += ` [Priority: P${5 - task.priority}]`;
      duplicateMessage += `\n`;
    });
    
    duplicateMessage += `\n❓ What would you like to do?\n`;
    duplicateMessage += `• Say "create anyway" to create the new task\n`;
    duplicateMessage += `• Say "update task [number]" to modify an existing task\n`;
    duplicateMessage += `• Say "cancel" to cancel this action`;
    
    const duplicateWarning: Message = {
      id: Math.random().toString(36).substring(2, 11),
      content: duplicateMessage,
      role: "assistant",
      timestamp: new Date(),
    };
    
    addMessageToChat(duplicateWarning);
    return;
  }
  
  // Check for ambiguous priority terms
  if (hasAmbiguousPriority(cleanContent)) {
    let priorityMessage = `⚡ PRIORITY CLARIFICATION NEEDED:\n\n`;
    priorityMessage += `You used an ambiguous priority term for: "${cleanContent}"\n\n`;
    priorityMessage += `📊 Todoist Priority Guide (Eisenhower Matrix):\n`;
    priorityMessage += `• P1 (Urgent & Important): Critical deadlines, emergencies\n`;
    priorityMessage += `• P2 (Important, Not Urgent): Strategic work, planning\n`;
    priorityMessage += `• P3 (Urgent, Not Important): Interruptions, some emails\n`;
    priorityMessage += `• P4 (Neither): Everything else, routine tasks\n\n`;
    priorityMessage += `❓ Please specify:\n`;
    priorityMessage += `• Say "make it P1" for urgent and important\n`;
    priorityMessage += `• Say "make it P2" for important but not urgent\n`;
    priorityMessage += `• Say "make it P3" for urgent but not important\n`;
    priorityMessage += `• Say "make it P4" or "proceed" for normal priority`;
    
    const priorityQuestion: Message = {
      id: Math.random().toString(36).substring(2, 11),
      content: priorityMessage,
      role: "assistant",
      timestamp: new Date(),
    };
    
    addMessageToChat(priorityQuestion);
    return;
  }
  
  // Proceed with task creation
  await executeTaskCreation(cleanContent, dueDate, priority, labels, createTask, addMessageToChat);
}

// Function to handle task updates
async function handleTaskUpdate(
  taskName: string,
  newDueDate: string,
  addMessageToChat: (message: Message) => void,
  existingTasks: TodoistTask[]
): Promise<void> {
  console.log(`🔄 HANDLING TASK UPDATE: "${taskName}" to due "${newDueDate}"`);
  
  let updateMessage = `🔄 UPDATING TASK DUE DATE:\n\n`;
  updateMessage += `🔍 Searching for task: "${taskName}"\n`;
  updateMessage += `📅 New due date: "${newDueDate}"\n\n`;
  
  try {
    // Search in existing tasks first
    const matchingTasks = existingTasks.filter(task => 
      task.content.toLowerCase().includes(taskName.toLowerCase())
    );
    
    if (matchingTasks.length === 0) {
      // Try API search if no local matches
      console.log(`No local matches found, searching via API for: "${taskName}"`);
      const searchResponse = await todoistApi.searchTasks(taskName);
      
      if (!searchResponse.success) {
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
      const apiMatches = foundTasks.filter(task => 
        task.content.toLowerCase().includes(taskName.toLowerCase())
      );
      
      if (apiMatches.length > 0) {
        matchingTasks.push(...apiMatches);
      }
    }
    
    updateMessage += `📊 Search results: Found ${matchingTasks.length} matching task(s)\n\n`;
    
    if (matchingTasks.length === 0) {
      updateMessage += `❌ NO MATCH: No task found containing "${taskName}"\n`;
      updateMessage += `🔍 SUGGESTION: Check the exact task name or create a new task instead.`;
      
      const notFoundMessage: Message = {
        id: Math.random().toString(36).substring(2, 11),
        content: updateMessage,
        role: "assistant",
        timestamp: new Date(),
      };
      
      addMessageToChat(notFoundMessage);
      return;
    }
    
    if (matchingTasks.length > 1) {
      updateMessage += `⚠️ MULTIPLE MATCHES FOUND:\n`;
      matchingTasks.forEach((task, index) => {
        updateMessage += `${index + 1}. "${task.content}"`;
        if (task.due) updateMessage += ` (Current due: ${task.due.string || task.due.date})`;
        updateMessage += ` [ID: ${task.id}]\n`;
      });
      updateMessage += `\n❓ Please specify which task to update by saying "update task [number]"`;
      
      const multipleMatchMessage: Message = {
        id: Math.random().toString(36).substring(2, 11),
        content: updateMessage,
        role: "assistant",
        timestamp: new Date(),
      };
      
      addMessageToChat(multipleMatchMessage);
      return;
    }
    
    // Single match found - proceed with update
    const taskToUpdate = matchingTasks[0];
    console.log(`Found task to update: ${taskToUpdate.id} - ${taskToUpdate.content}`);
    
    updateMessage += `✅ Found task: "${taskToUpdate.content}" (ID: ${taskToUpdate.id})\n`;
    updateMessage += `📅 Current due date: ${taskToUpdate.due ? taskToUpdate.due.string || taskToUpdate.due.date : 'None'}\n`;
    updateMessage += `📅 New due date string: "${newDueDate}"\n\n`;
    
    // Validate due date is not empty
    if (!newDueDate || newDueDate.trim() === '') {
      updateMessage += `⚠️ WARNING: No due date specified in update request\n`;
      updateMessage += `❌ UPDATE CANCELLED: Cannot update to empty due date`;
      
      const warningMessage: Message = {
        id: Math.random().toString(36).substring(2, 11),
        content: updateMessage,
        role: "assistant",
        timestamp: new Date(),
      };
      
      addMessageToChat(warningMessage);
      return;
    }
    
    // Update the task with new due date
    console.log(`🚀 Updating task ${taskToUpdate.id} with due_string: "${newDueDate}"`);
    const updateResponse = await todoistApi.updateTask(taskToUpdate.id, {
      due_string: newDueDate
    });
    
    if (updateResponse.success) {
      updateMessage += `✅ UPDATE SUCCESS: Task due date updated to "${newDueDate}"\n`;
      updateMessage += `📝 NOTE: Check Todoist to verify the new due date was parsed correctly by Todoist's natural language processor.`;
      
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
      
      const errorMessage: Message = {
        id: Math.random().toString(36).substring(2, 11),
        content: updateMessage,
        role: "assistant",
        timestamp: new Date(),
      };
      
      addMessageToChat(errorMessage);
    }
  } catch (error) {
    console.error("Error updating task:", error);
    
    updateMessage += `💥 UPDATE ERROR: ${error instanceof Error ? error.message : 'Unknown error'}\n`;
    updateMessage += `🔍 TROUBLESHOOTING: Check your internet connection and try again.`;
    
    const errorMessage: Message = {
      id: Math.random().toString(36).substring(2, 11),
      content: updateMessage,
      role: "assistant",
      timestamp: new Date(),
    };
    
    addMessageToChat(errorMessage);
  }
}

// Function to execute task creation with detailed feedback
async function executeTaskCreation(
  cleanContent: string,
  dueDate: string | undefined,
  priority: number,
  labels: string[],
  createTask: (content: string, due?: string, priority?: number, labels?: string[]) => Promise<boolean>,
  addMessageToChat: (message: Message) => void
): Promise<void> {
  let detailMessage = `🎯 CREATING TASK:\n\n`;
  detailMessage += `📋 Task content: "${cleanContent}"\n`;
  detailMessage += `📅 Due string sent to Todoist: ${dueDate ? `"${dueDate}"` : 'None'}\n`;
  
  if (!dueDate) {
    detailMessage += `⚠️ WARNING: No due date detected or extracted from your request\n`;
  }
  
  detailMessage += `⚡ Priority: ${priority} (${getPriorityLabel(priority)})\n`;
  detailMessage += `🏷️ Labels: ${labels.length > 0 ? labels.join(', ') : 'None'}\n\n`;
  
  try {
    console.log(`🚀 Calling createTask API with:`, { cleanContent, dueDate, priority, labels });
    const success = await createTask(cleanContent, dueDate || undefined, priority, labels);
    
    if (success) {
      detailMessage += `✅ RESULT: SUCCESS - Task created successfully in Todoist\n`;
      detailMessage += `📝 NOTE: Check Todoist to verify all details were parsed correctly.`;
    } else {
      detailMessage += `❌ RESULT: FAILED - Task creation failed\n`;
      detailMessage += `🔍 TROUBLESHOOTING: Check your Todoist connection and try again.`;
    }
    
    const resultMessage: Message = {
      id: Math.random().toString(36).substring(2, 11),
      content: detailMessage,
      role: "assistant",
      timestamp: new Date(),
    };
    
    addMessageToChat(resultMessage);
  } catch (error) {
    console.error("💥 Error creating task:", error);
    
    detailMessage += `💥 RESULT: ERROR - ${error instanceof Error ? error.message : 'Unknown error'}\n`;
    detailMessage += `🔍 TROUBLESHOOTING: Check your internet connection and Todoist API access.`;
    
    const errorMessage: Message = {
      id: Math.random().toString(36).substring(2, 11),
      content: detailMessage,
      role: "assistant",
      timestamp: new Date(),
    };
    
    addMessageToChat(errorMessage);
  }
}

// Function to check for ambiguous priority terms
function hasAmbiguousPriority(content: string): boolean {
  const ambiguousTerms = /\b(important|urgent|critical|high|asap)\b/i;
  return ambiguousTerms.test(content);
}

// Function to get priority label
function getPriorityLabel(priority: number): string {
  switch (priority) {
    case 4: return 'P1-Highest (Urgent & Important)';
    case 3: return 'P2-High (Important, Not Urgent)';
    case 2: return 'P3-Medium (Urgent, Not Important)';
    case 1: return 'P4-Low (Neither Urgent nor Important)';
    default: return 'P4-Low';
  }
}

// Enhanced function to parse task details with better due date extraction
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

  // Enhanced due date extraction patterns
  const dueDatePatterns = [
    // Pattern for "task content due date" format
    /^(.+?)\s+due\s+(.+?)(?:\s+with|\s+label|$)/i,
    // Pattern for just "due date" at the end
    /^(.+?)\s+due\s+(.+)$/i,
    // Pattern for "due date" anywhere in the content
    /due\s+([^,]+?)(?:\s+with|\s+label|,|$)/i
  ];

  // Check task content first
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

  // Priority mapping - using conservative approach for ambiguous terms
  const priorityPatterns = [
    { pattern: /\b(critical|emergency|asap|immediately)\b/i, priority: 4 }, // Highest priority - only very clear terms
    { pattern: /\b(high.priority|p1)\b/i, priority: 4 },
    { pattern: /\b(p2)\b/i, priority: 3 },
    { pattern: /\b(medium|normal|p3)\b/i, priority: 2 },
    { pattern: /\b(low|minor|p4)\b/i, priority: 1 } // Lowest priority
    // Note: "important" and "urgent" are intentionally excluded as they're ambiguous
  ];

  // Check both task content and user message for priority keywords
  const fullText = `${taskContent} ${userMessage}`.toLowerCase();
  for (const { pattern, priority: priorityValue } of priorityPatterns) {
    if (pattern.test(fullText)) {
      priority = priorityValue;
      console.log(`⚡ PRIORITY detected: ${priorityValue} (${getPriorityLabel(priorityValue)}) from pattern: ${pattern}`);
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
      
      // Split by comma and clean up
      labels = labelText
        .split(/[,\s]+/)
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
  console.log(`   Due date: ${dueDate ? `"${dueDate}" (will be passed to Todoist)` : 'None'}`);
  console.log(`   Priority: ${priority} (${getPriorityLabel(priority)})`);
  console.log(`   Labels: [${labels.join(', ')}]`);

  return {
    cleanContent,
    dueDate,
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
