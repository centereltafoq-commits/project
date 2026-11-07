import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Combobox, normalizeArabic } from './combobox';
import { Select } from './select';

describe('normalizeArabic utility', () => {
  it('normalizes alef variants and removes tashkeel', () => {
    expect(normalizeArabic('أَحْمَدُ')).toBe('احمد');
    expect(normalizeArabic('إبراهيم')).toBe('ابراهيم');
    expect(normalizeArabic('آمال')).toBe('امال');
    expect(normalizeArabic('فاطمة')).toBe('فاطمه');
    expect(normalizeArabic('منى')).toBe('مني');
    expect(normalizeArabic('مؤمن')).toBe('مومن');
    expect(normalizeArabic('عائشة')).toBe('عايشه');
    expect(normalizeArabic('محمــــد')).toBe('محمد');
    expect(normalizeArabic('ٱلْحَمْدُ')).toBe('الحمد');
  });
});

describe('Combobox Component', () => {
  const options = [
    { value: '1', label: 'بسملة صلاح الدين قطب (STD-1028)', sublabel: 'الصف الأول الثانوي' },
    { value: '2', label: 'أحمد محمود علي (STD-1029)', sublabel: 'الصف الثاني الثانوي' },
    { value: '3', label: 'محمد خالد حسن (STD-1030)', sublabel: 'الصف الثالث الثانوي' },
  ];

  it('renders placeholder and opens list on click', () => {
    render(<Combobox options={options} placeholder="اختر الطالب..." />);
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveTextContent('اختر الطالب...');

    fireEvent.click(trigger);
    expect(screen.getByPlaceholderText('ابحث بالاسم أو الكود...')).toBeInTheDocument();
    expect(screen.getByText('بسملة صلاح الدين قطب (STD-1028)')).toBeInTheDocument();
  });

  it('filters options with Arabic normalization and tatweel', () => {
    render(<Combobox options={options} placeholder="اختر الطالب..." />);
    fireEvent.click(screen.getByRole('combobox'));

    const searchInput = screen.getByPlaceholderText('ابحث بالاسم أو الكود...');
    // User types "احمد" without hamza, matches "أحمد محمود علي"
    fireEvent.change(searchInput, { target: { value: 'احمد' } });
    expect(screen.getByText('أحمد محمود علي (STD-1029)')).toBeInTheDocument();
    expect(screen.queryByText('بسملة صلاح الدين قطب (STD-1028)')).not.toBeInTheDocument();

    // User types with Tatweel "محمــــد" matches "محمد خالد حسن"
    fireEvent.change(searchInput, { target: { value: 'محمــــد' } });
    expect(screen.getByText('محمد خالد حسن (STD-1030)')).toBeInTheDocument();
    expect(screen.queryByText('بسملة صلاح الدين قطب (STD-1028)')).not.toBeInTheDocument();

    // User types code "1028"
    fireEvent.change(searchInput, { target: { value: '1028' } });
    expect(screen.getByText('بسملة صلاح الدين قطب (STD-1028)')).toBeInTheDocument();
    expect(screen.queryByText('أحمد محمود علي (STD-1029)')).not.toBeInTheDocument();
  });

  it('calls onChange when selecting an option', () => {
    const onChange = vi.fn();
    render(<Combobox options={options} value="" onChange={onChange} />);
    fireEvent.click(screen.getByRole('combobox'));

    fireEvent.click(screen.getByText('محمد خالد حسن (STD-1030)'));
    expect(onChange).toHaveBeenCalledWith('3');
  });

  it('selects highlighted option on Enter key exactly once', () => {
    const onChange = vi.fn();
    render(<Combobox options={options} value="" onChange={onChange} />);
    fireEvent.click(screen.getByRole('combobox'));

    const searchInput = screen.getByPlaceholderText('ابحث بالاسم أو الكود...');
    fireEvent.change(searchInput, { target: { value: 'خالد' } });
    // Press Enter to select the top filtered result
    fireEvent.keyDown(searchInput, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('3');
  });

  it('navigates with ArrowDown and ArrowUp without crashing on empty', () => {
    render(<Combobox options={options} placeholder="اختر..." />);
    fireEvent.click(screen.getByRole('combobox'));

    const searchInput = screen.getByPlaceholderText('ابحث بالاسم أو الكود...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    expect(screen.getByText('لا توجد نتائج مطابقة')).toBeInTheDocument();

    // Arrow keys when list is empty should not crash or select anything
    fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
    fireEvent.keyDown(searchInput, { key: 'ArrowUp' });
    fireEvent.keyDown(searchInput, { key: 'Enter' });
  });

  it('clears selection when clicking clear button without reopening popover', () => {
    const onChange = vi.fn();
    render(<Combobox options={options} value="1" onChange={onChange} clearable />);
    expect(screen.getByText('بسملة صلاح الدين قطب (STD-1028)')).toBeInTheDocument();

    const clearBtn = screen.getByTitle('إلغاء التحديد');
    // Clicking clear should trigger pointerDown and click
    fireEvent.pointerDown(clearBtn);
    fireEvent.click(clearBtn);

    expect(onChange).toHaveBeenCalledWith('');
    // Popover search input should NOT be opened
    expect(screen.queryByPlaceholderText('ابحث بالاسم أو الكود...')).not.toBeInTheDocument();
  });

  it('works via Select with searchable=true and forwards defaultValue', () => {
    const onChange = vi.fn();
    render(
      <Select
        searchable
        label="الطالب"
        placeholder="اختر الطالب..."
        defaultValue="2"
        onChange={onChange}
        options={options}
      />,
    );

    expect(screen.getByText('الطالب')).toBeInTheDocument();
    expect(screen.getByText('أحمد محمود علي (STD-1029)')).toBeInTheDocument();
  });
});
