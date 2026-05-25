"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ListTodo, Plus, Trash2 } from "lucide-react";

interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

export function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([
    { id: "1", text: "Update resume with new skills", completed: true },
    { id: "2", text: "Apply to 5 remote software engineering roles", completed: false },
    { id: "3", text: "Prepare for technical interview", completed: false },
  ]);
  const [newTodo, setNewTodo] = useState("");

  const addTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodo.trim()) return;
    setTodos([{ id: Date.now().toString(), text: newTodo.trim(), completed: false }, ...todos]);
    setNewTodo("");
  };

  const toggleTodo = (id: string) => {
    setTodos(todos.map(todo => todo.id === id ? { ...todo, completed: !todo.completed } : todo));
  };

  const deleteTodo = (id: string) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <ListTodo className="h-5 w-5 text-primary" />
          Task List
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={addTodo} className="flex gap-2">
          <Input 
            placeholder="Add a new task..." 
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="icon">
            <Plus className="h-4 w-4" />
          </Button>
        </form>

        <div className="space-y-2 mt-4">
          {todos.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-4">
              All caught up! No pending tasks.
            </div>
          ) : (
            todos.map((todo) => (
              <div 
                key={todo.id} 
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                  todo.completed ? "bg-muted/30 border-muted opacity-60" : "bg-card border-border hover:border-primary/40"
                }`}
              >
                <Checkbox 
                  checked={todo.completed} 
                  onCheckedChange={() => toggleTodo(todo.id)}
                  id={`todo-${todo.id}`}
                />
                <label 
                  htmlFor={`todo-${todo.id}`}
                  className={`flex-1 text-sm cursor-pointer transition-all ${todo.completed ? "line-through text-muted-foreground" : "text-foreground font-medium"}`}
                >
                  {todo.text}
                </label>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={() => deleteTodo(todo.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
