import * as React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DocsPage } from './docs-page';

describe('DocsPage Component', () => {
  it('renders documentation portal with search and default overview section', () => {
    render(
      <MemoryRouter>
        <DocsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('دليل وتوثيق صفحات النظام')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ابحث في شروحات الصفحات/i)).toBeInTheDocument();
    expect(screen.getAllByText('نظرة عامة والبدء السريع').length).toBeGreaterThan(0);
    expect(screen.getByText('تم الإنشاء والتطوير بواسطة')).toBeInTheDocument();

    const backBtn = screen.getByTestId('back-to-system-btn');
    expect(backBtn).toBeInTheDocument();
    expect(backBtn).toHaveAttribute('href', '/');
    expect(screen.getByText('الرجوع للنظام')).toBeInTheDocument();
  });

  it('switches documentation section when clicking a category item', () => {
    render(
      <MemoryRouter>
        <DocsPage />
      </MemoryRouter>,
    );

    // Find and click the Classrooms section button
    const classroomsButtons = screen.getAllByRole('button', { name: /إدارة القاعات/i });
    expect(classroomsButtons.length).toBeGreaterThan(0);
    fireEvent.click(classroomsButtons[0]!);

    // Check that classrooms documentation content is displayed
    expect(screen.getByText(/دليل الاستخدام والتشغيل خطوة بخطوة/i)).toBeInTheDocument();
    expect(screen.getByText(/قواعد العمل والتنبيهات المحاسبية/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /الانتقال للصفحة/i })).toHaveAttribute(
      'href',
      '/classrooms',
    );
  });

  it('filters sections dynamically when typing in search input', () => {
    render(
      <MemoryRouter>
        <DocsPage />
      </MemoryRouter>,
    );

    const searchInput = screen.getByPlaceholderText(/ابحث في شروحات الصفحات/i);
    fireEvent.change(searchInput, { target: { value: 'صيانة' } });

    // Should match classrooms / maintenance
    expect(screen.getByText(/إدارة القاعات/i)).toBeInTheDocument();
  });
});
