import { ChangeDetectionStrategy, Component, inject, signal, computed, effect, viewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeminiService } from './services/gemini.service';

interface AspectRatio {
  value: string;
  label: string;
}

declare var Cropper: any;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class AppComponent {
  private geminiService = inject(GeminiService);

  prompt = signal<string>('A photorealistic image of a majestic lion in the savanna at sunset, cinematic lighting');
  generatedImage = signal<string | null>(null);
  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);
  selectedAspectRatio = signal<string>('1:1');
  uploadedImage = signal<string | null>(null);
  isDragging = signal(false);

  // Editing state
  isEditing = signal(false);
  originalImage = signal<string | null>(null);
  private cropper: any;

  // Filter signals
  brightness = signal(100);
  contrast = signal(100);
  saturate = signal(100);
  grayscale = signal(0);
  sepia = signal(0);
  invert = signal(0);

  filterStyle = computed(() =>
    `brightness(${this.brightness()}%) contrast(${this.contrast()}%) saturate(${this.saturate()}%) grayscale(${this.grayscale()}%) sepia(${this.sepia()}%) invert(${this.invert()}%)`
  );

  editImageElement = viewChild<ElementRef<HTMLImageElement>>('editImage');

  aspectRatios: AspectRatio[] = [
    { value: '1:1', label: 'Square' },
    { value: '16:9', label: 'Landscape' },
    { value: '9:16', label: 'Portrait' },
    { value: '4:3', label: 'Standard' },
    { value: '3:4', label: 'Tall' },
  ];

  constructor() {
    effect(() => {
      const isEditing = this.isEditing();
      const imageElement = this.editImageElement()?.nativeElement;

      if (isEditing && imageElement) {
        setTimeout(() => this.initCropper(imageElement), 50); // Delay to ensure modal is rendered
      } else if (this.cropper) {
        this.destroyCropper();
      }
    });
  }
  
  async generateImage(): Promise<void> {
    const currentPrompt = this.prompt();
    if (!currentPrompt.trim() || this.isLoading()) {
      return;
    }

    this.isLoading.set(true);
    this.generatedImage.set(null);
    this.originalImage.set(null);
    this.error.set(null);

    try {
      const imageData = await this.geminiService.generateImage(currentPrompt, this.selectedAspectRatio(), this.uploadedImage());
      this.generatedImage.set(imageData);
      this.originalImage.set(imageData);
    } catch (e) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred. Please check the console.';
      this.error.set(`Failed to generate image. ${errorMessage}`);
    } finally {
      this.isLoading.set(false);
    }
  }

  updatePrompt(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    this.prompt.set(target.value);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  onFileSelected(event: Event): void {
    const element = event.currentTarget as HTMLInputElement;
    const fileList: FileList | null = element.files;
    if (fileList && fileList[0]) {
      this.handleFile(fileList[0]);
    }
  }

  private handleFile(file: File): void {
    if (file.size > 4 * 1024 * 1024) { // 4MB limit
      this.error.set('Image size should be less than 4MB.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      this.error.set('Please upload a valid image file (PNG, JPG, WebP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.uploadedImage.set(e.target.result);
      this.error.set(null);
    };
    reader.readAsDataURL(file);
  }

  removeImage(event: MouseEvent): void {
    event.stopPropagation();
    this.uploadedImage.set(null);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  // --- Editing Methods ---

  openEditModal(): void {
    this.isEditing.set(true);
  }

  private initCropper(imageElement: HTMLImageElement): void {
    if (this.cropper) {
      this.cropper.destroy();
    }
    this.cropper = new Cropper(imageElement, {
      viewMode: 1,
      dragMode: 'move',
      autoCropArea: 1,
      restore: false,
      guides: false,
      center: false,
      highlight: false,
      cropBoxMovable: true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: false,
      background: false,
    });
  }

  private destroyCropper(): void {
    if (this.cropper) {
      this.cropper.destroy();
      this.cropper = null;
    }
  }
  
  saveChanges(): void {
    if (!this.cropper) return;

    const croppedCanvas = this.cropper.getCroppedCanvas({
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
    });

    if (!croppedCanvas) return;

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = croppedCanvas.width;
    finalCanvas.height = croppedCanvas.height;
    const ctx = finalCanvas.getContext('2d');

    if (ctx) {
        ctx.filter = this.filterStyle();
        ctx.drawImage(croppedCanvas, 0, 0);
        this.generatedImage.set(finalCanvas.toDataURL('image/jpeg', 0.95));
    }

    this.closeEditModal();
  }

  cancelEditing(): void {
    this.closeEditModal();
  }

  private closeEditModal(): void {
    this.isEditing.set(false);
    this.resetFilters();
  }

  resetFilters(): void {
    this.brightness.set(100);
    this.contrast.set(100);
    this.saturate.set(100);
    this.grayscale.set(0);
    this.sepia.set(0);
    this.invert.set(0);
  }
}