
export interface GalleryImage {
  id: string; // Unique identifier (from DB or locally generated for non-DB items)
  storageUrl: string; // Base64 encoded image data
  prompt?: string; // The prompt used to generate the image
  createdAt: Date; // Timestamp of creation or addition
}

export interface NewGalleryImage {
  storageUrl: string;
  prompt?: string;
}
