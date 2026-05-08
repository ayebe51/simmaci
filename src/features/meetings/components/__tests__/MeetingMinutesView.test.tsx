import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MeetingMinutesView } from '../MeetingMinutesView';

/**
 * MeetingMinutesView Component Tests
 *
 * Tests for the read-only minutes view component.
 * **Validates: Requirements 33**
 */
describe('MeetingMinutesView', () => {
  const mockMinutes = {
    id: 1,
    meeting_id: 1,
    title: 'Notulensi Rapat Koordinasi',
    content: '<h2>Hasil Rapat</h2><p>Pembahasan program semester genap</p><ul><li>Item 1</li><li>Item 2</li></ul>',
    created_by: 1,
    created_at: '2025-02-15T10:00:00Z',
    updated_at: '2025-02-15T10:00:00Z',
    creator: {
      id: 1,
      name: 'Admin User',
    },
    updater: null,
  };

  describe('Rendering', () => {
    it('should render minutes title', () => {
      render(
        <MeetingMinutesView
          minutes={mockMinutes}
          isLoading={false}
        />
      );

      expect(screen.getByText('Notulensi Rapat Koordinasi')).toBeInTheDocument();
    });

    it('should render minutes content', () => {
      render(
        <MeetingMinutesView
          minutes={mockMinutes}
          isLoading={false}
        />
      );

      expect(screen.getByText('Hasil Rapat')).toBeInTheDocument();
      expect(screen.getByText('Pembahasan program semester genap')).toBeInTheDocument();
    });

    it('should render creator information', () => {
      render(
        <MeetingMinutesView
          minutes={mockMinutes}
          isLoading={false}
        />
      );

      expect(screen.getByText(/Admin User/)).toBeInTheDocument();
      expect(screen.getByText(/2025-02-15/)).toBeInTheDocument();
    });

    it('should render loading state', () => {
      render(
        <MeetingMinutesView
          minutes={null}
          isLoading={true}
        />
      );

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should render empty state when no minutes', () => {
      render(
        <MeetingMinutesView
          minutes={null}
          isLoading={false}
        />
      );

      expect(screen.getByText(/no minutes/i)).toBeInTheDocument();
    });
  });

  describe('Content Rendering', () => {
    it('should render HTML content safely', () => {
      const minutesWithHTML = {
        ...mockMinutes,
        content: '<h2>Heading</h2><p>Paragraph with <strong>bold</strong> text</p>',
      };

      render(
        <MeetingMinutesView
          minutes={minutesWithHTML}
          isLoading={false}
        />
      );

      expect(screen.getByText('Heading')).toBeInTheDocument();
      expect(screen.getByText(/Paragraph with/)).toBeInTheDocument();
      expect(screen.getByText('bold')).toBeInTheDocument();
    });

    it('should render lists correctly', () => {
      const minutesWithLists = {
        ...mockMinutes,
        content: '<ul><li>Item 1</li><li>Item 2</li></ul><ol><li>First</li><li>Second</li></ol>',
      };

      render(
        <MeetingMinutesView
          minutes={minutesWithLists}
          isLoading={false}
        />
      );

      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
      expect(screen.getByText('First')).toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
    });

    it('should render links safely', () => {
      const minutesWithLinks = {
        ...mockMinutes,
        content: '<p>Visit <a href="https://example.com">our website</a></p>',
      };

      render(
        <MeetingMinutesView
          minutes={minutesWithLinks}
          isLoading={false}
        />
      );

      const link = screen.getByRole('link', { name: /our website/i });
      expect(link).toHaveAttribute('href', 'https://example.com');
    });
  });

  describe('Metadata Display', () => {
    it('should display creation date and creator', () => {
      render(
        <MeetingMinutesView
          minutes={mockMinutes}
          isLoading={false}
        />
      );

      expect(screen.getByText(/Created by/i)).toBeInTheDocument();
      expect(screen.getByText(/Admin User/)).toBeInTheDocument();
    });

    it('should display update information when available', () => {
      const updatedMinutes = {
        ...mockMinutes,
        updated_at: '2025-02-15T15:00:00Z',
        updater: {
          id: 2,
          name: 'Editor User',
        },
      };

      render(
        <MeetingMinutesView
          minutes={updatedMinutes}
          isLoading={false}
        />
      );

      expect(screen.getByText(/Last updated by/i)).toBeInTheDocument();
      expect(screen.getByText(/Editor User/)).toBeInTheDocument();
    });

    it('should not display update information when not available', () => {
      render(
        <MeetingMinutesView
          minutes={mockMinutes}
          isLoading={false}
        />
      );

      expect(screen.queryByText(/Last updated/i)).not.toBeInTheDocument();
    });
  });

  describe('Print Functionality', () => {
    it('should have print button', () => {
      render(
        <MeetingMinutesView
          minutes={mockMinutes}
          isLoading={false}
        />
      );

      expect(screen.getByRole('button', { name: /print/i })).toBeInTheDocument();
    });

    it('should trigger print dialog when print button is clicked', () => {
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

      render(
        <MeetingMinutesView
          minutes={mockMinutes}
          isLoading={false}
        />
      );

      const printButton = screen.getByRole('button', { name: /print/i });
      printButton.click();

      expect(printSpy).toHaveBeenCalled();
      printSpy.mockRestore();
    });
  });

  describe('Download Functionality', () => {
    it('should have download button', () => {
      render(
        <MeetingMinutesView
          minutes={mockMinutes}
          isLoading={false}
        />
      );

      expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      render(
        <MeetingMinutesView
          minutes={mockMinutes}
          isLoading={false}
        />
      );

      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
    });

    it('should have semantic HTML structure', () => {
      render(
        <MeetingMinutesView
          minutes={mockMinutes}
          isLoading={false}
        />
      );

      // Check for article or section element
      const article = screen.getByRole('article', { hidden: true });
      expect(article).toBeInTheDocument();
    });

    it('should have proper ARIA labels on buttons', () => {
      render(
        <MeetingMinutesView
          minutes={mockMinutes}
          isLoading={false}
        />
      );

      const printButton = screen.getByRole('button', { name: /print/i });
      expect(printButton).toHaveAttribute('aria-label');
    });
  });

  describe('Responsive Design', () => {
    it('should render content in readable format', () => {
      render(
        <MeetingMinutesView
          minutes={mockMinutes}
          isLoading={false}
        />
      );

      const content = screen.getByText('Pembahasan program semester genap');
      expect(content).toBeInTheDocument();
      
      // Check if content has proper spacing/formatting
      const container = content.closest('[data-minutes-content]');
      expect(container).toHaveClass('prose');
    });
  });
});
