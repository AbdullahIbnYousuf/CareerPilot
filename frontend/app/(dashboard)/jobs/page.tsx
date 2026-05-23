export default function JobsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Job Hunter</h1>
        <p className="text-muted-foreground mt-2">
          Search for jobs and get personalized fit scores based on your CV.
        </p>
      </div>
      
      <div className="flex h-[400px] shrink-0 items-center justify-center rounded-md border border-dashed">
        <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
          <h3 className="mt-4 text-lg font-semibold">Jobs coming soon</h3>
          <p className="mb-4 mt-2 text-sm text-muted-foreground">
            The job search interface is being built. Check back later!
          </p>
        </div>
      </div>
    </div>
  );
}
