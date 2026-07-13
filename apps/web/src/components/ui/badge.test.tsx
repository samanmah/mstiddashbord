import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './badge';

describe('StatusBadge', () => {
  it('renders the label text', () => {
    render(<StatusBadge tone="green" label="خوب" />);
    expect(screen.getByText('خوب')).toBeInTheDocument();
  });

  it('renders a colored dot by default', () => {
    const { container } = render(<StatusBadge tone="red" label="ضعیف" />);
    const dot = container.querySelector('span[aria-hidden]');
    expect(dot).not.toBeNull();
  });

  it('hides the dot when showDot is false', () => {
    const { container } = render(
      <StatusBadge tone="blue" label="جدید" showDot={false} />,
    );
    expect(container.querySelector('span[aria-hidden]')).toBeNull();
  });
});
