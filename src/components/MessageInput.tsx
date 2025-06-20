
import React, { useState, FormEvent, KeyboardEvent, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUp } from "lucide-react";

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  placeholder?: string;
  shouldClearInput?: boolean;
  onInputCleared?: () => void;
}

const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  isLoading,
  placeholder = "Type a message...",
  shouldClearInput = false,
  onInputCleared,
}) => {
  const [message, setMessage] = useState("");

  // Clear input when shouldClearInput becomes true
  useEffect(() => {
    if (shouldClearInput && message.trim() !== "") {
      console.log("Clearing input after successful task creation");
      setMessage("");
      onInputCleared?.();
    }
  }, [shouldClearInput, message, onInputCleared]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      console.log("Submitting message:", message);
      onSendMessage(message.trim());
      // Do NOT clear the message here - it will be cleared by the parent component
      // when the task is successfully created
      console.log("Message sent, input NOT cleared (will clear on success)");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isLoading}
        className="flex-grow"
        data-testid="message-input"
      />
      <Button 
        type="submit" 
        disabled={!message.trim() || isLoading}
        size="icon"
        className="bg-todoist-red hover:bg-todoist-red/90"
        data-testid="send-button"
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
    </form>
  );
};

export default MessageInput;
