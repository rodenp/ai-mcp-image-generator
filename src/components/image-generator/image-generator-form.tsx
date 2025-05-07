
"use client";

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ImageIcon, AlertCircle } from 'lucide-react';
import { generateImage, type GeneratedImage } from '@/services/image-generation';
import { modifyPromptIfInappropriate, type ModifyPromptIfInappropriateOutput } from '@/ai/flows/modify-prompt-if-inappropriate';
import { useToast } from '@/hooks/use-toast';

export function ImageGeneratorForm() {
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [modifiedPromptMessage, setModifiedPromptMessage] = useState<string | null>(null);
  
  const objectUrlRef = useRef<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!prompt.trim()) {
      setError('Prompt cannot be empty.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setModifiedPromptMessage(null);
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setGeneratedImageUrl(null);

    try {
      const moderationResult: ModifyPromptIfInappropriateOutput = await modifyPromptIfInappropriate({ prompt });
      let finalPrompt = prompt;

      if (moderationResult.isModified) {
        finalPrompt = moderationResult.modifiedPrompt;
        const modificationMessage = `Your prompt was modified for safety. New prompt: "${finalPrompt}"`;
        setModifiedPromptMessage(modificationMessage);
        toast({
          title: "Prompt Modified",
          description: modificationMessage,
          variant: "default",
        });
      }

      const imageBlob: GeneratedImage = await generateImage(finalPrompt);
      const objectUrl = URL.createObjectURL(imageBlob);
      objectUrlRef.current = objectUrl;
      setGeneratedImageUrl(objectUrl);

    } catch (err: any) {
      console.error('Image generation process failed:', err);
      setError(err.message || 'An unexpected error occurred.');
      toast({
        title: "Error",
        description: err.message || 'Failed to generate image.',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const tips = [
    "Be specific about the subject, style, and setting",
    "Include details like \"high resolution\" or \"photorealistic\"",
    "Try artistic styles like \"oil painting\" or \"digital art\"",
    "Specify lighting conditions like \"golden hour\" or \"studio lighting\"",
  ];

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Prompt Section */}
          <div className="bg-card p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-card-foreground">Enter your prompt</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Textarea
                id="prompt"
                placeholder="A woman running on the beach"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[100px] text-base focus:ring-primary focus:border-primary resize-none"
                disabled={isLoading}
                aria-label="Image prompt"
              />
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 text-lg" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Image'
                )}
              </Button>
            </form>
          </div>

          {/* Tips Section */}
          <div className="bg-[hsl(255,70%,96%)] p-6 rounded-lg shadow-lg">
            <h3 className="text-md font-semibold mb-3 text-primary">Tips for great prompts:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-foreground/90">
              {tips.map((tip, index) => (
                <li key={index}>{tip}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right Column */}
        <div className="bg-card p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-card-foreground">Generated Image</h2>
          <div className="aspect-square w-full bg-muted/10 rounded-md border border-border flex items-center justify-center p-2">
            {isLoading && (
              <div className="flex flex-col items-center text-muted-foreground">
                <Loader2 className="h-16 w-16 animate-spin text-primary mb-3" />
                <p className="text-lg">Your vision is materializing...</p>
              </div>
            )}
            {!isLoading && generatedImageUrl && (
              <div className="w-full h-full rounded-md overflow-hidden bg-muted">
                <Image
                  src={generatedImageUrl}
                  alt={prompt || 'Generated AI image'}
                  width={512}
                  height={512}
                  className="object-contain w-full h-full"
                  data-ai-hint="generated image"
                />
              </div>
            )}
            {!isLoading && !generatedImageUrl && (
              <div className="w-full h-full rounded-md border border-border bg-muted/50 flex flex-col items-center justify-center text-muted-foreground p-8">
                <ImageIcon className="h-24 w-24 mb-4" />
                <p className="text-center text-lg">Your generated image will appear here.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {modifiedPromptMessage && (
        <Alert variant="default" className="mt-8 bg-blue-50 border-blue-200 text-blue-700">
           <AlertCircle className="h-4 w-4 !text-blue-700" />
          <AlertTitle>Prompt Moderated</AlertTitle>
          <AlertDescription>{modifiedPromptMessage}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="mt-8">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
