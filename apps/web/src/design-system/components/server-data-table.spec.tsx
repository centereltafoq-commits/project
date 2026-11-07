import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ServerDataTable } from './server-data-table';

describe('ServerDataTable (Design System 25/page standard)', () => {
  it('renders rows, pagination 25/page summary, and fires search callback', () => {
    const onSearchChange = vi.fn();
    const onPageChange = vi.fn();

    render(
      <ServerDataTable
        rowKey={(r) => r.id}
        data={[
          { id: '1', name: 'يوسف أحمد' },
          { id: '2', name: 'مريم طارق' },
        ]}
        meta={{
          page: 1,
          limit: 25,
          totalItems: 32,
          totalPages: 2,
          hasNextPage: true,
          hasPrevPage: false,
        }}
        columns={[
          {
            key: 'name',
            header: 'اسم الطالب',
            render: (r) => r.name,
          },
        ]}
        searchValue=""
        onSearchChange={onSearchChange}
        onPageChange={onPageChange}
      />,
    );

    expect(screen.getByText('يوسف أحمد')).toBeInTheDocument();
    expect(screen.getByText('مريم طارق')).toBeInTheDocument();
    expect(screen.getByText('صفحة 1 من 2')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText('ابحث بالاسم أو الكود أو رقم الهاتف...');
    fireEvent.change(searchInput, { target: { value: 'يوسف' } });
    expect(onSearchChange).toHaveBeenCalledWith('يوسف');

    fireEvent.click(screen.getByText('التالي'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});

