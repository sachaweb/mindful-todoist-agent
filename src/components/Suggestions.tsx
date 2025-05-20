
import React from "react";
import { Button } from "@/components/ui/button";
import { MessageCircleQuestion } from "lucide-react";

interface SuggestionsProps {
  suggestions: string[];
  onSelectSuggestion: (suggestion: string) => void;
}

const Suggestions: React.FC<SuggestionsProps> = ({
  suggestions,
  onSelectSuggestion,
}) => {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="w-full py-3">
      <div className="flex items-center gap-2 mb-2">
        <MessageCircleQuestion className="h-4 w-4 text-todoist-red" />
        <p className="text-sm text-gray-500">Suggestions:</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            className="text-xs border-todoist-red/30 text-todoist-red hover:bg-todoist-red/10 hover:text-todoist-red/90 transition-all"
            onClick={() => onSelectSuggestion(suggestion)}
          >
            {suggestion}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default Suggestions;
