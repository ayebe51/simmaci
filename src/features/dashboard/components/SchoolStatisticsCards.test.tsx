// Feature: dashboard-school-statistics, Task 5.5

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SchoolStatisticsCards } from './SchoolStatisticsCards';
import { dashboardApi } from '@/services/dashboardApi';
import type { SchoolStatisticsData } from '@/services/dashboardApi';

// ── Mock API ──────────────────────────────────────────────────────────────

vi.mock('@/services/dashboardApi', () => ({
  dashboardApi: {
    getSchoolStatistics: vi.fn(),
  },
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────

const mockStatisticsData: SchoolStatisticsData = {
  affiliation: {
    jamaah: 150,
    jamiyyah: 40,
    undefined: 0,
  },
  jenjang: {
    mi_sd: 80,
    mts_smp: 60,
    ma_sma_smk: 50,
    lainnya: 0,
    undefined: 0,
  },
  total: 190,
};

const mockStatisticsWithZeros: SchoolStatisticsData = {
  affiliation: {
    jamaah: 100,
    jamiyyah: 0,
    undefined: 0,
  },
  jenjang: {
    mi_sd: 50,
    mts_smp: 30,
    ma_sma_smk: 20,
    lainnya: 0,
    undefined: 0,
  },
  total: 100,
};

const mockEmptyStatistics: SchoolStatisticsData = {
  affiliation: {
    jamaah: 0,
    jamiyyah: 0,
    undefined: 0,
  },
  jenjang: {
    mi_sd: 0,
    mts_smp: 0,
    ma_sma_smk: 0,
    lainnya: 0,
    undefined: 0,
  },
  total: 0,
};

// ── Helpers ───────────────────────────────────────────────────────────────

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

function renderWithQueryClient(component: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('SchoolStatisticsCards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Loading State ──────────────────────────────────────────────────

  describe('1. Loading State', () => {
    it('renders loading state with skeleton loaders', async () => {
      // Mock API to never resolve (keeps loading state)
      vi.mocked(dashboardApi.getSchoolStatistics).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderWithQueryClient(<SchoolStatisticsCards />);

      // Should show skeleton loaders
      const skeletons = screen.getAllByRole('generic').filter(
        (el) => el.className.includes('animate-pulse')
      );
      expect(skeletons.length).toBeGreaterThan(0);

      // Should show two card containers (for affiliation and jenjang)
      const cards = screen.getAllByRole('generic').filter(
        (el) => el.className.includes('rounded-2xl')
      );
      expect(cards.length).toBeGreaterThanOrEqual(2);
    });

    it('shows skeleton with correct structure for affiliation card', async () => {
      vi.mocked(dashboardApi.getSchoolStatistics).mockImplementation(
        () => new Promise(() => {})
      );

      renderWithQueryClient(<SchoolStatisticsCards />);

      // Should have skeleton elements
      const skeletons = screen.getAllByRole('generic').filter(
        (el) => el.className.includes('bg-slate-200') || el.className.includes('bg-slate-100')
      );
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  // ── 2. Affiliation Statistics ─────────────────────────────────────────

  describe('2. Affiliation Statistics', () => {
    it('renders affiliation statistics with correct counts', async () => {
      vi.mocked(dashboardApi.getSchoolStatistics).mockResolvedValue(mockStatisticsData);

      renderWithQueryClient(<SchoolStatisticsCards />);

      await waitFor(() => {
        expect(screen.getByText('Statistik Afiliasi Sekolah')).toBeInTheDocument();
      });

      // Check counts are displayed
      expect(screen.getByText(/150/)).toBeInTheDocument(); // Jamaah count
      expect(screen.getByText(/40/)).toBeInTheDocument(); // Jamiyyah count
    });

    it('renders affiliation statistics with correct percentages', async () => {
      vi.mocked(dashboardApi.getSchoolStatistics).mockResolvedValue(mockStatisticsData);

      renderWithQueryClient(<SchoolStatisticsCards />);

      await waitFor(() => {
        expect(screen.getByText('Statistik Afiliasi Sekolah')).toBeInTheDocument();
      });

      // Jamaah: 150/190 = 78.9% → rounds to 79%
      expect(screen.getByText(/150 \(79%\)/)).toBeInTheDocument();
      
      // Jamiyyah: 40/190 = 21.05% → rounds to 21%
      expect(screen.getByText(/40 \(21%\)/)).toBeInTheDocument();
      
      // Undefined: 0/190 = 0%
      const zeroPercentages = screen.getAllByText(/0 \(0%\)/);
      expect(zeroPercentages.length).toBeGreaterThanOrEqual(1); // At least one 0 (0%)
    });

    it('displays total count for affiliation', async () => {
      vi.mocked(dashboardApi.getSchoolStatistics).mockResolvedValue(mockStatisticsData);

      renderWithQueryClient(<SchoolStatisticsCards />);

      await waitFor(() => {
        expect(screen.getByText('Statistik Afiliasi Sekolah')).toBeInTheDocument();
      });

      // Should have two "190 sekolah" texts (one for affiliation, one for jenjang)
      const totalTexts = screen.getAllByText(/190 sekolah/);
      expect(totalTexts.length).toBe(2);
    });

    it('renders all affiliation category labels', async () => {
      vi.mocked(dashboardApi.getSchoolStatistics).mockResolvedValue(mockStatisticsData);

      renderWithQueryClient(<SchoolStatisticsCards />);

      await waitFor(() => {
        expect(screen.getByText('Statistik Afiliasi Sekolah')).toBeInTheDocument();
      });

      expect(screen.getByText("Jama'ah / Afiliasi")).toBeInTheDocument();
      expect(screen.getByText("Jam'iyyah")).toBeInTheDocument();
      // "Tidak Terdefinisi" appears in both cards, so use getAllByText
      const undefinedLabels = screen.getAllByText('Tidak Terdefinisi');
      expect(undefinedLabels.length).toBe(2);
    });
  });

  // ── 3. Jenjang Statistics ─────────────────────────────────────────────

  describe('3. Jenjang Statistics', () => {
    it('renders jenjang statistics with correct counts', async () => {
      vi.mocked(dashboardApi.getSchoolStatistics).mockResolvedValue(mockStatisticsData);

      renderWithQueryClient(<SchoolStatisticsCards />);

      await waitFor(() => {
        expect(screen.getByText('Statistik Jenjang Pendidikan')).toBeInTheDocument();
      });

      // Check counts are displayed with percentages to be more specific
      expect(screen.getByText(/80 \(42%\)/)).toBeInTheDocument(); // MI/SD count
      expect(screen.getByText(/60 \(32%\)/)).toBeInTheDocument(); // MTs/SMP count
      expect(screen.getByText(/50 \(26%\)/)).toBeInTheDocument(); // MA/SMA/SMK count
    });

    it('renders jenjang statistics with correct percentages', async () => {
      vi.mocked(dashboardApi.getSchoolStatistics).mockResolvedValue(mockStatisticsData);

      renderWithQueryClient(<SchoolStatisticsCards />);

      await waitFor(() => {
        expect(screen.getByText('Statistik Jenjang Pendidikan')).toBeInTheDocument();
      });

      // MI/SD: 80/190 = 42.1% → rounds to 42%
      expect(screen.getByText(/80 \(42%\)/)).toBeInTheDocument();
      
      // MTs/SMP: 60/190 = 31.6% → rounds to 32%
      expect(screen.getByText(/60 \(32%\)/)).toBeInTheDocument();
      
      // MA/SMA/SMK: 50/190 = 26.3% → rounds to 26%
      expect(screen.getByText(/50 \(26%\)/)).toBeInTheDocument();
    });

    it('displays total count for jenjang', async () => {
      vi.mocked(dashboardApi.getSchoolStatistics).mockResolvedValue(mockStatisticsData);

      renderWithQueryClient(<SchoolStatisticsCards />);

      await waitFor(() => {
        expect(screen.getByText('Statistik Jenjang Pendidikan')).toBeInTheDocument();
      });

      // Should have two "190 sekolah" texts (one for affiliation, one for jenjang)
      const totalTexts = screen.getAllByText(/190 sekolah/);
      expect(totalTexts.length).toBe(2);
    });

    it('renders all jenjang category labels', async () => {
      vi.mocked(dashboardApi.getSchoolStatistics).mockResolvedValue(mockStatisticsData);

      renderWithQueryClient(<SchoolStatisticsCards />);

      await waitFor(() => {
        expect(screen.getByText('Statistik Jenjang Pendidikan')).toBeInTheDocument();
      });

      expect(screen.getByText('MI / SD')).toBeInTheDocument();
      expect(screen.getByText('MTs / SMP')).toBeInTheDocument();
      expect(screen.getByText('MA / SMA / SMK')).toBeInTheDocument();
      expect(screen.getByText('Lainnya')).toBeInTheDocument();
      // "Tidak Terdefinisi" appears in both cards
      const undefinedLabels = screen.getAllByText('Tidak Terdefinisi');
      expect(undefinedLabels.length).toBe(2);
    });
  });

  // ── 4. Zero Values Handling ───────────────────────────────────────────

  describe('4. Zero Values Handling', () => {
    it('displays "0 (0%)" for zero values in affiliation', async () => {
      vi.mocked(dashboardApi.getSchoolStatistics).mockResolvedValue(mockStatisticsWithZeros);

      renderWithQueryClient(<SchoolStatisticsCards />);

      await waitFor(() => {
        expect(screen.getByText('Statistik Afiliasi Sekolah')).toBeInTheDocument();
      });

      // Jamiyyah and Undefined should show 0 (0%)
      const zeroTexts = screen.getAllByText(/0 \(0%\)/);
      expect(zeroTexts.length).toBeGreaterThanOrEqual(2);
    });

    it('displays "0 (0%)" for zero values in jenjang', async () => {
      vi.mocked(dashboardApi.getSchoolStatistics).mockResolvedValue(mockStatisticsWithZeros);

      renderWithQueryClient(<SchoolStatisticsCards />);

      await waitFor(() => {
        expect(screen.getByText('Statistik Jenjang Pendidikan')).toBeInTheDocument();
      });

      // Lainnya and Undefined should show 0 (0%)
      const zeroTexts = screen.getAllByText(/0 \(0%\)/);
      expect(zeroTexts.length).toBeGreaterThanOrEqual(2);
    });

    it('handles all zero values correctly', async () => {
      vi.mocked(dashboardApi.getSchoolStatistics).mockResolvedValue(mockEmptyStatistics);

      renderWithQueryClient(<SchoolStatisticsCards />);

      await waitFor(() => {
        expect(screen.getByText('Statistik Afiliasi Sekolah')).toBeInTheDocument();
      });

      // All categories should show 0 (0%)
      const zeroTexts = screen.getAllByText(/0 \(0%\)/);
      expect(zeroTexts.length).toBeGreaterThanOrEqual(8); // 3 affiliation + 5 jenjang
    });
  });

  // ── 5. Percentage Calculation Accuracy ────────────────────────────────

  describe('5. Percentage Calculation Accuracy', () => {
    it('calculates percentages accurately with rounding', async () => {
      const testData: SchoolStatisticsData = {
        affiliation: {
          jamaah: 33, // 33/100 = 33%
          jamiyyah: 33, // 33/100 = 33%
          undefined: 34, // 34/100 = 34%
        },
        jenjang: {
          mi_sd: 25, // 25/100 = 25%
          mts_smp: 25, // 25/100 = 25%
          ma_sma_smk: 25, // 25/100 = 25%
          lainnya: 15, // 15/100 = 15%
          undefined: 10, // 10/100 = 10%
        },
        total: 100,
      };

      vi.mocked(dashboardApi.getSchoolStatistics).mockResolvedValue(testData);

      renderWithQueryClient(<SchoolStatisticsCards />);

      await waitFor(() => {
        expect(screen.getByText('Statistik Afiliasi Sekolah')).toBeInTheDocument();
      });

      // Check exact percentages - use getAllByText for duplicates
      const percentages33 = screen.getAllByText(/33 \(33%\)/);
      expect(percentages33.length).toBe(2); // Two categories with 33%
      
      expect(screen.getByText(/34 \(34%\)/)).toBeInTheDocument();
      
      const percentages25 = screen.getAllByText(/25 \(25%\)/);
      expect(percentages25.length).toBe(3); // Three categories with 25%
      
      expect(screen.getByText(/15 \(15%\)/)).toBeInTheDocument();
      expect(screen.getByText(/10 \(10%\)/)).toBeInTheDocument();
    });

    it('rounds percentages correctly (Math.round)', async () => {
      const testData: SchoolStatisticsData = {
        affiliation: {
          jamaah: 1, // 1/6 = 16.67% → rounds to 17%
          jamiyyah: 2, // 2/6 = 33.33% → rounds to 33%
          undefined: 3, // 3/6 = 50%
        },
        jenjang: {
          mi_sd: 2, // 2/6 = 33.33% → rounds to 33%
          mts_smp: 2, // 2/6 = 33.33% → rounds to 33%
          ma_sma_smk: 2, // 2/6 = 33.33% → rounds to 33%
          lainnya: 1, // 1/6 = 16.67% → rounds to 17%
          undefined: 0, // 0/6 = 0%
        },
        total: 6,
      };

      vi.mocked(dashboardApi.getSchoolStatistics).mockResolvedValue(testData);

      renderWithQueryClient(<SchoolStatisticsCards />);

      await waitFor(() => {
        expect(screen.getByText('Statistik Afiliasi Sekolah')).toBeInTheDocument();
      });

      // Check rounded percentages for affiliation
      const percentages17 = screen.getAllByText(/1 \(17%\)/);
      expect(percentages17.length).toBeGreaterThanOrEqual(1); // At least one 17%
      
      const percentages33Affiliation = screen.getAllByText(/2 \(33%\)/);
      expect(percentages33Affiliation.length).toBeGreaterThanOrEqual(1); // At least one 33%
      
      expect(screen.getByText(/3 \(50%\)/)).toBeInTheDocument();
      
      // Check rounded percentages for jenjang - all three categories have 2 (33%)
      const percentages33Jenjang = screen.getAllByText(/2 \(33%\)/);
      expect(percentages33Jenjang.length).toBeGreaterThanOrEqual(3); // At least three 33%
      
      const percentages17Jenjang = screen.getAllByText(/1 \(17%\)/);
      expect(percentages17Jenjang.length).toBeGreaterThanOrEqual(1); // At least one 17%
    });

    it('handles division by zero (total = 0) gracefully', async () => {
      vi.mocked(dashboardApi.getSchoolStatistics).mockResolvedValue(mockEmptyStatistics);

      renderWithQueryClient(<SchoolStatisticsCards />);

      await waitFor(() => {
        expect(screen.getByText('Statistik Afiliasi Sekolah')).toBeInTheDocument();
      });

      // All should show 0 (0%) without errors
      const zeroTexts = screen.getAllByText(/0 \(0%\)/);
      expect(zeroTexts.length).toBeGreaterThanOrEqual(8);
    });
  });

  // ── 6. Error Handling ─────────────────────────────────────────────────

  describe('6. Error Handling', () => {
    it('shows error fallback when API request fails', async () => {
      // Mock console.error to avoid noise in test output
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      vi.mocked(dashboardApi.getSchoolStatistics).mockRejectedValue(
        new Error('Network error')
      );

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false, // Disable retry for error test
            gcTime: 0,
          },
        },
      });

      render(
        <QueryClientProvider client={queryClient}>
          <SchoolStatisticsCards />
        </QueryClientProvider>
      );

      // Wait for error state to appear after loading
      await waitFor(() => {
        const errorMessages = screen.queryAllByText('Data statistik tidak tersedia');
        expect(errorMessages.length).toBeGreaterThanOrEqual(2);
      }, { timeout: 5000 });
      
      consoleErrorSpy.mockRestore();
    });

    it('shows error fallback when data is null', async () => {
      vi.mocked(dashboardApi.getSchoolStatistics).mockResolvedValue(null as any);

      renderWithQueryClient(<SchoolStatisticsCards />);

      await waitFor(() => {
        const errorMessages = screen.queryAllByText('Data statistik tidak tersedia');
        expect(errorMessages.length).toBe(2);
      }, { timeout: 3000 });
    });
  });

  // ── 7. Responsive Layout ──────────────────────────────────────────────

  describe('7. Responsive Layout', () => {
    it('applies grid layout classes for responsive design', async () => {
      vi.mocked(dashboardApi.getSchoolStatistics).mockResolvedValue(mockStatisticsData);

      const { container } = renderWithQueryClient(<SchoolStatisticsCards />);

      await waitFor(() => {
        expect(screen.getByText('Statistik Afiliasi Sekolah')).toBeInTheDocument();
      });

      // Check for responsive grid classes
      const gridContainer = container.querySelector('.grid');
      expect(gridContainer).toBeInTheDocument();
      expect(gridContainer?.className).toContain('gap-6');
      expect(gridContainer?.className).toContain('md:grid-cols-2');
    });

    it('renders two cards side by side in grid layout', async () => {
      vi.mocked(dashboardApi.getSchoolStatistics).mockResolvedValue(mockStatisticsData);

      renderWithQueryClient(<SchoolStatisticsCards />);

      await waitFor(() => {
        expect(screen.getByText('Statistik Afiliasi Sekolah')).toBeInTheDocument();
      });

      // Both card titles should be present
      expect(screen.getByText('Statistik Afiliasi Sekolah')).toBeInTheDocument();
      expect(screen.getByText('Statistik Jenjang Pendidikan')).toBeInTheDocument();
    });

    it('applies responsive text sizing classes', async () => {
      vi.mocked(dashboardApi.getSchoolStatistics).mockResolvedValue(mockStatisticsData);

      const { container } = renderWithQueryClient(<SchoolStatisticsCards />);

      await waitFor(() => {
        expect(screen.getByText('Statistik Afiliasi Sekolah')).toBeInTheDocument();
      });

      // Check for responsive text classes (md:text-xl, md:text-base, etc.)
      const titles = container.querySelectorAll('.text-lg');
      expect(titles.length).toBeGreaterThan(0);
    });
  });

  // ── 8. Integration ────────────────────────────────────────────────────

  describe('8. Integration', () => {
    it('calls dashboardApi.getSchoolStatistics on mount', async () => {
      vi.mocked(dashboardApi.getSchoolStatistics).mockResolvedValue(mockStatisticsData);

      renderWithQueryClient(<SchoolStatisticsCards />);

      await waitFor(() => {
        expect(dashboardApi.getSchoolStatistics).toHaveBeenCalledTimes(1);
      });
    });

    it('renders both AffiliationCard and JenjangCard with correct data', async () => {
      vi.mocked(dashboardApi.getSchoolStatistics).mockResolvedValue(mockStatisticsData);

      renderWithQueryClient(<SchoolStatisticsCards />);

      await waitFor(() => {
        expect(screen.getByText('Statistik Afiliasi Sekolah')).toBeInTheDocument();
        expect(screen.getByText('Statistik Jenjang Pendidikan')).toBeInTheDocument();
      });

      // Verify data is passed correctly to sub-components
      expect(screen.getByText(/150 \(79%\)/)).toBeInTheDocument(); // Affiliation
      expect(screen.getByText(/80 \(42%\)/)).toBeInTheDocument(); // Jenjang
    });

    it('uses React Query with correct configuration', async () => {
      vi.mocked(dashboardApi.getSchoolStatistics).mockResolvedValue(mockStatisticsData);

      renderWithQueryClient(<SchoolStatisticsCards />);

      await waitFor(() => {
        expect(dashboardApi.getSchoolStatistics).toHaveBeenCalled();
      });

      // Verify query was called (configuration is internal to the component)
      expect(dashboardApi.getSchoolStatistics).toHaveBeenCalledTimes(1);
    });
  });
});
