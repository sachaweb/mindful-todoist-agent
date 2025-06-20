
import React from "react";
import { Message as MessageType } from "../types";
import { cn } from "@/lib/utils";

interface MessageProps {
  message: MessageType;
}

const Message: React.FC<MessageProps> = ({ message }) => {
  const isUser = message.role === "user";
  
  // Helper to format message content with line breaks
  const formatMessage = (content: string) => {
    return content.split('\n').map((line, i) => (
      <React.Fragment key={i}>
        {line}
        {i < content.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  };
  
  console.log("Rendering message:", message.id, message.content, message.role);
  
  return (
    <div
      className={cn(
        "p-4 rounded-lg mb-4 max-w-[85%]",
        isUser 
          ? "bg-gray-100 self-end text-gray-900" 
          : "bg-todoist-red/10 self-start"
      )}
      data-testid={`message-${message.id}`}
    >
      <div className="flex items-start">
        {!isUser && (
          <div className="mr-2 flex-shrink-0 w-8 h-8 rounded-full bg-todoist-red text-white flex items-center justify-center">
            <span className="text-sm font-bold">AI</span>
          </div>
        )}
        <div>
          <p className="text-sm text-gray-700">{formatMessage(message.content)}</p>
          <p className="text-xs text-gray-400 mt-1">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Message;
