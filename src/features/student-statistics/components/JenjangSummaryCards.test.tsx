// Feature: student-statistics-per-jenjang, Task 5.1

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JenjangSummaryCards } from './JenjangSummaryCards';
import type { JenjangSummaryResponse } from '@/features/student-statistics/services/studentStatisticsApi';

// ── Fixtures ──

const mockData: JenjangSummaryResponse = {
  categories: [
    { jenjang: 'RA', jumlah_siswa: 450, persentase: 12 },
    { jenjang: 'MI', jumlah_siswa: 1200, persentase: 32 },
    { jenjang: 'MTs', jumlah_siswa: 1100, persentase: 29 },
    { jenjang: 'MA', jumlah_siswa: 800, persentase: 21 },
    { jenjang: 'Tidak Terdefinisi', jumlah_siswa: 150, persentase: 4 },
    { jenjang: 'Lainnya', jumlah_siswa: 50, persentase: 1 },
  ],
  total: 3750,
};

const mockDataWithZeros: JenjangSummaryResponse = {
  categories: [
    { jenjang: 'RA', jumlah_siswa: 0, persentase: 0 },
    { jenjang: 'MI', jumlah_siswa: 100, persentase: 100 },
    { jenjang: 'MTs', jumlah_siswa: 0, persentase: 0 },
    { jenjang: 'MA', jumlah_siswa: 0, persentase: 0 },
    { jenjang: 'Tidak Terdefinisi', jumlah_siswa: 0, persentase: 0 },
    { jenjang: 'Lainnya', jumlah_siswa: 0, persentase: 0 },
  ],
  total: 100,
};

// ── Tests ──

describe('JenjangSummaryCards', () => {
  it('renders nothing when data is undefined', () => {
    const { container } = render(
      <JenjangSummaryCards data={undefined} onSelectJenjang={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders all 6 jenjang categories', () => {
    render(<JenjangSummaryCards data={mockData} onSelectJenjang={vi.fn()} />);

    expect(screen.getByText('RA')).toBeInTheDocument();
    expect(screen.getByText('MI')).toBeInTheDocument();
    expect(screen.getByText('MTs')).toBeInTheDocument();
    expect(screen.getByText('MA')).toBeInTheDocument();
    expect(screen.getByText('Tidak Terdefinisi')).toBeInTheDocument();
    expect(screen.getByText('Lainnya')).toBeInTheDocument();
  });

  it('displays correct student counts for each category', () => {
    render(<JenjangSummaryCards data={mockData} onSelectJenjang={vi.fn()} />);

    // Indonesian locale uses dot as thousands separator
    expect(screen.getByText('450')).toBeInTheDocument();
    expect(screen.getByText('1.200')).toBeInTheDocument();
    expect(screen.getByText('1.100')).toBeInTheDocument();
    expect(screen.getByText('800')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('displays correct percentages for each category', () => {
    render(<JenjangSummaryCards data={mockData} onSelectJenjang={vi.fn()} />);

    expect(screen.getByText('12% dari total')).toBeInTheDocument();
    expect(screen.getByText('32% dari total')).toBeInTheDocument();
    expect(screen.getByText('29% dari total')).toBeInTheDocument();
    expect(screen.getByText('21% dari total')).toBeInTheDocument();
    expect(screen.getByText('4% dari total')).toBeInTheDocument();
    expect(screen.getByText('1% dari total')).toBeInTheDocument();
  });

  it('displays total student count', () => {
    render(<JenjangSummaryCards data={mockData} onSelectJenjang={vi.fn()} />);

    expect(screen.getByText('3.750')).toBeInTheDocument();
    expect(screen.getByText('Total Siswa Aktif')).toBeInTheDocument();
  });

  it('displays 0 count and 0% for categories with no students', () => {
    render(<JenjangSummaryCards data={mockDataWithZeros} onSelectJenjang={vi.fn()} />);

    // Multiple cards should show 0 and 0%
    const zeroElements = screen.getAllByText('0');
    expect(zeroElements.length).toBeGreaterThanOrEqual(4);

    const zeroPercentElements = screen.getAllByText('0% dari total');
    expect(zeroPercentElements.length).toBeGreaterThanOrEqual(4);
  });

  it('calls onSelectJenjang when a card is clicked', () => {
    const onSelectJenjang = vi.fn();
    render(<JenjangSummaryCards data={mockData} onSelectJenjang={onSelectJenjang} />);

    const miCard = screen.getByLabelText(/Lihat detail MI/);
    fireEvent.click(miCard);

    expect(onSelectJenjang).toHaveBeenCalledWith('MI');
    expect(onSelectJenjang).toHaveBeenCalledTimes(1);
  });

  it('calls onSelectJenjang when Enter key is pressed on a card', () => {
    const onSelectJenjang = vi.fn();
    render(<JenjangSummaryCards data={mockData} onSelectJenjang={onSelectJenjang} />);

    const raCard = screen.getByLabelText(/Lihat detail RA/);
    fireEvent.keyDown(raCard, { key: 'Enter' });

    expect(onSelectJenjang).toHaveBeenCalledWith('RA');
  });

  it('calls onSelectJenjang when Space key is pressed on a card', () => {
    const onSelectJenjang = vi.fn();
    render(<JenjangSummaryCards data={mockData} onSelectJenjang={onSelectJenjang} />);

    const mtsCard = screen.getByLabelText(/Lihat detail MTs/);
    fireEvent.keyDown(mtsCard, { key: ' ' });

    expect(onSelectJenjang).toHaveBeenCalledWith('MTs');
  });

  it('renders cards with correct aria-labels for accessibility', () => {
    render(<JenjangSummaryCards data={mockData} onSelectJenjang={vi.fn()} />);

    expect(screen.getByLabelText('Lihat detail RA: 450 siswa (12%)')).toBeInTheDocument();
    expect(screen.getByLabelText('Lihat detail MI: 1200 siswa (32%)')).toBeInTheDocument();
    expect(screen.getByLabelText('Lihat detail MTs: 1100 siswa (29%)')).toBeInTheDocument();
    expect(screen.getByLabelText('Lihat detail MA: 800 siswa (21%)')).toBeInTheDocument();
    expect(screen.getByLabelText('Lihat detail Tidak Terdefinisi: 150 siswa (4%)')).toBeInTheDocument();
    expect(screen.getByLabelText('Lihat detail Lainnya: 50 siswa (1%)')).toBeInTheDocument();
  });

  it('renders cards with role="button" for accessibility', () => {
    render(<JenjangSummaryCards data={mockData} onSelectJenjang={vi.fn()} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(6);
  });
});
