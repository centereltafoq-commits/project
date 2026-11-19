import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { confirmAction } from '@/lib/alerts';
import { Modal } from './modal';

function ConfirmableModal() {
  const [open, setOpen] = React.useState(true);

  return (
    <>
      <button type="button">Student list</button>
      <Modal open={open} onOpenChange={setOpen} title="Import students" description="Review the import">
        <button
          type="button"
          onClick={async () => {
            if (await confirmAction({ title: 'Confirm import', confirmButtonText: 'Import' })) {
              setOpen(false);
            }
          }}
        >
          Save import
        </button>
      </Modal>
    </>
  );
}

describe('confirmation inside a modal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('exposes the student list to assistive technology after confirming and closing both dialogs', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    const { container } = render(<ConfirmableModal />);

    fireEvent.click(screen.getByRole('button', { name: 'Save import' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Import' }));

    await waitFor(() => {
      expect(document.querySelector('[role="dialog"]')).toBeNull();
      expect(container).not.toHaveAttribute('aria-hidden');
      expect(screen.getByRole('button', { name: 'Student list' })).toBeVisible();
    });
  });
});
