
import React from "react";
import { TodoistTask } from "../types";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskListProps {
  tasks: TodoistTask[];
  onCompleteTask: (taskId: string) => Promise<boolean>;
  isLoading: boolean;
}

const getPriorityClass = (priority: number): string => {
  switch (priority) {
    case 4:
      return "border-l-4 border-todoist-red bg-todoist-red/5";
    case 3:
      return "border-l-4 border-orange-500 bg-orange-500/5";
    case 2:
      return "border-l-4 border-blue-500 bg-blue-500/5";
    default:
      return "border-l-4 border-gray-300";
  }
};

const TaskList: React.FC<TaskListProps> = ({ tasks, onCompleteTask, isLoading }) => {
  if (!tasks || tasks.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No tasks available. Create your first task!
      </div>
    );
  }

  // Sort tasks by priority (highest first)
  const sortedTasks = [...tasks].sort((a, b) => b.priority - a.priority);

  return (
    <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin pr-2">
      {sortedTasks.map((task) => (
        <div
          key={task.id}
          className={cn(
            "p-3 rounded-md flex items-center justify-between",
            getPriorityClass(task.priority)
          )}
        >
          <div className="flex-1 mr-2">
            <p className="text-sm font-medium">{task.content}</p>
            {task.due && (
              <p className="text-xs text-gray-500">
                {task.due.string || task.due.date}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full hover:bg-todoist-red hover:text-white"
            onClick={() => onCompleteTask(task.id)}
            disabled={isLoading}
          >
            <Check className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
};

export default TaskList;
