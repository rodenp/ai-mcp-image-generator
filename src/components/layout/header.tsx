import { Sparkles } from 'lucide-react';
import Link from 'next/link';

export function Header() {
  return (
    <header className="bg-card border-b border-border shadow-sm">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-2xl font-bold text-foreground hover:text-primary transition-colors">
          <Sparkles className="h-7 w-7 text-primary" />
          Visionary AI
        </Link>
        {/* Navigation items can be added here if needed */}
      </div>
    </header>
  );
}
