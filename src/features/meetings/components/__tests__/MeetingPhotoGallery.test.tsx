import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MeetingPhotoGallery } from '../MeetingPhotoGallery';

/**
 * MeetingPhotoGallery Component Tests
 *
 * Tests for the photo gallery component that displays meeting photos.
 * **Validates: Requirements 34**
 */
describe('MeetingPhotoGallery', () => {
  const mockPhotos = [
    {
      id: 1,
      original_filename: 'photo1.jpg',
      photo_url: 'https://example.com/photo1.jpg',
      thumbnail_url: 'https://example.com/thumb1.jpg',
      file_size: 1024000,
      width: 1920,
      height: 1080,
      uploaded_at: '2025-02-15T10:00:00Z',
    },
    {
      id: 2,
      original_filename: 'photo2.jpg',
      photo_url: 'https://example.com/photo2.jpg',
      thumbnail_url: 'https://example.com/thumb2.jpg',
      file_size: 2048000,
      width: 1920,
      height: 1080,
      uploaded_at: '2025-02-15T11:00:00Z',
    },
  ];

  const mockOnDelete = vi.fn();

  beforeEach(() => {
    mockOnDelete.mockClear();
  });

  describe('Rendering', () => {
    it('should render gallery with photos', () => {
      render(
        <MeetingPhotoGallery
          photos={mockPhotos}
          onDelete={mockOnDelete}
          isLoading={false}
        />
      );

      // Check if photos are displayed
      expect(screen.getByAltText('photo1.jpg')).toBeInTheDocument();
      expect(screen.getByAltText('photo2.jpg')).toBeInTheDocument();
    });

    it('should render empty state when no photos', () => {
      render(
        <MeetingPhotoGallery
          photos={[]}
          onDelete={mockOnDelete}
          isLoading={false}
        />
      );

      expect(screen.getByText(/no photos/i)).toBeInTheDocument();
    });

    it('should render loading state', () => {
      render(
        <MeetingPhotoGallery
          photos={[]}
          onDelete={mockOnDelete}
          isLoading={true}
        />
      );

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should display photo count', () => {
      render(
        <MeetingPhotoGallery
          photos={mockPhotos}
          onDelete={mockOnDelete}
          isLoading={false}
        />
      );

      expect(screen.getByText(/2 photos/i)).toBeInTheDocument();
    });
  });

  describe('Photo Display', () => {
    it('should display thumbnail images', () => {
      render(
        <MeetingPhotoGallery
          photos={mockPhotos}
          onDelete={mockOnDelete}
          isLoading={false}
        />
      );

      const images = screen.getAllByRole('img');
      expect(images.length).toBeGreaterThanOrEqual(2);
    });

    it('should display photo metadata', () => {
      render(
        <MeetingPhotoGallery
          photos={mockPhotos}
          onDelete={mockOnDelete}
          isLoading={false}
        />
      );

      // Check for file size display
      expect(screen.getByText(/1 MB/i)).toBeInTheDocument();
      expect(screen.getByText(/2 MB/i)).toBeInTheDocument();
    });

    it('should display upload date', () => {
      render(
        <MeetingPhotoGallery
          photos={mockPhotos}
          onDelete={mockOnDelete}
          isLoading={false}
        />
      );

      expect(screen.getByText(/2025-02-15/i)).toBeInTheDocument();
    });
  });

  describe('Lightbox/Modal', () => {
    it('should open lightbox when photo is clicked', async () => {
      const user = userEvent.setup();
      render(
        <MeetingPhotoGallery
          photos={mockPhotos}
          onDelete={mockOnDelete}
          isLoading={false}
        />
      );

      const firstPhoto = screen.getByAltText('photo1.jpg');
      await user.click(firstPhoto);

      // Lightbox should be visible
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('should navigate between photos in lightbox', async () => {
      const user = userEvent.setup();
      render(
        <MeetingPhotoGallery
          photos={mockPhotos}
          onDelete={mockOnDelete}
          isLoading={false}
        />
      );

      const firstPhoto = screen.getByAltText('photo1.jpg');
      await user.click(firstPhoto);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Click next button
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      // Should show next photo
      expect(screen.getByAltText('photo2.jpg')).toBeInTheDocument();
    });

    it('should close lightbox when close button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <MeetingPhotoGallery
          photos={mockPhotos}
          onDelete={mockOnDelete}
          isLoading={false}
        />
      );

      const firstPhoto = screen.getByAltText('photo1.jpg');
      await user.click(firstPhoto);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should close lightbox on escape key', async () => {
      const user = userEvent.setup();
      render(
        <MeetingPhotoGallery
          photos={mockPhotos}
          onDelete={mockOnDelete}
          isLoading={false}
        />
      );

      const firstPhoto = screen.getByAltText('photo1.jpg');
      await user.click(firstPhoto);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Delete Functionality', () => {
    it('should show delete button on photo hover', async () => {
      const user = userEvent.setup();
      render(
        <MeetingPhotoGallery
          photos={mockPhotos}
          onDelete={mockOnDelete}
          isLoading={false}
        />
      );

      const firstPhoto = screen.getByAltText('photo1.jpg');
      await user.hover(firstPhoto.closest('[data-photo-item]'));

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      expect(deleteButton).toBeVisible();
    });

    it('should call onDelete when delete button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <MeetingPhotoGallery
          photos={mockPhotos}
          onDelete={mockOnDelete}
          isLoading={false}
        />
      );

      const firstPhoto = screen.getByAltText('photo1.jpg');
      await user.hover(firstPhoto.closest('[data-photo-item]'));

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      expect(mockOnDelete).toHaveBeenCalledWith(1);
    });

    it('should show confirmation dialog before deleting', async () => {
      const user = userEvent.setup();
      render(
        <MeetingPhotoGallery
          photos={mockPhotos}
          onDelete={mockOnDelete}
          isLoading={false}
        />
      );

      const firstPhoto = screen.getByAltText('photo1.jpg');
      await user.hover(firstPhoto.closest('[data-photo-item]'));

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      // Confirmation dialog should appear
      await waitFor(() => {
        expect(screen.getByText(/confirm delete/i)).toBeInTheDocument();
      });
    });

    it('should cancel delete when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <MeetingPhotoGallery
          photos={mockPhotos}
          onDelete={mockOnDelete}
          isLoading={false}
        />
      );

      const firstPhoto = screen.getByAltText('photo1.jpg');
      await user.hover(firstPhoto.closest('[data-photo-item]'));

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText(/confirm delete/i)).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnDelete).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper alt text for images', () => {
      render(
        <MeetingPhotoGallery
          photos={mockPhotos}
          onDelete={mockOnDelete}
          isLoading={false}
        />
      );

      expect(screen.getByAltText('photo1.jpg')).toBeInTheDocument();
      expect(screen.getByAltText('photo2.jpg')).toBeInTheDocument();
    });

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      render(
        <MeetingPhotoGallery
          photos={mockPhotos}
          onDelete={mockOnDelete}
          isLoading={false}
        />
      );

      // Tab through gallery items
      await user.keyboard('{Tab}');
      expect(document.activeElement).toHaveAttribute('data-photo-item');
    });
  });
});
