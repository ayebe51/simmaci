// Feature: performance-optimization, Task 10.4
// Validates: Requirements 9.3, 9.4

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SkeletonPage from './SkeletonPage';
import { ChunkErrorBoundary } from './ChunkErrorBoundary';

describe('SkeletonPage', () => {
  it('renders without any JS library dependencies (pure CSS skeleton)', () => {
    const { container } = render(<SkeletonPage />);

    // Should render the skeleton structure
    expect(container.firstChild).toBeInTheDocument();

    // Should use animate-pulse (Tailwind CSS-only animation)
    const pulsingElements = container.querySelectorAll('.animate-pulse');
    expect(pulsingElements.length).toBeGreaterThan(0);
  });

  it('renders sidebar, header, and main content skeleton areas', () => {
    const { container } = render(<SkeletonPage />);

    // Sidebar
    const sidebar = container.querySelector('aside');
    expect(sidebar).toBeInTheDocument();

    // Header
    const header = container.querySelector('header');
    expect(header).toBeInTheDocument();

    // Main content
    const main = container.querySelector('main');
    expect(main).toBeInTheDocument();
  });

  it('uses only CSS classes for animation (no JS animation libraries)', () => {
    const { container } = render(<SkeletonPage />);

    // All animated elements should use Tailwind's animate-pulse class
    const pulsingElements = container.querySelectorAll('.animate-pulse');
    expect(pulsingElements.length).toBeGreaterThan(5);

    // No framer-motion or other JS animation wrappers
    const motionElements = container.querySelectorAll('[data-framer-component-type]');
    expect(motionElements.length).toBe(0);
  });
});

describe('ChunkErrorBoundary', () => {
  // Suppress console.error from error boundary during tests
  const originalConsoleError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });
  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('renders children when no error occurs', () => {
    render(
      <ChunkErrorBoundary>
        <div data-testid="child">Hello</div>
      </ChunkErrorBoundary>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('shows retry button when a ChunkLoadError occurs', () => {
    const ChunkLoadErrorThrower = () => {
      const error = new Error('Loading chunk abc123 failed');
      error.name = 'ChunkLoadError';
      throw error;
    };

    render(
      <ChunkErrorBoundary>
        <ChunkLoadErrorThrower />
      </ChunkErrorBoundary>
    );

    // Should show error message
    expect(screen.getByText('Gagal memuat halaman')).toBeInTheDocument();

    // Should show retry button
    expect(screen.getByRole('button', { name: /coba lagi/i })).toBeInTheDocument();
  });

  it('shows retry button when "Failed to fetch dynamically imported module" error occurs', () => {
    const DynamicImportErrorThrower = () => {
      throw new Error('Failed to fetch dynamically imported module: /assets/page-abc123.js');
    };

    render(
      <ChunkErrorBoundary>
        <DynamicImportErrorThrower />
      </ChunkErrorBoundary>
    );

    expect(screen.getByText('Gagal memuat halaman')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /coba lagi/i })).toBeInTheDocument();
  });

  it('re-attempts the dynamic import when retry button is clicked (clears error state)', () => {
    let shouldThrow = true;

    const ConditionalThrower = () => {
      if (shouldThrow) {
        const error = new Error('Loading chunk failed');
        error.name = 'ChunkLoadError';
        throw error;
      }
      return <div data-testid="recovered">Loaded successfully</div>;
    };

    const { rerender } = render(
      <ChunkErrorBoundary>
        <ConditionalThrower />
      </ChunkErrorBoundary>
    );

    // Should be in error state
    expect(screen.getByText('Gagal memuat halaman')).toBeInTheDocument();

    // Fix the error condition before retrying
    shouldThrow = false;

    // Click retry
    fireEvent.click(screen.getByRole('button', { name: /coba lagi/i }));

    // After retry, the error boundary clears its state and re-renders children
    // Since shouldThrow is now false, the child should render successfully
    expect(screen.getByTestId('recovered')).toBeInTheDocument();
    expect(screen.getByText('Loaded successfully')).toBeInTheDocument();
  });

  it('re-throws non-chunk errors to parent boundaries', () => {
    const NonChunkErrorThrower = () => {
      throw new Error('Some random error');
    };

    // Non-chunk errors should propagate up (not caught by ChunkErrorBoundary)
    expect(() => {
      render(
        <ChunkErrorBoundary>
          <NonChunkErrorThrower />
        </ChunkErrorBoundary>
      );
    }).toThrow('Some random error');
  });
});
