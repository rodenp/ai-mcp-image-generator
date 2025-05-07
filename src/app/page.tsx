import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { ImageGeneratorForm } from '@/components/image-generator/image-generator-form';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8 sm:py-12 md:py-16 flex flex-col items-center justify-center">
        <ImageGeneratorForm />
      </main>
      <Footer />
    </div>
  );
}
