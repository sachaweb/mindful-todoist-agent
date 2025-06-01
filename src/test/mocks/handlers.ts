
import { rest } from 'msw';
import { mockClaudeResponses } from './mockResponses';

export const handlers = [
  // Mock Supabase Edge Function for Claude API
  rest.post('*/functions/v1/claude-proxy', (req, res, ctx) => {
    const body = req.body as any;
    const message = body.message;
    
    // Return appropriate mock response based on input
    const mockResponse = mockClaudeResponses.getResponseForInput(message);
    
    return res(
      ctx.json({
        success: true,
        response: mockResponse
      })
    );
  }),

  // Mock Supabase Edge Function for Todoist API
  rest.post('*/functions/v1/todoist-proxy', (req, res, ctx) => {
    const body = req.body as any;
    const { action, data } = body;
    
    switch (action) {
      case 'createTask':
        return res(
          ctx.json({
            success: true,
            data: {
              id: 'mock-task-id',
              content: data.content,
              priority: data.priority || 1,
              due: data.due_string ? { string: data.due_string } : null,
              labels: data.labels || []
            }
          })
        );
      
      case 'getTasks':
        return res(
          ctx.json({
            success: true,
            data: [
              {
                id: 'task-1',
                content: 'Existing task 1',
                priority: 2,
                due: null,
                labels: []
              }
            ]
          })
        );
      
      default:
        return res(
          ctx.json({
            success: false,
            error: 'Unknown action'
          })
        );
    }
  }),
];
