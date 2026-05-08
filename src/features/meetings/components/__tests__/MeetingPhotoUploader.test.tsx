import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MeetingPhotoUploader } from '../MeetingPhotoUploader';

/**
 * MeetingPhotoUploader Component Tests
 *
 * Tests for the photo upload component used to upload meeting photos.
 * **Validates: Requirements 34**
 */
describe('MeetingPhotoUploader', () => {
  const mockOnUpload = vi.fn();
  const mockOnError = vi.fn();

  beforeEach(() => {
    mockOnUpload.mockClear();
    mockOnError.mockClear();
  });

  describe('Rendering', () => {
    it('should render upload area', () => {
      render(
        <MeetingPhotoUploader
          onUpload={mockOnUpload}
          onError={mockOnError}
          isUploading={false}
        />
      );

      expect(screen.getByText(/drag and drop/i)).toBeInTheDocument();
    });

    it('should render file input', () => {
      render(
        <MeetingPhotoUploader
          onUpload={mockOnUpload}
          onError={mockOnError}
          isUploading={false}
        />
      );

      const fileInput = screen.getByRole('button', { name: /select files/i });
      expect(fileInput).toBeInTheDocument();
    });

    it('should show loading state while uploading', () => {
      render(
        <MeetingPhotoUploader
          onUpload={mockOnUpload}
          onError={mockOnError}
          isUploading={true}
        />
      );

      expect(screen.getByRole('status')).toBeInTheDocument();
      const uploadButton = screen.getByRole('button', { name: /upload/i });
      expect(uploadButton).toBeDisabled();
    });
  });

  describe('File Selection', () => {
    it('should handle file selection via button click', async () => {
      const user = userEvent.setup();
      render(
        <MeetingPhotoUploader
          onUpload={mockOnUpload}
          onError={mockOnError}
          isUploading={false}
        />
      );

      const selectButton = screen.getByRole('button', { name: /select files/i });
      await user.click(selectButton);

      // File input should be triggered
      const fileInput = screen.getByRole('button', { name: /select files/i }).querySelector('input[type="file"]');
      expect(fileInput).toBeInTheDocument();
    });

    it('should display selected files', async () => {
      const user = userEvent.setup();
      render(
        <MeetingPhotoUploader
          onUpload={mockOnUpload}
          onError={mockOnError}
          isUploading={false}
        />
      );

      const fileInput = screen.getByRole('button', { name: /select files/i }).querySelector('input[type="file"]') as HTMLInputElement;
      
      const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
      await user.upload(fileInput, file);

      // File should be displayed
      await waitFor(() => {
        expect(screen.getByText('photo.jpg')).toBeInTheDocument();
      });
    });

    it('should allow multiple file selection', async () => {
      const user = userEvent.setup();
      render(
        <MeetingPhotoUploader
          onUpload={mockOnUpload}
          onError={mockOnError}
          isUploading={false}
        />
      );

      const fileInput = screen.getByRole('button', { name: /select files/i }).querySelector('input[type="file"]') as HTMLInputElement;
      
      const files = [
        new File(['photo1'], 'photo1.jpg', { type: 'image/jpeg' }),
        new File(['photo2'], 'photo2.jpg', { type: 'image/jpeg' }),
      ];
      await user.upload(fileInput, files);

      // Both files should be displayed
      await waitFor(() => {
        expect(screen.getByText('photo1.jpg')).toBeInTheDocument();
        expect(screen.getByText('photo2.jpg')).toBeInTheDocument();
      });
    });
  });

  describe('Drag and Drop', () => {
    it('should handle drag over', async () => {
      const user = userEvent.setup();
      render(
        <MeetingPhotoUploader
          onUpload={mockOnUpload}
          onError={mockOnError}
          isUploading={false}
        />
      );

      const dropZone = screen.getByText(/drag and drop/i).closest('[data-dropzone]');
      
      fireEvent.dragOver(dropZone!);
      
      expect(dropZone).toHaveClass('drag-over');
    });

    it('should handle drag leave', async () => {
      render(
        <MeetingPhotoUploader
          onUpload={mockOnUpload}
          onError={mockOnError}
          isUploading={false}
        />
      );

      const dropZone = screen.getByText(/drag and drop/i).closest('[data-dropzone]');
      
      fireEvent.dragOver(dropZone!);
      fireEvent.dragLeave(dropZone!);
      
      expect(dropZone).not.toHaveClass('drag-over');
    });

    it('should handle drop with files', async () => {
      render(
        <MeetingPhotoUploader
          onUpload={mockOnUpload}
          onError={mockOnError}
          isUploading={false}
        />
      );

      const dropZone = screen.getByText(/drag and drop/i).closest('[data-dropzone]');
      
      const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
      const dataTransfer = {
        files: [file],
        items: [{ kind: 'file', type: 'image/jpeg', getAsFile: () => file }],
        types: ['Files'],
      };

      fireEvent.drop(dropZone!, { dataTransfer });

      // File should be added
      await waitFor(() => {
        expect(screen.getByText('photo.jpg')).toBeInTheDocument();
      });
    });
  });

  describe('File Validation', () => {
    it('should reject non-image files', async () => {
      const user = userEvent.setup();
      render(
        <MeetingPhotoUploader
          onUpload={mockOnUpload}
          onError={mockOnError}
          isUploading={false}
        />
      );

      const fileInput = screen.getByRole('button', { name: /select files/i }).querySelector('input[type="file"]') as HTMLInputElement;
      
      const file = new File(['document'], 'document.pdf', { type: 'application/pdf' });
      await user.upload(fileInput, file);

      // Error should be shown
      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(expect.stringContaining('image'));
      });
    });

    it('should reject files larger than 5MB', async () => {
      const user = userEvent.setup();
      render(
        <MeetingPhotoUploader
          onUpload={mockOnUpload}
          onError={mockOnError}
          isUploading={false}
        />
      );

      const fileInput = screen.getByRole('button', { name: /select files/i }).querySelector('input[type="file"]') as HTMLInputElement;
      
      // Create a large file (6MB)
      const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
      await user.upload(fileInput, largeFile);

      // Error should be shown
      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(expect.stringContaining('5MB'));
      });
    });

    it('should accept valid image formats', async () => {
      const user = userEvent.setup();
      render(
        <MeetingPhotoUploader
          onUpload={mockOnUpload}
          onError={mockOnError}
          isUploading={false}
        />
      );

      const fileInput = screen.getByRole('button', { name: /select files/i }).querySelector('input[type="file"]') as HTMLInputElement;
      
      const jpgFile = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
      const pngFile = new File(['photo'], 'photo.png', { type: 'image/png' });
      
      await user.upload(fileInput, [jpgFile, pngFile]);

      // Files should be accepted
      await waitFor(() => {
        expect(screen.getByText('photo.jpg')).toBeInTheDocument();
        expect(screen.getByText('photo.png')).toBeInTheDocument();
      });
    });
  });

  describe('Upload Functionality', () => {
    it('should call onUpload when upload button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <MeetingPhotoUploader
          onUpload={mockOnUpload}
          onError={mockOnError}
          isUploading={false}
        />
      );

      const fileInput = screen.getByRole('button', { name: /select files/i }).querySelector('input[type="file"]') as HTMLInputElement;
      
      const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
      await user.upload(fileInput, file);

      const uploadButton = screen.getByRole('button', { name: /upload/i });
      await user.click(uploadButton);

      expect(mockOnUpload).toHaveBeenCalled();
    });

    it('should disable upload button when no files selected', () => {
      render(
        <MeetingPhotoUploader
          onUpload={mockOnUpload}
          onError={mockOnError}
          isUploading={false}
        />
      );

      const uploadButton = screen.getByRole('button', { name: /upload/i });
      expect(uploadButton).toBeDisabled();
    });

    it('should clear files after successful upload', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <MeetingPhotoUploader
          onUpload={mockOnUpload}
          onError={mockOnError}
          isUploading={false}
        />
      );

      const fileInput = screen.getByRole('button', { name: /select files/i }).querySelector('input[type="file"]') as HTMLInputElement;
      
      const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
      await user.upload(fileInput, file);

      const uploadButton = screen.getByRole('button', { name: /upload/i });
      await user.click(uploadButton);

      // Simulate upload completion
      rerender(
        <MeetingPhotoUploader
          onUpload={mockOnUpload}
          onError={mockOnError}
          isUploading={false}
        />
      );

      // File list should be cleared
      await waitFor(() => {
        expect(screen.queryByText('photo.jpg')).not.toBeInTheDocument();
      });
    });
  });

  describe('Remove File', () => {
    it('should remove file from list', async () => {
      const user = userEvent.setup();
      render(
        <MeetingPhotoUploader
          onUpload={mockOnUpload}
          onError={mockOnError}
          isUploading={false}
        />
      );

      const fileInput = screen.getByRole('button', { name: /select files/i }).querySelector('input[type="file"]') as HTMLInputElement;
      
      const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
      await user.upload(fileInput, file);

      const removeButton = screen.getByRole('button', { name: /remove/i });
      await user.click(removeButton);

      // File should be removed
      await waitFor(() => {
        expect(screen.queryByText('photo.jpg')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <MeetingPhotoUploader
          onUpload={mockOnUpload}
          onError={mockOnError}
          isUploading={false}
        />
      );

      const uploadButton = screen.getByRole('button', { name: /upload/i });
      expect(uploadButton).toHaveAttribute('aria-label');
    });

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      render(
        <MeetingPhotoUploader
          onUpload={mockOnUpload}
          onError={mockOnError}
          isUploading={false}
        />
      );

      // Tab to select button
      await user.keyboard('{Tab}');
      expect(document.activeElement).toHaveRole('button');
    });
  });
});
