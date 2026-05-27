"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="w-full bg-[#0E0E12] border border-white/[0.06] rounded-2xl shadow-xl shadow-black/30">
      <CardHeader>
        <CardTitle className="text-xl font-bold flex items-center gap-2 text-white">
          <ListTodo className="h-5 w-5 text-[#7C74DB]" />
          Task List
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={addTodo} className="flex gap-2">
          <input
            type="text"
            placeholder="Add a new task..."
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            className="flex-1 h-9 px-3.5 bg-white/[0.04] border border-white/[0.06] text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 rounded-xl text-sm transition-all"
          />
          <button
            type="submit"
            className="h-9 w-9 flex items-center justify-center rounded-xl bg-[#534AB7] hover:bg-[#6B63CC] text-white transition-all duration-200 shadow-md shadow-[#534AB7]/20 shrink-0"
          >
            <Plus className="h-4 w-4" />
          </button>
        </form>

        <div className="space-y-2 mt-4">
          {todos.length === 0 ? (
            <div className="text-center text-white/30 text-sm py-6">
              All caught up! No pending tasks.
            </div>
          ) : (
            todos.map((todo) => (
              <div
                key={todo.id}
                className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-200 ${
                  todo.completed
                    ? "bg-white/[0.01] border-white/[0.04] opacity-50"
                    : "bg-[#0E0E12] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.01]"
                }`}
              >
                <Checkbox
                  checked={todo.completed}
                  onCheckedChange={() => toggleTodo(todo.id)}
                  id={`todo-${todo.id}`}
                  className="border-white/[0.2] data-[state=checked]:bg-[#7C74DB] data-[state=checked]:border-[#7C74DB]"
                />
                <label
                  htmlFor={`todo-${todo.id}`}
                  className={`flex-1 text-sm cursor-pointer transition-all ${
                    todo.completed ? "line-through text-white/40" : "text-white/90 font-medium"
                  }`}
                >
                  {todo.text}
                </label>
                <button
                  type="button"
                  onClick={() => deleteTodo(todo.id)}
                  className="h-8 w-8 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg flex items-center justify-center shrink-0 transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
