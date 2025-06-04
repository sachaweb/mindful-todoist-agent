
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TODOIST_API_URL = "https://api.todoist.com/rest/v2";
const TODOIST_API_KEY = Deno.env.get('TODOIST_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, data } = await req.json();
    console.log('🚀 TODOIST PROXY - REQUEST RECEIVED:', {
      action,
      data,
      timestamp: new Date().toISOString()
    });

    let response;
    
    switch (action) {
      case 'getTasks':
        let url = `${TODOIST_API_URL}/tasks`;
        
        console.log('📋 GET TASKS - Starting request to:', url);
        
        // For text searches, we'll get all tasks and filter on the server side
        // since Todoist's filter syntax is complex and doesn't support simple text search
        if (data?.filter) {
          console.log('🔍 GET TASKS - Filtering for:', data.filter);
          // Just get all tasks - we'll filter them after the API call
        }
        
        response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${TODOIST_API_KEY}`,
            'Content-Type': 'application/json',
          },
        });
        
        console.log('📋 GET TASKS - Todoist API response status:', response.status);
        
        if (response.ok) {
          const tasks = await response.json();
          console.log('📋 GET TASKS - Success! Retrieved', tasks.length, 'tasks');
          
          // If we have a filter, search through tasks by content
          if (data?.filter && Array.isArray(tasks)) {
            const searchTerm = data.filter.toLowerCase();
            const filteredTasks = tasks.filter(task => 
              task.content && task.content.toLowerCase().includes(searchTerm)
            );
            console.log(`🔍 GET TASKS - Found ${filteredTasks.length} tasks matching "${data.filter}"`);
            
            return new Response(JSON.stringify({ success: true, data: filteredTasks }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          // Return all tasks if no filter
          return new Response(JSON.stringify({ success: true, data: tasks }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          const errorText = await response.text();
          console.error('❌ GET TASKS - Todoist API error:', response.status, errorText);
        }
        break;
        
      case 'createTask':
        const { content, due_string, priority, labels } = data;
        const taskBody: any = { content };
        
        // CRITICAL FIX: Always add priority if it's a valid number, including 1
        if (due_string) taskBody.due_string = due_string;
        if (typeof priority === 'number' && priority >= 1 && priority <= 4) {
          taskBody.priority = priority;
        }
        if (labels && Array.isArray(labels) && labels.length > 0) taskBody.labels = labels;
        
        console.log('✨ CREATE TASK - FULL REQUEST PAYLOAD TO TODOIST:', {
          url: `${TODOIST_API_URL}/tasks`,
          method: 'POST',
          headers: {
            'Authorization': 'Bearer [REDACTED]',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(taskBody, null, 2),
          bodyObject: taskBody,
          fieldsPresent: {
            content: !!taskBody.content,
            due_string: !!taskBody.due_string,
            priority: taskBody.priority !== undefined,
            labels: !!taskBody.labels
          },
          priorityValue: taskBody.priority,
          priorityType: typeof taskBody.priority,
          priorityValidation: {
            isNumber: typeof priority === 'number',
            inRange: typeof priority === 'number' && priority >= 1 && priority <= 4,
            originalPriority: priority,
            finalPriority: taskBody.priority
          }
        });
        
        response = await fetch(`${TODOIST_API_URL}/tasks`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${TODOIST_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(taskBody),
        });
        
        console.log('✨ CREATE TASK - Todoist API response status:', response.status);
        
        if (response.ok) {
          const createdTask = await response.json();
          console.log('✅ CREATE TASK - SUCCESS! Task created:', {
            id: createdTask.id,
            content: createdTask.content,
            priority: createdTask.priority,
            priorityDisplay: createdTask.priority === 1 ? 'P1 (urgent/red)' :
                           createdTask.priority === 2 ? 'P2 (high/orange)' :
                           createdTask.priority === 3 ? 'P3 (medium/blue)' :
                           createdTask.priority === 4 ? 'P4 (low/default)' : 'unknown',
            due: createdTask.due,
            labels: createdTask.labels,
            fullTask: createdTask
          });
          
          return new Response(JSON.stringify({ success: true, data: createdTask }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          const errorText = await response.text();
          console.error('❌ CREATE TASK - TODOIST API ERROR:', {
            status: response.status,
            statusText: response.statusText,
            errorText,
            requestPayload: taskBody
          });
        }
        break;
        
      case 'completeTask':
        const { taskId } = data;
        console.log('✅ COMPLETE TASK - Request for task ID:', taskId);
        
        response = await fetch(`${TODOIST_API_URL}/tasks/${taskId}/close`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${TODOIST_API_KEY}`,
            'Content-Type': 'application/json',
          },
        });
        
        console.log('✅ COMPLETE TASK - Todoist API response status:', response.status);
        break;
        
      case 'updateTask':
        const { taskId: updateTaskId, updates } = data;
        console.log('🔄 UPDATE TASK - Request for task ID:', updateTaskId, 'with updates:', updates);
        
        response = await fetch(`${TODOIST_API_URL}/tasks/${updateTaskId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${TODOIST_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        });
        
        console.log('🔄 UPDATE TASK - Todoist API response status:', response.status);
        break;
        
      default:
        console.error('❌ UNKNOWN ACTION:', action);
        return new Response(JSON.stringify({ success: false, error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ TODOIST API ERROR DETAILS:', {
        action,
        status: response.status,
        statusText: response.statusText,
        errorText,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Todoist API error: ${response.status} - ${errorText}` 
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle different response types
    let responseData;
    if (action === 'completeTask' || action === 'updateTask') {
      // These endpoints return 204 No Content on success
      responseData = null;
      console.log(`✅ ${action.toUpperCase()} - Success (204 No Content)`);
    } else {
      responseData = await response.json();
      console.log(`✅ ${action.toUpperCase()} - Success with data:`, responseData);
    }
    
    return new Response(JSON.stringify({ success: true, data: responseData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 TODOIST PROXY - EXCEPTION:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
