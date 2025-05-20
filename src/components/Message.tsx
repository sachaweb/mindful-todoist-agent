
import React from "react";
import { Message as MessageType } from "../types";
import { cn } from "@/lib/utils";

interface MessageProps {
  message: MessageType;
}

const Message: React.FC<MessageProps> = ({ message }) => {
  const isUser = message.role === "user";
  
  return (
    <div
      className={cn(
        "p-4 max-w-[85%] mb-4",
        isUser ? "message-user self-end" : "message-ai self-start"
      )}
    >
      <div className="flex items-start">
        {!isUser && (
          <div className="mr-2 flex-shrink-0 w-8 h-8 rounded-full bg-todoist-red text-white flex items-center justify-center">
            <span className="text-sm font-bold">AI</span>
          </div>
        )}
        <div>
          <p className="text-sm text-gray-700">{message.content}</p>
          <p className="text-xs text-gray-400 mt-1">
            {message.timestamp.toLocaleTimeString([], {
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
