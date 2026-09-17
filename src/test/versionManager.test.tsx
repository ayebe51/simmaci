import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { versionManager } from '@/lib/versionManager';
import { render, screen, fireEvent } from '@testing-library/react';
import { UpdateNotification } from '@/components/common/UpdateNotification';

describe('VersionManager & UpdateNotification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('detects user busy state when input is focused', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    expect(versionManager.isUserBusy()).toBe(true);

    input.blur();
    expect(versionManager.isUserBusy()).toBe(false);
    document.body.removeChild(input);
  });

  it('detects user busy state when dialog is open', () => {
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.appendChild(dialog);

    expect(versionManager.isUserBusy()).toBe(true);

    document.body.removeChild(dialog);
    expect(versionManager.isUserBusy()).toBe(false);
  });

  it('detects dirty form state', () => {
    const form = document.createElement('form');
    form.setAttribute('data-form-dirty', 'true');
    document.body.appendChild(form);

    expect(versionManager.isUserBusy()).toBe(true);

    document.body.removeChild(form);
    expect(versionManager.isUserBusy()).toBe(false);
  });

  it('safely defers reload when user is busy', () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();

    const reloaded = versionManager.safeReload(false);
    expect(reloaded).toBe(false);

    document.body.removeChild(textarea);
  });

  it('renders UpdateNotification banner when new version is detected', async () => {
    const { act } = await import('@testing-library/react');
    render(<UpdateNotification />);

    // Initially no update banner
    expect(screen.queryByText(/Pembaruan SIMMACI Tersedia/i)).not.toBeInTheDocument();

    // Trigger update wrapped in act
    act(() => {
      // @ts-ignore private method access for testing
      versionManager.handleNewVersionDetected(
        {
          version: '1.0.1',
          buildId: '20260917-test-new',
          timestamp: new Date().toISOString(),
        },
        false
      );
    });

    expect(await screen.findByText(/Pembaruan SIMMACI Tersedia/i)).toBeInTheDocument();
    expect(screen.getByText('v1.0.1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Perbarui Sekarang/i })).toBeInTheDocument();
  });
});
