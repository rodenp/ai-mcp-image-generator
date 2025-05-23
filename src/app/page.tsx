
import { ImageGeneratorForm } from '@/components/image-generator/image-generator-form';

export default function HomePage() {
  return (
    <div className="flex flex-col items-center min-h-screen bg-background text-foreground">
      <header className="text-center py-8 sm:py-10 md:py-12 w-full bg-card shadow-sm border-b">
        <h1 className="text-4xl sm:text-5xl font-bold text-foreground">Visionary AI</h1>
        <p className="text-lg sm:text-xl text-muted-foreground mt-2">
          Transform your ideas into stunning visuals
        </p>
      </header>
      <main className="w-full max-w-7xl mx-auto flex-grow flex flex-col px-1 sm:px-2 lg:px-2"> {/* Reduced horizontal padding */}
        <ImageGeneratorForm />
      </main>
      <footer className="py-6 sm:py-8 text-center text-sm text-muted-foreground w-full border-t">
        <p>Powered by Next-Gen AI Image Technology</p>
      </footer>
    </div>
  );
}

