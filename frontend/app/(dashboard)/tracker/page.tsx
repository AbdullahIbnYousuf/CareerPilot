export default function TrackerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Productivity Tracker</h1>
        <p className="text-muted-foreground mt-2">
          Manage your job applications, goals, and track your daily progress.
        </p>
      </div>
      
      <div className="flex h-[400px] shrink-0 items-center justify-center rounded-md border border-dashed">
        <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
          <h3 className="mt-4 text-lg font-semibold">Tracker coming soon</h3>
          <p className="mb-4 mt-2 text-sm text-muted-foreground">
            The Kanban board and calendar are being built. Check back later!
          </p>
        </div>
      </div>
    </div>
  );
}
