export default function CVPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">CV Intelligence</h1>
        <p className="text-muted-foreground mt-2">
          Upload your CV to enable AI-powered job matching and chat features.
        </p>
      </div>
      
      <div className="flex h-[400px] shrink-0 items-center justify-center rounded-md border border-dashed">
        <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
          <h3 className="mt-4 text-lg font-semibold">CV upload coming soon</h3>
          <p className="mb-4 mt-2 text-sm text-muted-foreground">
            The CV upload and parsing interface is being built. Check back later!
          </p>
        </div>
      </div>
    </div>
  );
}
