export function Footer() {
  return (
    <footer className="mt-auto border-t border-border py-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 text-xs text-muted">
        <p>&copy; 2026 ClawNetwork. All rights reserved.</p>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
          </span>
          Network Healthy
        </div>
      </div>
    </footer>
  );
}
