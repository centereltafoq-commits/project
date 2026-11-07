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

  it('filters options with Arabic normalization', () => {
    render(<Combobox options={options} placeholder="اختر الطالب..." />);
    fireEvent.click(screen.getByRole('combobox'));

    const searchInput = screen.getByPlaceholderText('ابحث بالاسم أو الكود...');
    // User types "احمد" without hamza, matches "أحمد محمود علي"
    fireEvent.change(searchInput, { target: { value: 'احمد' } });
    expect(screen.getByText('أحمد محمود علي (STD-1029)')).toBeInTheDocument();
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

  it('clears selection when clicking clear button', () => {
    const onChange = vi.fn();
    render(<Combobox options={options} value="1" onChange={onChange} clearable />);
    expect(screen.getByText('بسملة صلاح الدين قطب (STD-1028)')).toBeInTheDocument();

    const clearBtn = screen.getByTitle('إلغاء التحديد');
    fireEvent.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('works via Select with searchable=true', () => {
    const onChange = vi.fn();
    render(
      <Select
        searchable
        label="الطالب"
        placeholder="اختر الطالب..."
        value="2"
        onChange={onChange}
        options={options}
      />,
    );

    expect(screen.getByText('الطالب')).toBeInTheDocument();
    expect(screen.getByText('أحمد محمود علي (STD-1029)')).toBeInTheDocument();
  });
});
