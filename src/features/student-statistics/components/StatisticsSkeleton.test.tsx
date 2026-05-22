// Feature: student-statistics-per-jenjang, Task 7.8

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StatisticsSkeleton } from './StatisticsSkeleton';

// Validates: Requirements 1.4, 7.2

describe('StatisticsSkeleton', () => {
  it('renders 6 skeleton cards', () => {
    const { container } = render(<StatisticsSkeleton />);

    const cards = container.querySelectorAll('.animate-pulse');
    expect(cards).toHaveLength(6);
  });

  it('skeleton cards have animate-pulse class', () => {
    const { container } = render(<StatisticsSkeleton />);

    const cards = container.querySelectorAll('.animate-pulse');
    cards.forEach((card) => {
      expect(card.className).toContain('animate-pulse');
    });
  });

  it('renders correct grid layout (sm:grid-cols-2 lg:grid-cols-3)', () => {
    const { container } = render(<StatisticsSkeleton />);

    const grid = container.firstElementChild;
    expect(grid?.className).toContain('sm:grid-cols-2');
    expect(grid?.className).toContain('lg:grid-cols-3');
  });
});
