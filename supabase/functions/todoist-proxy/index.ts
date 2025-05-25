
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
    console.log('Todoist proxy received action:', action, 'with data:', data);

    let response;
    
    switch (action) {
      case 'getTasks':
        response = await fetch(`${TODOIST_API_URL}/tasks`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${TODOIST_API_KEY}`,
            'Content-Type': 'application/json',
          },
        });
        break;
        
      case 'createTask':
        const { content, due_string, priority, labels } = data;
        const taskBody: any = { content };
        
        if (due_string) taskBody.due_string = due_string;
        if (priority) taskBody.priority = priority;
        if (labels && labels.length > 0) taskBody.labels = labels;
        
        response = await fetch(`${TODOIST_API_URL}/tasks`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${TODOIST_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(taskBody),
        });
        break;
        
      case 'completeTask':
        const { taskId } = data;
        response = await fetch(`${TODOIST_API_URL}/tasks/${taskId}/close`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${TODOIST_API_KEY}`,
            'Content-Type': 'application/json',
          },
        });
        break;
        
      case 'updateTask':
        const { taskId: updateTaskId, updates } = data;
        response = await fetch(`${TODOIST_API_URL}/tasks/${updateTaskId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${TODOIST_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        });
        break;
        
      default:
        return new Response(JSON.stringify({ success: false, error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Todoist API error:', response.status, errorText);
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
    } else {
      responseData = await response.json();
    }

    console.log('Todoist API success:', responseData);
    
    return new Response(JSON.stringify({ success: true, data: responseData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in todoist-proxy function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
