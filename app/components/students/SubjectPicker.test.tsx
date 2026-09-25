// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SubjectPicker } from './SubjectPicker';

afterEach(cleanup);

describe('SubjectPicker', () => {
  it('shows standard subjects in the current interface language', () => {
    const { rerender } = render(<SubjectPicker language="zh-TW" value={[]} onChange={() => undefined} />);
    expect(screen.getByRole('button', { name: '數學' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '資訊科技' })).toBeTruthy();

    rerender(<SubjectPicker language="en" value={[]} onChange={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Mathematics' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Computer Science' })).toBeTruthy();
  });

  it('lets a teacher add a custom subject', () => {
    const onChange = vi.fn();
    render(<SubjectPicker language="zh-TW" value={['Mathematics']} onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox', { name: '自訂科目名稱' }), { target: { value: '機器人學' } });
    fireEvent.click(screen.getByRole('button', { name: '新增科目' }));
    expect(onChange).toHaveBeenCalledWith(['Mathematics', '機器人學']);
  });
});
