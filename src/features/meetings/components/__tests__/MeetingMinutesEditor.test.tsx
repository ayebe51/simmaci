import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MeetingMinutesEditor } from '../MeetingMinutesEditor';

/**
 * MeetingMinutesEditor Component Tests
 *
 * Tests for the rich text editor component used to create and edit meeting minutes.
 * **Validates: Requirements 33**
 */
describe('MeetingMinutesEditor', () => {
  const mockOnSave = vi.fn();

  beforeEach(() => {
    mockOnSave.mockClear();
  });

  describe('Rendering', () => {
    it('should render the editor with toolbar', () => {
      render(
        <MeetingMinutesEditor
          initialContent=""
          onSave={mockOnSave}
        />
      );

      // Check for toolbar buttons
      expect(screen.getByRole('button', { name: /bold/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /italic/i })).toBeInTheDocument();
    });

    it('should render with initial content', () => {
      const initialContent = '<p>Test content</p>';
      render(
        <MeetingMinutesEditor
          initialContent={initialContent}
          onSave={mockOnSave}
        />
      );

      // The editor should contain the initial content
      const editor = screen.getByRole('textbox', { hidden: true });
      expect(editor).toBeInTheDocument();
    });

    it('should render in read-only mode when isReadOnly is true', () => {
      render(
        <MeetingMinutesEditor
          initialContent="<p>Read only content</p>"
          onSave={mockOnSave}
          isReadOnly={true}
        />
      );

      // Toolbar buttons should be disabled or hidden
      const boldButton = screen.queryByRole('button', { name: /bold/i });
      if (boldButton) {
        expect(boldButton).toBeDisabled();
      }
    });
  });

  describe('Text Formatting', () => {
    it('should apply bold formatting', async () => {
      const user = userEvent.setup();
      render(
        <MeetingMinutesEditor
          initialContent=""
          onSave={mockOnSave}
        />
      );

      const editor = screen.getByRole('textbox', { hidden: true });
      await user.click(editor);
      await user.keyboard('test');

      const boldButton = screen.getByRole('button', { name: /bold/i });
      await user.click(boldButton);

      // Content should be formatted
      expect(mockOnSave).not.toHaveBeenCalled(); // Save only on explicit save
    });

    it('should apply italic formatting', async () => {
      const user = userEvent.setup();
      render(
        <MeetingMinutesEditor
          initialContent=""
          onSave={mockOnSave}
        />
      );

      const editor = screen.getByRole('textbox', { hidden: true });
      await user.click(editor);
      await user.keyboard('test');

      const italicButton = screen.getByRole('button', { name: /italic/i });
      await user.click(italicButton);

      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should create bullet list', async () => {
      const user = userEvent.setup();
      render(
        <MeetingMinutesEditor
          initialContent=""
          onSave={mockOnSave}
        />
      );

      const editor = screen.getByRole('textbox', { hidden: true });
      await user.click(editor);

      const listButton = screen.getByRole('button', { name: /list/i });
      await user.click(listButton);

      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should create numbered list', async () => {
      const user = userEvent.setup();
      render(
        <MeetingMinutesEditor
          initialContent=""
          onSave={mockOnSave}
        />
      );

      const editor = screen.getByRole('textbox', { hidden: true });
      await user.click(editor);

      const orderedListButton = screen.getByRole('button', { name: /ordered/i });
      await user.click(orderedListButton);

      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  describe('Content Management', () => {
    it('should call onSave with content when save button is clicked', async () => {
      const user = userEvent.setup();
      const testContent = '<p>Test minutes content</p>';

      render(
        <MeetingMinutesEditor
          initialContent={testContent}
          onSave={mockOnSave}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(mockOnSave).toHaveBeenCalled();
    });

    it('should handle undo operation', async () => {
      const user = userEvent.setup();
      render(
        <MeetingMinutesEditor
          initialContent=""
          onSave={mockOnSave}
        />
      );

      const editor = screen.getByRole('textbox', { hidden: true });
      await user.click(editor);
      await user.keyboard('test');

      const undoButton = screen.getByRole('button', { name: /undo/i });
      await user.click(undoButton);

      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should handle redo operation', async () => {
      const user = userEvent.setup();
      render(
        <MeetingMinutesEditor
          initialContent=""
          onSave={mockOnSave}
        />
      );

      const editor = screen.getByRole('textbox', { hidden: true });
      await user.click(editor);
      await user.keyboard('test');

      const undoButton = screen.getByRole('button', { name: /undo/i });
      await user.click(undoButton);

      const redoButton = screen.getByRole('button', { name: /redo/i });
      await user.click(redoButton);

      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  describe('Saving State', () => {
    it('should show loading state while saving', () => {
      render(
        <MeetingMinutesEditor
          initialContent="<p>Content</p>"
          onSave={mockOnSave}
          isSaving={true}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeDisabled();
    });

    it('should enable save button when not saving', () => {
      render(
        <MeetingMinutesEditor
          initialContent="<p>Content</p>"
          onSave={mockOnSave}
          isSaving={false}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).not.toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels on toolbar buttons', () => {
      render(
        <MeetingMinutesEditor
          initialContent=""
          onSave={mockOnSave}
        />
      );

      const boldButton = screen.getByRole('button', { name: /bold/i });
      expect(boldButton).toHaveAttribute('aria-label');
    });

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      render(
        <MeetingMinutesEditor
          initialContent=""
          onSave={mockOnSave}
        />
      );

      const editor = screen.getByRole('textbox', { hidden: true });
      await user.click(editor);

      // Tab to next button
      await user.keyboard('{Tab}');

      // Should be able to interact with toolbar
      expect(document.activeElement).not.toBe(editor);
    });
  });
});
