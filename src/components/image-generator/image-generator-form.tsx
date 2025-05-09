
"use client";

import type { ChangeEvent } from 'react'; 
import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, ImageIcon, AlertCircle, Download, GalleryHorizontalEnd, RotateCcw, UploadCloud, Maximize, Crop } from 'lucide-react'; 
import { generateImage, type GeneratedImage } from '@/services/image-generation';
import { modifyPromptIfInappropriate, type ModifyPromptIfInappropriateOutput } from '@/ai/flows/modify-prompt-if-inappropriate';
import { useToast } from '@/hooks/use-toast';
import { saveImageToDb, getImagesFromDb, isDatabaseEffectivelyConfigured } from '@/lib/db/actions';
import type { GalleryImage, NewGalleryImage } from '@/lib/db/types';


const MAX_GALLERY_IMAGES = 20; 
const LOCAL_STORAGE_GALLERY_KEY = 'aiImageGalleryDataUrls'; // For non-DB fallback
const BACKEND_UPLOAD_URL = 'http://localhost:9003/upload-image'; // New backend URL

// Helper function to convert data URL to File object
async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type });
}

export function ImageGeneratorForm() {
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const [generatedImageBlobUrl, setGeneratedImageBlobUrl] = useState<string | null>(null); 
  const [currentDisplayUrl, setCurrentDisplayUrl] = useState<string | null>(null); // Can be object URL or data URL for display/editing

  const objectUrlRef = useRef<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const [originalImageDimensions, setOriginalImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [displayDimensions, setDisplayDimensions] = useState<{ width: number; height: number }>({ width: 512, height: 512});
  
  const [isCropping, setIsCropping] = useState(false);
  const [cropArea, setCropArea] = useState<{ x: number; y: number; width: number; height: number; displayX: number; displayY: number; displayWidth: number; displayHeight: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [isDbConfigured, setIsDbConfigured] = useState<boolean | null>(null);

  const [modifiedPromptMessage, setModifiedPromptMessage] = useState<string | null>(null);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    const checkDbConfig = async () => {
      try {
        const configured = await isDatabaseEffectivelyConfigured();
        setIsDbConfigured(configured);
      } catch (err) {
        console.error("Failed to check DB configuration:", err);
        toast({
          title: "Configuration Error",
          description: "Could not determine database configuration. Local storage will be used if available.",
          variant: "destructive",
        });
        setIsDbConfigured(false);
      }
    };
    checkDbConfig();
  }, [toast]);


  useEffect(() => {
    if (isDbConfigured === null) return; 

    const loadGallery = async () => {
      let imagesToDisplay: GalleryImage[] = [];
      if (isDbConfigured) {
        console.log("Database is configured. Attempting to load from DB.");
        try {
          const dbImages = await getImagesFromDb();
          imagesToDisplay = dbImages.map(img => ({...img, createdAt: new Date(img.createdAt)}));
        } catch (e) {
           console.error("Failed to load gallery images from DB:", e);
           toast({
              title: "Gallery Load Error",
              description: "Could not load images from the database.",
              variant: "destructive",
           });
        }
      } else { 
        console.log("Database not configured. Attempting to load from localStorage.");
        try {
          const storedGalleryJson = localStorage.getItem(LOCAL_STORAGE_GALLERY_KEY);
          if (storedGalleryJson) {
            const localDataUrls: string[] = JSON.parse(storedGalleryJson);
            imagesToDisplay = localDataUrls.map((dataUrl, index) => ({
              id: `local-id-${Date.now()}-${index}`,
              dataUrl, // For localStorage, this is still a base64 data URL
              prompt: 'From local storage', 
              createdAt: new Date(Date.now() - index * 60000), 
            }));
          }
        } catch (localError) {
           console.error("Failed to load gallery from localStorage:", localError);
           toast({
            title: "Local Storage Error",
            description: "Could not load images from local storage.",
            variant: "destructive",
          });
        }
      }
      setGalleryImages(imagesToDisplay.slice(0, MAX_GALLERY_IMAGES || undefined));
    };

    loadGallery();
  }, [isDbConfigured, toast]);


  useEffect(() => {
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
    setOriginalImageDimensions(null);
    setDisplayDimensions({ width: 512, height: 512});
    setIsCropping(false);
    setCropArea(null);
    setIsResizing(false);
    setResizeHandle(null);
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

      const imageBlob: GeneratedImage = await generateImage(finalPrompt); // This is a Blob
      
      // Create an object URL for immediate display
      const localBlobUrl = URL.createObjectURL(imageBlob);
      objectUrlRef.current = localBlobUrl; // Keep track to revoke later
      setGeneratedImageBlobUrl(localBlobUrl); // Store original blob URL for reset
      setCurrentDisplayUrl(localBlobUrl); // Display using object URL

      const img = new window.Image();
      img.onload = () => {
        setOriginalImageDimensions({ width: img.width, height: img.height });
        if (previewContainerRef.current) {
            const containerWidth = previewContainerRef.current.offsetWidth;
            const containerHeight = previewContainerRef.current.offsetHeight;
            const aspectRatio = img.width / img.height;
            let newWidth = containerWidth;
            let newHeight = newWidth / aspectRatio;
            if (newHeight > containerHeight) {
                newHeight = containerHeight;
                newWidth = newHeight * aspectRatio;
            }
            setDisplayDimensions({ width: Math.round(newWidth), height: Math.round(newHeight) });
          } else {
            setDisplayDimensions({ width: img.width, height: img.height });
          }
      };
      img.src = localBlobUrl;

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

  const drawImageToCanvas = useCallback((sourceUrl: string, operation: (ctx: CanvasRenderingContext2D, img: HTMLImageElement, originalDims: {width:number, height:number}) => {canvasWidth: number, canvasHeight: number}) => {
    return new Promise<string>((resolve, reject) => {
      const canvas = canvasRef.current;
      if (!canvas || !originalImageDimensions) {
        reject(new Error("Canvas or original dimensions not available"));
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Canvas context not available"));
        return;
      }

      const img = new window.Image();
      img.onload = () => {
        const {canvasWidth, canvasHeight} = operation(ctx, img, originalImageDimensions);
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        ctx.clearRect(0,0, canvasWidth, canvasHeight); // Clear canvas before drawing
        operation(ctx, img, originalImageDimensions); 
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error("Failed to load image for canvas operation"));
      img.crossOrigin = "anonymous"; 
      img.src = sourceUrl;
    });
  }, [originalImageDimensions]);


  const handleApplyResize = async (newWidth: number, newHeight: number) => { 
    if (!currentDisplayUrl || !originalImageDimensions) return;
    if (newWidth <= 0 || newHeight <= 0) {
        toast({ title: "Invalid Dimensions", description: "Width and height must be positive numbers.", variant: "destructive" });
        return;
    }

    try {
      const newImageUrl = await drawImageToCanvas(currentDisplayUrl, (ctx, img) => {
        ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, newWidth, newHeight);
        return { canvasWidth: newWidth, canvasHeight: newHeight };
      });
      setCurrentDisplayUrl(newImageUrl); 
      setOriginalImageDimensions({ width: newWidth, height: newHeight }); 
      if (previewContainerRef.current) {
        const containerWidth = previewContainerRef.current.offsetWidth;
        const containerHeight = previewContainerRef.current.offsetHeight;
        const aspectRatio = newWidth / newHeight;
        let dispWidth = containerWidth;
        let dispHeight = dispWidth / aspectRatio;
        if (dispHeight > containerHeight) {
            dispHeight = containerHeight;
            dispWidth = dispHeight * aspectRatio;
        }
        setDisplayDimensions({ width: Math.round(dispWidth), height: Math.round(dispHeight) });
      } else {
        setDisplayDimensions({ width: newWidth, height: newHeight });
      }
      setIsResizing(false);
      setResizeHandle(null);
      toast({ title: "Resize Applied", description: `Image resized to ${newWidth}x${newHeight}px.` });
    } catch (e: any) {
      toast({ title: "Resize Error", description: e.message, variant: "destructive" });
    }
  };

  const handleApplyCrop = async () => {
    if (!currentDisplayUrl || !cropArea || !originalImageDimensions || !imageRef.current) return;
    
    const naturalWidth = imageRef.current.naturalWidth;
    const naturalHeight = imageRef.current.naturalHeight;
    const displayToNaturalRatioX = naturalWidth / displayDimensions.width;
    const displayToNaturalRatioY = naturalHeight / displayDimensions.height;

    const naturalCropX = cropArea.displayX * displayToNaturalRatioX;
    const naturalCropY = cropArea.displayY * displayToNaturalRatioY;
    const naturalCropWidth = cropArea.displayWidth * displayToNaturalRatioX;
    const naturalCropHeight = cropArea.displayHeight * displayToNaturalRatioY;

     if (naturalCropWidth <= 0 || naturalCropHeight <= 0) {
        toast({ title: "Invalid Crop Area", description: "Crop width and height must be positive.", variant: "destructive" });
        return;
    }

    try {
      const newImageUrl = await drawImageToCanvas(currentDisplayUrl, (ctx, img) => {
        ctx.drawImage(img, naturalCropX, naturalCropY, naturalCropWidth, naturalCropHeight, 0, 0, naturalCropWidth, naturalCropHeight);
        return { canvasWidth: naturalCropWidth, canvasHeight: naturalCropHeight };
      });
      setCurrentDisplayUrl(newImageUrl); 
      setOriginalImageDimensions({ width: naturalCropWidth, height: naturalCropHeight }); 
       if (previewContainerRef.current) {
            const containerWidth = previewContainerRef.current.offsetWidth;
            const containerHeight = previewContainerRef.current.offsetHeight;
            const aspectRatio = naturalCropWidth / naturalCropHeight;
            let newWidth = containerWidth;
            let newHeight = newWidth / aspectRatio;
            if (newHeight > containerHeight) {
                newHeight = containerHeight;
                newWidth = newHeight * aspectRatio;
            }
            setDisplayDimensions({ width: Math.round(newWidth), height: Math.round(newHeight) });
        } else {
            setDisplayDimensions({ width: naturalCropWidth, height: naturalCropHeight });
        }
      setIsCropping(false);
      setCropArea(null);
      toast({ title: "Crop Applied" });
    } catch (e: any) {
      toast({ title: "Crop Error", description: e.message, variant: "destructive" });
    }
  };
  
  const handleResetEdits = () => {
    if (generatedImageBlobUrl) { 
        setCurrentDisplayUrl(generatedImageBlobUrl); 
        const img = new window.Image();
        img.onload = () => {
            if (img.naturalWidth && img.naturalHeight) { 
                setOriginalImageDimensions({ width: img.width, height: img.height });
                  if (previewContainerRef.current) {
                    const containerWidth = previewContainerRef.current.offsetWidth;
                    const containerHeight = previewContainerRef.current.offsetHeight;
                    const aspectRatio = img.width / img.height;
                    let newWidth = containerWidth;
                    let newHeight = newWidth / aspectRatio;
                    if (newHeight > containerHeight) {
                        newHeight = containerHeight;
                        newWidth = newHeight * aspectRatio;
                    }
                    setDisplayDimensions({ width: Math.round(newWidth), height: Math.round(newHeight) });
                } else {
                    setDisplayDimensions({ width: img.width, height: img.height });
                }
                setIsCropping(false);
                setCropArea(null);
                setIsResizing(false);
                setResizeHandle(null);
            } else {
                  toast({title: "Error Resetting", description: "Could not get original image dimensions.", variant:"destructive"});
            }
        };
        img.onerror = () => {
              toast({title: "Error Resetting", description: "Failed to load original image for reset.", variant: "destructive"});
        }
        img.src = generatedImageBlobUrl; 
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

  const uploadImageToBackend = async (imageSource: File | Blob | string, fileName: string): Promise<string | null> => {
    let imageFile: File;
    if (typeof imageSource === 'string') { 
        imageFile = await dataUrlToFile(imageSource, fileName);
    } else if (imageSource instanceof Blob && !(imageSource instanceof File)) {
        imageFile = new File([imageSource], fileName, { type: imageSource.type });
    } else {
        imageFile = imageSource as File;
    }

    const formData = new FormData();
    formData.append('image', imageFile);

    try {
      const response = await fetch(BACKEND_UPLOAD_URL, { // Use new backend URL
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to upload image (${response.status})`);
      }
      const result = await response.json();
      return result.storageUrl;
    } catch (uploadError: any) {
      console.error("Error uploading image to backend:", uploadError);
      toast({ title: "Upload to Backend Failed", description: uploadError.message, variant: "destructive" });
      return null;
    }
  };


  const handleAddToGallery = async () => {
    if (!currentDisplayUrl) return; 
    if (MAX_GALLERY_IMAGES > 0 && galleryImages.length >= MAX_GALLERY_IMAGES) {
        toast({ title: "Gallery Full", description: `Cannot add more than ${MAX_GALLERY_IMAGES} images.`, variant: "destructive"});
        return;
    }
    if (isDbConfigured === null) {
        toast({ title: "Please wait", description: "Checking database configuration...", variant: "default"});
        return;
    }
    
    setIsLoading(true); 

    if (isDbConfigured) {
      const storageUrl = await uploadImageToBackend(currentDisplayUrl, `${prompt.substring(0,20) || 'gallery_image'}.png`);
      setIsLoading(false); 

      if (storageUrl) {
        const newImageEntry: NewGalleryImage = { dataUrl: storageUrl, prompt }; 
        try {
          const savedImage = await saveImageToDb(newImageEntry);
          if (savedImage) {
            setGalleryImages(prev => [{...savedImage, createdAt: new Date(savedImage.createdAt) }, ...prev].slice(0, MAX_GALLERY_IMAGES || undefined));
            toast({ title: "Added to Cloud Gallery", description: "Image saved to your cloud gallery." });
          } else {
            toast({ title: "Save Error", description: "Failed to save image metadata to cloud gallery. Check server logs.", variant: "destructive" });
          }
        } catch (e) {
          console.error("Error saving to DB:", e);
          toast({ title: "Gallery Error", description: "An error occurred while saving to cloud gallery.", variant: "destructive" });
        }
      } else {
         toast({ title: "Storage Error", description: "Could not upload image to cloud storage.", variant: "destructive" });
      }
    } else { 
      setIsLoading(false);
      console.log("Database not configured, saving image dataURL to localStorage.");
      try {
        let dataUrlToStore = currentDisplayUrl;
        if (currentDisplayUrl.startsWith('blob:')) { 
            const response = await fetch(currentDisplayUrl);
            const blob = await response.blob();
            dataUrlToStore = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        }

        const localDataUrls: string[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_GALLERY_KEY) || '[]');
        const updatedLocalDataUrls = [dataUrlToStore, ...localDataUrls].slice(0, MAX_GALLERY_IMAGES || undefined);
        localStorage.setItem(LOCAL_STORAGE_GALLERY_KEY, JSON.stringify(updatedLocalDataUrls));
        
        const localGalleryImage: GalleryImage = {
            id: `local-gen-${Date.now()}`,
            dataUrl: dataUrlToStore, 
            prompt,
            createdAt: new Date(),
        };
        setGalleryImages(prev => [localGalleryImage, ...prev].slice(0, MAX_GALLERY_IMAGES || undefined));
        toast({ title: "Added to Local Gallery", description: "Image saved locally as DB is not configured." });
      } catch (localError) {
        console.error("Error saving to localStorage:", localError);
        toast({ title: "Local Storage Error", description: "Could not save image to local storage.", variant: "destructive" });
      }
    }
  };


  const handleUploadButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (MAX_GALLERY_IMAGES > 0 && galleryImages.length >= MAX_GALLERY_IMAGES) {
      toast({
        title: "Gallery Full",
        description: `Cannot add more than ${MAX_GALLERY_IMAGES} images. Please remove some images first.`,
        variant: "destructive",
      });
      if (fileInputRef.current) fileInputRef.current.value = ""; 
      return;
    }
    if (isDbConfigured === null) {
        toast({ title: "Please wait", description: "Checking database configuration...", variant: "default"});
        if (fileInputRef.current) fileInputRef.current.value = ""; 
        return;
    }
    
    setIsLoading(true); 

    if (isDbConfigured) {
      const storageUrl = await uploadImageToBackend(file, file.name);
      setIsLoading(false);
      if (storageUrl) {
        const newImageEntry: NewGalleryImage = { dataUrl: storageUrl, prompt: `Uploaded: ${file.name}` };
        try {
          const savedImage = await saveImageToDb(newImageEntry);
          if (savedImage) {
              setGalleryImages(prev => [{...savedImage, createdAt: new Date(savedImage.createdAt)}, ...prev].slice(0, MAX_GALLERY_IMAGES || undefined));
              toast({ title: "Image Uploaded", description: `${file.name} added to cloud gallery.` });
          } else {
              toast({ title: "Upload Error", description: `Could not save ${file.name} metadata to cloud gallery. Check server logs.`, variant: "destructive" });
          }
        } catch (e) {
          console.error("Error saving uploaded image to DB:", e);
          toast({ title: "Upload Error", description: "Could not save uploaded image metadata to database.", variant: "destructive" });
        }
      } else {
         toast({ title: "Storage Error", description: `Could not upload ${file.name} to cloud storage.`, variant: "destructive" });
      }
    } else { 
      setIsLoading(false);
      console.log("Database not configured, saving uploaded image dataURL to localStorage.");
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result as string;
        try {
          const localDataUrls: string[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_GALLERY_KEY) || '[]');
          const updatedLocalDataUrls = [dataUrl, ...localDataUrls].slice(0, MAX_GALLERY_IMAGES || undefined);
          localStorage.setItem(LOCAL_STORAGE_GALLERY_KEY, JSON.stringify(updatedLocalDataUrls));

          const localGalleryImage: GalleryImage = {
              id: `local-upload-${Date.now()}`,
              dataUrl,
              prompt: `Uploaded: ${file.name}`,
              createdAt: new Date(),
          };
          setGalleryImages(prev => [localGalleryImage, ...prev].slice(0, MAX_GALLERY_IMAGES || undefined));
          toast({ title: "Image Uploaded Locally", description: `${file.name} added to local gallery as DB is not configured.` });
        } catch (localError) {
          console.error("Error saving uploaded image to localStorage:", localError);
          toast({ title: "Local Storage Error", description: "Could not save uploaded image to local storage.", variant: "destructive" });
        }
      };
      reader.onerror = () => {
        toast({ title: "Upload Error", description: "Failed to read the image file for local storage.", variant: "destructive"});
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = ""; 
  };


  const startCrop = () => {
    if (!imageRef.current || !previewContainerRef.current || !originalImageDimensions) return;
    setIsCropping(true);
    setIsResizing(false);
    setResizeHandle(null);

    const initialCropWidth = displayDimensions.width / 2;
    const initialCropHeight = displayDimensions.height / 2;
    const initialCropX = (displayDimensions.width - initialCropWidth) / 2;
    const initialCropY = (displayDimensions.height - initialCropHeight) / 2;
    
    setCropArea({
      x: initialCropX, 
      y: initialCropY,
      width: initialCropWidth,
      height: initialCropHeight,
      displayX: initialCropX,
      displayY: initialCropY,
      displayWidth: initialCropWidth,
      displayHeight: initialCropHeight,
    });
  };

  const startResize = () => {
    if (!imageRef.current || !originalImageDimensions) return;
    setIsResizing(true);
    setIsCropping(false);
    setCropArea(null);
    setResizeHandle({
        x: displayDimensions.width -10, 
        y: displayDimensions.height -10,
        width: displayDimensions.width,
        height: displayDimensions.height
    });
  };

  const handleMouseDown = (e: React.MouseEvent, handleType: 'crop' | 'resize' | 'crop-tl' | 'crop-tr' | 'crop-bl' | 'crop-br') => {
    e.preventDefault();
    e.stopPropagation(); 
    if (!imageRef.current || !previewContainerRef.current ) return;
    if (handleType.startsWith('crop') && !cropArea && handleType !== 'crop') return; 

    const startX = e.clientX;
    const startY = e.clientY;

    const initialCrop = cropArea ? { ...cropArea } : null;
    const initialResizeDims = { ...displayDimensions };


    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      if (isCropping && initialCrop) {
        let newDisplayX = initialCrop.displayX;
        let newDisplayY = initialCrop.displayY;
        let newDisplayWidth = initialCrop.displayWidth;
        let newDisplayHeight = initialCrop.displayHeight;

        switch (handleType) {
            case 'crop': 
                newDisplayX = Math.max(0, Math.min(initialCrop.displayX + dx, displayDimensions.width - initialCrop.displayWidth));
                newDisplayY = Math.max(0, Math.min(initialCrop.displayY + dy, displayDimensions.height - initialCrop.displayHeight));
                break;
            case 'crop-tl': 
                newDisplayX = initialCrop.displayX + dx;
                newDisplayY = initialCrop.displayY + dy;
                newDisplayWidth = initialCrop.displayWidth - dx;
                newDisplayHeight = initialCrop.displayHeight - dy;
                break;
            case 'crop-tr': 
                newDisplayY = initialCrop.displayY + dy;
                newDisplayWidth = initialCrop.displayWidth + dx;
                newDisplayHeight = initialCrop.displayHeight - dy;
                break;
            case 'crop-bl': 
                newDisplayX = initialCrop.displayX + dx;
                newDisplayWidth = initialCrop.displayWidth - dx;
                newDisplayHeight = initialCrop.displayHeight + dy;
                break;
            case 'crop-br': 
                newDisplayWidth = initialCrop.displayWidth + dx;
                newDisplayHeight = initialCrop.displayHeight + dy;
                break;
        }
        
        newDisplayX = Math.max(0, newDisplayX);
        newDisplayY = Math.max(0, newDisplayY);
        
        if(handleType === 'crop-tl' || handleType === 'crop-bl') { 
            if(newDisplayX + Math.max(20, newDisplayWidth) > initialCrop.displayX + initialCrop.displayWidth) {
                 newDisplayX = (initialCrop.displayX + initialCrop.displayWidth) - Math.max(20, newDisplayWidth);
            }
        }
         if(handleType === 'crop-tl' || handleType === 'crop-tr') { 
            if(newDisplayY + Math.max(20, newDisplayHeight) > initialCrop.displayY + initialCrop.displayHeight) {
                 newDisplayY = (initialCrop.displayY + initialCrop.displayHeight) - Math.max(20, newDisplayHeight);
            }
        }
        
        newDisplayWidth = Math.max(20, Math.min(newDisplayWidth, displayDimensions.width - newDisplayX));
        newDisplayHeight = Math.max(20, Math.min(newDisplayHeight, displayDimensions.height - newDisplayY));

        if (handleType === 'crop-tl' || handleType === 'crop-bl') {
             newDisplayX = (initialCrop.displayX + initialCrop.displayWidth) - newDisplayWidth;
        }
        if (handleType === 'crop-tl' || handleType === 'crop-tr') {
            newDisplayY = (initialCrop.displayY + initialCrop.displayHeight) - newDisplayHeight;
        }

        newDisplayX = Math.max(0, Math.min(newDisplayX, displayDimensions.width - newDisplayWidth));
        newDisplayY = Math.max(0, Math.min(newDisplayY, displayDimensions.height - newDisplayHeight));

        setCropArea({ ...initialCrop, displayX: newDisplayX, displayY: newDisplayY, displayWidth: newDisplayWidth, displayHeight: newDisplayHeight });
      } else if (isResizing && originalImageDimensions && previewContainerRef.current) {
        const aspectRatio = originalImageDimensions.width / originalImageDimensions.height;
        
        let newWidth = initialResizeDims.width + dx; 
        newWidth = Math.max(50, Math.min(newWidth, previewContainerRef.current.offsetWidth)); 
        let newHeight = newWidth / aspectRatio;
        
        if (newHeight > previewContainerRef.current.offsetHeight) {
            newHeight = previewContainerRef.current.offsetHeight;
            newWidth = newHeight * aspectRatio;
        }
        newHeight = Math.max(50, newHeight);
        newWidth = Math.max(50, newWidth); 

        setDisplayDimensions({ width: Math.round(newWidth), height: Math.round(newHeight) });
        setResizeHandle(prev => prev ? {...prev, x: Math.round(newWidth) - 10, y: Math.round(newHeight) - 10, width: Math.round(newWidth), height: Math.round(newHeight)} : null);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };


  const tips = [
    "Be specific about subject, style, and setting.",
    "Try artistic styles like 'oil painting' or 'digital art'.",
    "Specify lighting: 'golden hour', 'studio lighting'.",
    "Use names of artists to guide the style.",
    "Combine concepts: 'a cat astronaut on Mars'.",
  ];
  
  return (
    <div className="w-full pt-8 pb-12 flex flex-col flex-grow">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-6 gap-y-8 flex-grow px-1 sm:px-2 lg:px-2">
        <div className="space-y-6 lg:col-span-4 xl:col-span-3"> 
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

        <div className="space-y-6 lg:col-span-5 xl:col-span-6 flex flex-col"> 
          <Card className="shadow-lg flex-grow flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Generated Image</CardTitle>
                 {currentDisplayUrl && !isLoading && (
                    <div className="flex space-x-2">
                        <Button onClick={startResize} variant="outline" size="sm" disabled={isCropping} className={isResizing ? "ring-2 ring-primary" : ""}>
                            <Maximize className="mr-2 h-4 w-4" /> Resize
                        </Button>
                        <Button onClick={startCrop} variant="outline" size="sm" disabled={isResizing} className={isCropping ? "ring-2 ring-primary" : ""}>
                            <Crop className="mr-2 h-4 w-4" /> Crop
                        </Button>
                        {generatedImageBlobUrl && ( 
                             <Button onClick={handleResetEdits} variant="outline" size="sm" disabled={isCropping || isResizing}>
                                <RotateCcw className="mr-2 h-4 w-4" /> Reset
                            </Button>
                        )}
                    </div>
                 )}
            </CardHeader>
            <CardContent className="flex-grow flex flex-col items-center justify-center p-2 relative" ref={previewContainerRef}>
              <div className="relative w-full h-full flex items-center justify-center overflow-hidden"> 
                {isLoading && (
                  <div className="flex flex-col items-center text-muted-foreground">
                    <Loader2 className="h-16 w-16 animate-spin text-primary mb-3" />
                    <p className="text-lg">Your vision is materializing...</p>
                  </div>
                )}
                {!isLoading && currentDisplayUrl && originalImageDimensions && (
                  <div style={{ width: displayDimensions.width, height: displayDimensions.height }} className="relative"> 
                    <Image
                        ref={imageRef}
                        src={currentDisplayUrl}
                        alt={prompt || 'Generated AI image'}
                        width={displayDimensions.width} 
                        height={displayDimensions.height} 
                        className="object-contain select-none" 
                        data-ai-hint="generated art"
                        priority 
                        draggable={false}
                        onDragStart={(e) => e.preventDefault()} 
                        onError={() => {
                            toast({title:"Image Load Error", description: "Could not display current image.", variant:"destructive"});
                            setCurrentDisplayUrl(null); 
                        }}
                      />
                      {isCropping && cropArea && (
                        <div
                            className="absolute border-2 border-dashed border-primary bg-primary/20 cursor-move"
                            style={{ 
                                left: cropArea.displayX, 
                                top: cropArea.displayY, 
                                width: cropArea.displayWidth, 
                                height: cropArea.displayHeight,
                                touchAction: 'none', 
                            }}
                            onMouseDown={(e) => handleMouseDown(e, 'crop')}
                        >
                            <div onMouseDown={(e) => handleMouseDown(e, 'crop-tl')} className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-primary rounded-full cursor-nwse-resize border-2 border-background" style={{touchAction: 'none'}}></div>
                            <div onMouseDown={(e) => handleMouseDown(e, 'crop-tr')} className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-primary rounded-full cursor-nesw-resize border-2 border-background" style={{touchAction: 'none'}}></div>
                            <div onMouseDown={(e) => handleMouseDown(e, 'crop-bl')} className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-primary rounded-full cursor-nesw-resize border-2 border-background" style={{touchAction: 'none'}}></div>
                            <div onMouseDown={(e) => handleMouseDown(e, 'crop-br')} className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-primary rounded-full cursor-nwse-resize border-2 border-background" style={{touchAction: 'none'}}></div>
                        </div>
                      )}
                      {isResizing && resizeHandle && (
                        <div
                            className="absolute w-4 h-4 bg-primary rounded-full cursor-nwse-resize border-2 border-background"
                            style={{
                                left: resizeHandle.x -2, 
                                top: resizeHandle.y -2,
                                touchAction: 'none',
                            }}
                            onMouseDown={(e) => handleMouseDown(e, 'resize')}
                        />
                      )}
                  </div>
                )}
                {!isLoading && !currentDisplayUrl && (
                  <div className="w-full h-full rounded-md border border-dashed border-border bg-muted/50 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
                    <ImageIcon className="h-24 w-24 mb-4" />
                    <p className="text-lg">Your generated image will appear here.</p>
                  </div>
                )}
              </div>

            </CardContent>
             {currentDisplayUrl && !isLoading && (
                <div className="p-4 border-t">
                     {isCropping && cropArea && (
                         <div className="flex justify-end space-x-2 mb-2">
                            <Button onClick={handleApplyCrop} size="sm">Apply Crop</Button>
                            <Button onClick={() => { setIsCropping(false); setCropArea(null); }} variant="outline" size="sm">Cancel</Button>
                        </div>
                    )}
                    {isResizing && resizeHandle && originalImageDimensions && (
                        <div className="space-y-2 mb-2">
                            <div className="flex items-center space-x-2">
                                <Label htmlFor="resizeWidth" className="w-16">Width:</Label>
                                <Input id="resizeWidth" type="number" value={Math.round(displayDimensions.width)} 
                                    onChange={(e) => {
                                        const newW = parseInt(e.target.value);
                                        if (!isNaN(newW) && newW > 0 && originalImageDimensions) {
                                           const newH = Math.round(newW / (originalImageDimensions.width / originalImageDimensions.height));
                                           setDisplayDimensions({width: newW, height: newH});
                                           setResizeHandle(prev => prev ? {...prev, x:newW -10, y:newH-10, width: newW, height: newH} : null);
                                        }
                                    }}
                                    className="h-8"
                                />
                                <Label htmlFor="resizeHeight" className="w-16">Height:</Label>
                                <Input id="resizeHeight" type="number" value={Math.round(displayDimensions.height)}
                                     onChange={(e) => {
                                        const newH = parseInt(e.target.value);
                                        if (!isNaN(newH) && newH > 0 && originalImageDimensions) {
                                           const newW = Math.round(newH * (originalImageDimensions.width / originalImageDimensions.height));
                                           setDisplayDimensions({width: newW, height: newH});
                                           setResizeHandle(prev => prev ? {...prev, x:newW -10, y:newH-10, width: newW, height: newH} : null);
                                        }
                                    }}
                                     className="h-8"
                                />
                            </div>
                            <div className="flex justify-end space-x-2">
                                <Button onClick={() => handleApplyResize(Math.round(displayDimensions.width), Math.round(displayDimensions.height))} size="sm">Apply Resize</Button>
                                <Button onClick={() => { setIsResizing(false); setResizeHandle(null); if (generatedImageBlobUrl) handleResetEdits(); }} variant="outline" size="sm">Cancel</Button>
                            </div>
                        </div>
                    )}
                    <div className="mt-1 space-y-2 sm:space-y-0 sm:space-x-2 flex flex-col sm:flex-row justify-center">
                    <Button onClick={handleSaveToDisk} variant="outline" className="w-full sm:w-auto" disabled={isCropping || isResizing || isLoading}><Download className="mr-2 h-4 w-4" />Save</Button>
                    <Button onClick={handleAddToGallery} className="w-full sm:w-auto" disabled={isCropping || isResizing || isDbConfigured === null || isLoading}><GalleryHorizontalEnd className="mr-2 h-4 w-4" />Add to Gallery</Button>
                    </div>
                </div>
              )}
          </Card>
        </div>

        <div className="lg:col-span-3 xl:col-span-3"> 
             <Card className="shadow-lg h-full flex flex-col max-h-[calc(100vh-var(--header-height,6rem)-var(--footer-height,4rem)-var(--main-padding-y,3rem)-3.5rem)]"> 
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Image Gallery</CardTitle>
                  <Button onClick={handleUploadButtonClick} variant="outline" size="sm" disabled={isDbConfigured === null || isLoading}>
                    <UploadCloud className="mr-2 h-4 w-4" /> Upload
                  </Button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                </CardHeader>
                <CardContent className="pt-0 flex-grow overflow-y-auto">
                {isDbConfigured === null && (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                        <p>Loading gallery...</p>
                    </div>
                )}
                {isDbConfigured !== null && galleryImages.length === 0 && (
                    <p className="text-muted-foreground text-center py-4">Your gallery is empty. Add some generated or uploaded images!</p>
                )}
                {isDbConfigured !== null && galleryImages.length > 0 && (
                    <div className="grid grid-cols-2 gap-4">
                    {galleryImages.map((imgEntry, index) => (
                        <div 
                            key={imgEntry.id} 
                            className="relative aspect-square bg-muted/10 rounded-lg overflow-hidden border-2 border-input shadow-md hover:shadow-xl hover:ring-2 hover:ring-primary/40 focus-within:ring-2 focus-within:ring-primary/40 transition-all duration-200 cursor-pointer"
                            onClick={() => {
                                setCurrentDisplayUrl(imgEntry.dataUrl);
                                const img = new window.Image();
                                img.onload = () => {
                                     setOriginalImageDimensions({ width: img.width, height: img.height });
                                     if (previewContainerRef.current) {
                                        const containerWidth = previewContainerRef.current.offsetWidth;
                                        const containerHeight = previewContainerRef.current.offsetHeight;
                                        const aspectRatio = img.width / img.height;
                                        let newWidth = containerWidth;
                                        let newHeight = newWidth / aspectRatio;
                                        if (newHeight > containerHeight) {
                                            newHeight = containerHeight;
                                            newWidth = newHeight * aspectRatio;
                                        }
                                        setDisplayDimensions({ width: Math.round(newWidth), height: Math.round(newHeight) });
                                    } else {
                                       setDisplayDimensions({ width: img.width, height: img.height });
                                    }
                                    setIsCropping(false); setCropArea(null); 
                                    setIsResizing(false); setResizeHandle(null);
                                    setPrompt(imgEntry.prompt || ''); 
                                    setGeneratedImageBlobUrl(null); 
                                }
                                img.onerror = () => toast({title: "Gallery Load Error", description: "Could not load selected image.", variant:"destructive"});
                                img.crossOrigin = "anonymous"; 
                                img.src = imgEntry.dataUrl;
                            }}
                        >
                          <Image 
                              src={imgEntry.dataUrl} 
                              alt={imgEntry.prompt || `Gallery image ${index + 1}`}
                              fill
                              sizes="(max-width: 767px) 40vw, (max-width: 1023px) 20vw, (max-width: 1279px) 15vw, 12vw" 
                              className="object-cover"
                              data-ai-hint="gallery art"
                              priority={index < 4}
                              onError={(e) => {
                                console.warn(`Failed to load gallery image: ${imgEntry.id}`);
                                (e.target as HTMLImageElement).src = 'https://picsum.photos/200/200?grayscale&blur=2'; 
                              }}
                            />
                        </div>
                    ))}
                    </div>
                )}
                </CardContent>
            </Card>
        </div>
      </div>

      <div className="mt-4 space-y-4 px-4 sm:px-6 lg:px-8">
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
      
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
