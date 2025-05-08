
"use client";

import type { ChangeEvent } from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ImageIcon, AlertCircle, Download, GalleryHorizontalEnd, Settings2, Crop, Maximize, RotateCcw } from 'lucide-react';
import { generateImage, type GeneratedImage } from '@/services/image-generation';
import { modifyPromptIfInappropriate, type ModifyPromptIfInappropriateOutput } from '@/ai/flows/modify-prompt-if-inappropriate';
import { useToast } from '@/hooks/use-toast';

const MAX_GALLERY_IMAGES = 20; // Optional: limit gallery size
const LOCAL_STORAGE_GALLERY_KEY = 'aiImageGallery';

export function ImageGeneratorForm() {
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // URLs and Image Data
  const [generatedImageBlobUrl, setGeneratedImageBlobUrl] = useState<string | null>(null); // Original blob URL from generation
  const [currentDisplayUrl, setCurrentDisplayUrl] = useState<string | null>(null); // Data URL for current display/editing

  const objectUrlRef = useRef<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalImageDimensionsRef = useRef<{ width: number; height: number } | null>(null);
  
  // Editing State
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editDimensions, setEditDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [cropArea, setCropArea] = useState<{ x: number; y: number; width: number; height: number }>({ x: 0, y: 0, width: 0, height: 0 });

  // Gallery State
  const [galleryImages, setGalleryImages] = useState<string[]>([]);

  const [modifiedPromptMessage, setModifiedPromptMessage] = useState<string | null>(null);
  const { toast } = useToast();

  // Load gallery from localStorage on mount
  useEffect(() => {
    try {
      const storedGallery = localStorage.getItem(LOCAL_STORAGE_GALLERY_KEY);
      if (storedGallery) {
        setGalleryImages(JSON.parse(storedGallery));
      }
    } catch (e) {
      console.error("Failed to load gallery from localStorage", e);
    }
  }, []);

  // Save gallery to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_GALLERY_KEY, JSON.stringify(galleryImages));
    } catch (e) {
      console.error("Failed to save gallery to localStorage", e);
      toast({
        title: "Storage Error",
        description: "Could not save all images to local gallery, storage might be full.",
        variant: "destructive",
      });
    }
  }, [galleryImages, toast]);
  

  useEffect(() => {
    // Cleanup blob URL on component unmount
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const resetImageStates = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setGeneratedImageBlobUrl(null);
    setCurrentDisplayUrl(null);
    setIsEditing(false);
    originalImageDimensionsRef.current = null;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!prompt.trim()) {
      setError('Prompt cannot be empty.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setModifiedPromptMessage(null);
    resetImageStates();

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
        });
      }

      const imageBlob: GeneratedImage = await generateImage(finalPrompt);
      const blobUrl = URL.createObjectURL(imageBlob);
      objectUrlRef.current = blobUrl;
      setGeneratedImageBlobUrl(blobUrl);

      // Convert blob to data URL for canvas operations and display
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setCurrentDisplayUrl(dataUrl);
        
        const img = new window.Image();
        img.onload = () => {
          originalImageDimensionsRef.current = { width: img.width, height: img.height };
          setEditDimensions({ width: img.width, height: img.height });
          setCropArea({ x: 0, y: 0, width: img.width, height: img.height });
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(imageBlob);

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

  const drawImageToCanvas = useCallback((sourceUrl: string, operation: (ctx: CanvasRenderingContext2D, img: HTMLImageElement) => void) => {
    return new Promise<string>((resolve, reject) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        reject(new Error("Canvas not available"));
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Canvas context not available"));
        return;
      }

      const img = new window.Image();
      img.onload = () => {
        operation(ctx, img);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error("Failed to load image for canvas operation"));
      img.src = sourceUrl;
    });
  }, []);

  const handleApplyResize = async () => {
    if (!currentDisplayUrl || !originalImageDimensionsRef.current) return;
    if (editDimensions.width <= 0 || editDimensions.height <= 0) {
        toast({ title: "Invalid Dimensions", description: "Width and height must be positive numbers.", variant: "destructive" });
        return;
    }

    try {
      const newImageUrl = await drawImageToCanvas(currentDisplayUrl, (ctx, img) => {
        canvasRef.current!.width = editDimensions.width;
        canvasRef.current!.height = editDimensions.height;
        ctx.drawImage(img, 0, 0, editDimensions.width, editDimensions.height);
      });
      setCurrentDisplayUrl(newImageUrl);
      originalImageDimensionsRef.current = { width: editDimensions.width, height: editDimensions.height }; // Update original dimensions to current
      setCropArea({ x: 0, y: 0, width: editDimensions.width, height: editDimensions.height }); // Reset crop area
      toast({ title: "Resize Applied", description: `Image resized to ${editDimensions.width}x${editDimensions.height}px.` });
    } catch (e: any) {
      toast({ title: "Resize Error", description: e.message, variant: "destructive" });
    }
  };

  const handleApplyCrop = async () => {
    if (!currentDisplayUrl || !originalImageDimensionsRef.current) return;
    const { x, y, width, height } = cropArea;
     if (width <= 0 || height <= 0) {
        toast({ title: "Invalid Crop Area", description: "Crop width and height must be positive.", variant: "destructive" });
        return;
    }

    try {
      const newImageUrl = await drawImageToCanvas(currentDisplayUrl, (ctx, img) => {
        canvasRef.current!.width = width;
        canvasRef.current!.height = height;
        ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
      });
      setCurrentDisplayUrl(newImageUrl);
      originalImageDimensionsRef.current = { width, height }; // Update original dimensions to current
      setEditDimensions({ width, height }); // Update resize inputs
      toast({ title: "Crop Applied" });
    } catch (e: any) {
      toast({ title: "Crop Error", description: e.message, variant: "destructive" });
    }
  };
  
  const handleResetEdits = () => {
    if (generatedImageBlobUrl) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = reader.result as string;
            setCurrentDisplayUrl(dataUrl);
            const img = new window.Image();
            img.onload = () => {
                originalImageDimensionsRef.current = { width: img.width, height: img.height };
                setEditDimensions({ width: img.width, height: img.height });
                setCropArea({ x: 0, y: 0, width: img.width, height: img.height });
            };
            img.src = dataUrl;
        };
        fetch(generatedImageBlobUrl)
            .then(res => res.blob())
            .then(blob => reader.readAsDataURL(blob))
            .catch(err => {
                toast({title: "Error Resetting", description: "Could not reload original image.", variant: "destructive"});
                console.error("Error fetching blob for reset:", err);
            });
         toast({ title: "Edits Reset", description: "Image restored to original generated version." });
    }
  };

  const handleSaveToDisk = () => {
    if (!currentDisplayUrl) return;
    const link = document.createElement('a');
    link.href = currentDisplayUrl;
    link.download = `${prompt.substring(0, 20).replace(/\s+/g, '_') || 'ai-image'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Image Saved", description: "Image downloaded successfully." });
  };

  const handleAddToGallery = () => {
    if (!currentDisplayUrl) return;
    if (galleryImages.length >= MAX_GALLERY_IMAGES && MAX_GALLERY_IMAGES > 0) {
        toast({ title: "Gallery Full", description: `Cannot add more than ${MAX_GALLERY_IMAGES} images.`, variant: "destructive"});
        return;
    }
    setGalleryImages(prev => [currentDisplayUrl!, ...prev].slice(0, MAX_GALLERY_IMAGES || undefined));
    toast({ title: "Added to Gallery", description: "Image saved to your local gallery." });
  };

  const handleDimensionChange = (e: ChangeEvent<HTMLInputElement>, type: 'width' | 'height') => {
    const value = parseInt(e.target.value);
    setEditDimensions(prev => ({ ...prev, [type]: isNaN(value) ? 0 : value }));
  };

  const handleCropChange = (e: ChangeEvent<HTMLInputElement>, type: 'x' | 'y' | 'width' | 'height') => {
    const value = parseInt(e.target.value);
    setCropArea(prev => ({ ...prev, [type]: isNaN(value) ? 0 : value }));
  };

  const tips = [
    "Be specific about subject, style, and setting",
    "Try artistic styles like \"oil painting\" or \"digital art\"",
    "Specify lighting: \"golden hour\", \"studio lighting\"",
  ];

  return (
    <div className="w-full mx-auto py-8 flex flex-col flex-grow"> {/* Added flex flex-col flex-grow */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-grow"> {/* Added flex-grow */}
        {/* Left Column: Prompt & Tips */}
        <div className="space-y-6 lg:col-span-1">
          <Card className="shadow-lg">
            <CardHeader><CardTitle>Enter your prompt</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Textarea
                  id="prompt"
                  placeholder="A serene landscape with cherry blossoms and a Fuji mountain backdrop, digital art"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[120px] text-base focus:ring-primary focus:border-primary resize-none"
                  disabled={isLoading}
                  aria-label="Image prompt"
                />
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 text-lg" disabled={isLoading}>
                  {isLoading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Generating...</> : 'Generate Image'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--primary)/0.05)] shadow-md">
             <CardHeader><CardTitle className="text-md text-primary">Tips for great prompts</CardTitle></CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1 text-sm text-foreground/90">
                {tips.map((tip, index) => <li key={index}>{tip}</li>)}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Middle Column: Generated Image Preview & Actions & Editing Tools */}
        <div className="space-y-6 lg:col-span-1">
          <Card className="shadow-lg">
            <CardHeader><CardTitle>Generated Image</CardTitle></CardHeader>
            <CardContent>
              <div className="aspect-square w-full bg-muted/10 rounded-md border border-border flex items-center justify-center p-2">
                {isLoading && (
                  <div className="flex flex-col items-center text-muted-foreground">
                    <Loader2 className="h-16 w-16 animate-spin text-primary mb-3" />
                    <p className="text-lg">Your vision is materializing...</p>
                  </div>
                )}
                {!isLoading && currentDisplayUrl && (
                  <Image
                    src={currentDisplayUrl}
                    alt={prompt || 'Generated AI image'}
                    width={originalImageDimensionsRef.current?.width || 512}
                    height={originalImageDimensionsRef.current?.height || 512}
                    className="object-contain w-full h-full max-w-full max-h-[512px] rounded"
                    data-ai-hint="generated image"
                  />
                )}
                {!isLoading && !currentDisplayUrl && (
                  <div className="w-full h-full rounded-md border border-dashed border-border bg-muted/50 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
                    <ImageIcon className="h-24 w-24 mb-4" />
                    <p className="text-lg">Your generated image will appear here.</p>
                  </div>
                )}
              </div>
               {currentDisplayUrl && !isLoading && (
                <div className="mt-4 space-y-2 sm:space-y-0 sm:space-x-2 flex flex-col sm:flex-row justify-center">
                  <Button onClick={handleSaveToDisk} variant="outline" className="w-full sm:w-auto"><Download className="mr-2 h-4 w-4" />Save</Button>
                  <Button onClick={handleAddToGallery} className="w-full sm:w-auto"><GalleryHorizontalEnd className="mr-2 h-4 w-4" />Add to Gallery</Button>
                  <Button onClick={() => setIsEditing(prev => !prev)} variant="outline" className="w-full sm:w-auto">
                    {isEditing ? 'Hide Tools' : 'Edit Image'} <Settings2 className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
           {/* Editing Tools Section - now part of the middle column */}
          {isEditing && currentDisplayUrl && (
            <Card className="shadow-lg"> 
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Edit Image</CardTitle>
                <Button onClick={handleResetEdits} variant="outline" size="sm">
                    <RotateCcw className="mr-2 h-4 w-4" /> Reset Edits
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Resize Controls */}
                <div className="space-y-3 p-4 border rounded-md">
                  <h4 className="text-lg font-semibold flex items-center"><Maximize className="mr-2 h-5 w-5 text-primary" />Resize</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                    <div className="space-y-1">
                      <Label htmlFor="resizeWidth">Width (px)</Label>
                      <Input id="resizeWidth" type="number" value={editDimensions.width} onChange={(e) => handleDimensionChange(e, 'width')} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="resizeHeight">Height (px)</Label>
                      <Input id="resizeHeight" type="number" value={editDimensions.height} onChange={(e) => handleDimensionChange(e, 'height')} />
                    </div>
                    <Button onClick={handleApplyResize} className="w-full sm:w-auto">Apply Resize</Button>
                  </div>
                </div>

                {/* Crop Controls */}
                <div className="space-y-3 p-4 border rounded-md">
                  <h4 className="text-lg font-semibold flex items-center"><Crop className="mr-2 h-5 w-5 text-primary"/>Crop</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 items-end">
                    <div className="space-y-1">
                      <Label htmlFor="cropX">X</Label>
                      <Input id="cropX" type="number" value={cropArea.x} onChange={(e) => handleCropChange(e, 'x')} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="cropY">Y</Label>
                      <Input id="cropY" type="number" value={cropArea.y} onChange={(e) => handleCropChange(e, 'y')} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="cropWidth">Width</Label>
                      <Input id="cropWidth" type="number" value={cropArea.width} onChange={(e) => handleCropChange(e, 'width')} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="cropHeight">Height</Label>
                      <Input id="cropHeight" type="number" value={cropArea.height} onChange={(e) => handleCropChange(e, 'height')} />
                    </div>
                    <Button onClick={handleApplyCrop} className="w-full sm:w-auto col-span-2 sm:col-span-1">Apply Crop</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Gallery Section */}
        <div className="lg:col-span-1">
            <Card className="shadow-lg h-full flex flex-col"> {/* h-full to take full height of grid cell */}
                <CardHeader><CardTitle>Image Gallery</CardTitle></CardHeader>
                <CardContent className="pt-0 p-2 flex-grow overflow-y-auto"> {/* flex-grow and overflow-y-auto */}
                {galleryImages.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">Your gallery is empty. Add some generated images!</p>
                ) : (
                    <div className="grid grid-cols-2 gap-2">
                    {galleryImages.map((imgDataUrl, index) => (
                        <div key={index} className="aspect-square bg-muted rounded-md overflow-hidden border hover:shadow-md transition-shadow">
                        <Image 
                            src={imgDataUrl} 
                            alt={`Gallery image ${index + 1}`} 
                            width={200} 
                            height={200} 
                            className="object-cover w-full h-full" 
                            data-ai-hint="gallery art"
                            priority={index < 4} 
                            />
                        </div>
                    ))}
                    </div>
                )}
                </CardContent>
            </Card>
        </div>
      </div>

      {/* Alerts - Placed below the main 3-column grid, within the form's padded area */}
      <div className="mt-8 space-y-4">
        {modifiedPromptMessage && (
          <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-700">
            <AlertCircle className="h-4 w-4 !text-blue-700" />
            <AlertTitle>Prompt Moderated</AlertTitle>
            <AlertDescription>{modifiedPromptMessage}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
      
      {/* Hidden canvas for image manipulation */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
