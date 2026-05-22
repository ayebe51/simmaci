// Feature: student-statistics-per-jenjang, Task 7.8

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorFallback } from './ErrorFallback';

// Validates: Requirements 1.7, 1.8, 7.2

describe('ErrorFallback', () => {
  it('renders default error message "Data statistik tidak tersedia"', () => {
    render(<ErrorFallback />);

    expect(screen.getByText('Data statistik tidak tersedia')).toBeInTheDocument();
  });

  it('renders custom error message when provided', () => {
    render(<ErrorFallback message="Gagal memuat data" />);

    expect(screen.getByText('Gagal memuat data')).toBeInTheDocument();
    expect(screen.queryByText('Data statistik tidak tersedia')).not.toBeInTheDocument();
  });

  it('renders retry button when onRetry is provided', () => {
    render(<ErrorFallback onRetry={vi.fn()} />);

    expect(screen.getByRole('button', { name: /coba lagi/i })).toBeInTheDocument();
  });

  it('does not render retry button when onRetry is not provided', () => {
    render(<ErrorFallback />);

    expect(screen.queryByRole('button', { name: /coba lagi/i })).not.toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = vi.fn();
    render(<ErrorFallback onRetry={onRetry} />);

    fireEvent.click(screen.getByRole('button', { name: /coba lagi/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders AlertTriangle icon', () => {
    const { container } = render(<ErrorFallback />);

    // lucide-react renders SVGs with the class matching the icon name
    const svg = container.querySelector('svg.lucide-triangle-alert');
    expect(svg).toBeInTheDocument();
  });
});
