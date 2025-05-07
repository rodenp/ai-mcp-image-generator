
"use client";

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ImageIcon, AlertCircle, Wand2 } from 'lucide-react';
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
    // Cleanup object URL on component unmount or when a new image is generated
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
      // 1. Modify prompt if inappropriate
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

      // 2. Generate image
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

  return (
    <Card className="w-full max-w-4xl shadow-xl"> {/* Increased max-w for wider layout */}
      <CardHeader>
        <CardTitle className="flex items-center text-3xl font-semibold">
          <Wand2 className="mr-2 h-8 w-8 text-primary" />
          Create Your Vision
        </CardTitle>
        <CardDescription>
          Enter a prompt to generate a unique image with AI. Let your imagination run wild!
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row gap-6 lg:items-stretch">
          {/* Left Column: Prompt input and button */}
          <form onSubmit={handleSubmit} className="lg:w-1/2 flex flex-col space-y-4 h-full">
            <div className="flex-grow space-y-2">
              <Textarea
                id="prompt"
                placeholder="e.g., A futuristic cityscape at sunset, synthwave style"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[150px] lg:min-h-full h-full text-base focus:ring-primary focus:border-primary resize-none"
                disabled={isLoading}
                aria-label="Image prompt"
              />
            </div>
            <Button type="submit" className="w-full text-lg py-3" disabled={isLoading}>
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

          {/* Right Column: Image display */}
          <div className="lg:w-1/2 flex flex-col items-center justify-center bg-muted/30 rounded-md p-4 min-h-[300px] lg:min-h-0">
            {isLoading && (
              <div className="flex flex-col items-center text-muted-foreground">
                <Loader2 className="h-16 w-16 animate-spin text-primary mb-3" />
                <p className="text-lg">Your vision is materializing...</p>
              </div>
            )}
            {!isLoading && generatedImageUrl && (
              <div className="w-full max-w-md aspect-square rounded-md overflow-hidden border border-border bg-muted shadow-inner">
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
              <div className="w-full max-w-md aspect-square rounded-md border-2 border-dashed border-border bg-muted/50 flex flex-col items-center justify-center text-muted-foreground p-8">
                <ImageIcon className="h-20 w-20 mb-4" />
                <p className="text-center text-lg">Your generated image will appear here.</p>
              </div>
            )}
          </div>
        </div>

        {modifiedPromptMessage && (
          <Alert variant="default" className="mt-6 bg-blue-50 border-blue-200 text-blue-700">
             <AlertCircle className="h-4 w-4 !text-blue-700" />
            <AlertTitle>Prompt Moderated</AlertTitle>
            <AlertDescription>{modifiedPromptMessage}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="mt-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter>
        {/* Footer can be used for additional actions or information if needed */}
      </CardFooter>
    </Card>
  );
}

