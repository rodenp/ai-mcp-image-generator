
import { ImageGeneratorForm } from '@/components/image-generator/image-generator-form';

export default function HomePage() {
  return (
    <div className="flex flex-col items-center min-h-screen py-10 sm:py-12 md:py-16 bg-background text-foreground">
      <header className="text-center mb-10 sm:mb-12">
        <h1 className="text-4xl sm:text-5xl font-bold text-foreground">AI Image Generator</h1>
        <p className="text-lg sm:text-xl text-muted-foreground mt-2">
          Transform your ideas into stunning visuals with AI
        </p>
      </header>
      <main className="w-full max-w-5xl px-4">
        <ImageGeneratorForm />
      </main>
      <footer className="mt-10 sm:mt-12 text-center text-sm text-muted-foreground">
        <p>Powered by AI Image Generation Technology</p>
      </footer>
    </div>
  );
}
