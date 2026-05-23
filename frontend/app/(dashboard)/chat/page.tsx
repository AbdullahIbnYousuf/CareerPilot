export default function ChatPage() {
  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-100px)]">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Assistant</h1>
        <p className="text-muted-foreground mt-2">
          Chat with an AI that knows your CV inside out.
        </p>
      </div>
      
      <div className="flex flex-1 items-center justify-center rounded-md border border-dashed">
        <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
          <h3 className="mt-4 text-lg font-semibold">Chat coming soon</h3>
          <p className="mb-4 mt-2 text-sm text-muted-foreground">
            The streaming chat interface is being built. Check back later!
          </p>
        </div>
      </div>
    </div>
  );
}
