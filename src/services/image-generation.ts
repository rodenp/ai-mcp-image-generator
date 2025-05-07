/**
 * Represents the generated image as a binary file.
 */
export type GeneratedImage = Blob;

const IMAGE_GENERATION_ENDPOINT = 'https://n8n.courzey.com/webhook/image-gen';

/**
 * Asynchronously generates an image based on the given prompt.
 *
 * @param prompt The prompt to use for image generation.
 * @returns A promise that resolves to a GeneratedImage object.
 */
export async function generateImage(prompt: string): Promise<GeneratedImage> {
  try {
    const response = await fetch(IMAGE_GENERATION_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      let errorDetails = `Status: ${response.status}`;
      try {
        const errorText = await response.text();
        errorDetails += `, Body: ${errorText}`;
      } catch (e) {
        // Ignore if reading body fails
      }
      throw new Error(`Image generation failed: ${errorDetails}`);
    }

    const imageBlob = await response.blob();
    
    // Validate if the blob is an image, basic check for common types
    if (!imageBlob.type.startsWith('image/')) {
        // If the server doesn't set a content-type, or it's not an image,
        // we might want to throw or handle this. For now, we assume it's an image
        // or the endpoint is reliable. If it's text, it might be an error message
        // not caught by !response.ok
        const textContent = await imageBlob.text();
        if (textContent.toLowerCase().includes('error') || textContent.length < 200) { // Heuristic for text error
             throw new Error(`Image generation service returned non-image data: ${textContent.substring(0,100)}`);
        }
        // If it doesn't look like an error, proceed but log a warning
        console.warn(`Received blob with type ${imageBlob.type}, but expected an image type.`);
    }
    
    return imageBlob;
  } catch (error) {
    console.error('Error in generateImage:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unknown error occurred during image generation.');
  }
}
