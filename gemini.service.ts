import { Injectable } from '@angular/core';
import { GoogleGenAI } from '@google/genai';

@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    // IMPORTANT: The API key is sourced directly from environment variables.
    // Do not expose this key in the client-side code in a real application.
    // This setup assumes the build process securely handles environment variables.
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error('API_KEY environment variable not set.');
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateImage(prompt: string, aspectRatio: string, imageDataUrl: string | null): Promise<string> {
    try {
      const modelRequest: any = {
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: aspectRatio as "1:1" | "3:4" | "4:3" | "9:16" | "16:9",
        },
      };

      if (imageDataUrl) {
        const [header, data] = imageDataUrl.split(',');
        const mimeType = header.match(/:(.*?);/)?.[1];
        if (!mimeType || !data) {
            throw new Error('Invalid image data URL format.');
        }
        modelRequest.image = {
            imageBytes: data,
            mimeType: mimeType
        }
      }

      const response = await this.ai.models.generateImages(modelRequest);

      if (response.generatedImages && response.generatedImages.length > 0) {
        const base64ImageBytes = response.generatedImages[0].image.imageBytes;
        return `data:image/jpeg;base64,${base64ImageBytes}`;
      } else {
        throw new Error('No images were generated.');
      }
    } catch (error) {
      console.error('Error generating image with Gemini API:', error);
      // Re-throw a more user-friendly error
      throw new Error('The request to the AI service failed. Please try again later.');
    }
  }
}