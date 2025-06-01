
import { conversationState } from '../stateMachine';

describe('ConversationStateMachine', () => {
  beforeEach(() => {
    conversationState.reset();
  });

  describe('state transitions', () => {
    it('should start in idle state', () => {
      expect(conversationState.getCurrentState()).toBe('idle');
    });

    it('should transition between states correctly', () => {
      conversationState.transition('awaiting_confirmation');
      expect(conversationState.getCurrentState()).toBe('awaiting_confirmation');

      conversationState.transition('processing_task');
      expect(conversationState.getCurrentState()).toBe('processing_task');
    });

    it('should maintain context during transitions', () => {
      const metadata = { pendingAction: 'create', intent: { action: 'create' } };
      
      conversationState.transition('awaiting_confirmation', { metadata });
      
      const context = conversationState.getContext();
      expect(context.metadata).toEqual(metadata);
      expect(context.previousState).toBe('idle');
    });

    it('should reset to idle state', () => {
      conversationState.transition('processing_task', { 
        pendingAction: 'create',
        metadata: { test: 'data' }
      });

      conversationState.reset();

      expect(conversationState.getCurrentState()).toBe('idle');
      const context = conversationState.getContext();
      expect(context.pendingAction).toBeUndefined();
      expect(context.metadata).toBeUndefined();
    });
  });

  describe('user response detection', () => {
    it('should detect user responses correctly', () => {
      conversationState.transition('awaiting_confirmation');
      expect(conversationState.isAwaitingUserResponse()).toBe(true);

      conversationState.transition('awaiting_clarification');
      expect(conversationState.isAwaitingUserResponse()).toBe(true);

      conversationState.transition('processing_task');
      expect(conversationState.isAwaitingUserResponse()).toBe(false);
    });
  });

  describe('handleUserInput', () => {
    describe('confirmation handling', () => {
      beforeEach(() => {
        conversationState.transition('awaiting_confirmation');
      });

      it('should detect confirmation patterns', () => {
        const confirmationInputs = [
          'yes',
          'y',
          'ok',
          'okay',
          'sure',
          'proceed',
          'create anyway',
          'do it'
        ];

        confirmationInputs.forEach(input => {
          const result = conversationState.handleUserInput(input);
          expect(result.isConfirmation).toBe(true);
          expect(result.isCancel).toBe(false);
          expect(result.filteredInput).toBe(input);
        });
      });

      it('should detect cancel patterns', () => {
        const cancelInputs = [
          'no',
          'n',
          'cancel',
          'stop',
          'abort',
          'nevermind',
          'never mind'
        ];

        cancelInputs.forEach(input => {
          const result = conversationState.handleUserInput(input);
          expect(result.isConfirmation).toBe(false);
          expect(result.isCancel).toBe(true);
          expect(result.filteredInput).toBe(input);
        });
      });

      it('should handle ambiguous input as regular input', () => {
        const ambiguousInputs = [
          'maybe',
          'I think so',
          'create a different task',
          'what about tomorrow?'
        ];

        ambiguousInputs.forEach(input => {
          const result = conversationState.handleUserInput(input);
          expect(result.isConfirmation).toBe(false);
          expect(result.isCancel).toBe(false);
          expect(result.filteredInput).toBe(input);
        });
      });
    });

    describe('artifact filtering', () => {
      it('should filter confirmation artifacts from previous confirmation state', () => {
        // Set up previous confirmation state
        conversationState.transition('awaiting_confirmation');
        conversationState.transition('processing_task');

        const testCases = [
          {
            input: 'create anyway Buy groceries',
            expected: 'Buy groceries'
          },
          {
            input: 'proceed Schedule meeting',
            expected: 'Schedule meeting'
          },
          {
            input: 'yes, call mom',
            expected: 'call mom'
          }
        ];

        testCases.forEach(({ input, expected }) => {
          const result = conversationState.handleUserInput(input);
          expect(result.filteredInput).toBe(expected);
        });
      });

      it('should not filter artifacts when not in appropriate state', () => {
        conversationState.transition('idle');

        const input = 'create anyway Buy groceries';
        const result = conversationState.handleUserInput(input);
        
        expect(result.filteredInput).toBe(input);
      });
    });

    describe('clarification handling', () => {
      it('should handle clarification input as regular input', () => {
        conversationState.transition('awaiting_clarification');

        const input = 'I meant buy milk instead';
        const result = conversationState.handleUserInput(input);

        expect(result.isConfirmation).toBe(false);
        expect(result.isCancel).toBe(false);
        expect(result.filteredInput).toBe(input);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle rapid state transitions', () => {
      const states = ['awaiting_confirmation', 'processing_task', 'idle', 'awaiting_clarification'];
      
      states.forEach(state => {
        conversationState.transition(state as any);
        expect(conversationState.getCurrentState()).toBe(state);
      });
    });

    it('should handle empty or whitespace input', () => {
      const inputs = ['', '   ', '\n', '\t'];
      
      inputs.forEach(input => {
        const result = conversationState.handleUserInput(input);
        expect(result.isConfirmation).toBe(false);
        expect(result.isCancel).toBe(false);
        expect(result.filteredInput).toBe(input);
      });
    });
  });
});
