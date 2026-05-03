import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocalizedTextEditor } from '../../../components/i18n/LocalizedTextEditor';

describe('LocalizedTextEditor', () => {
  it('renders project layer mode buttons', () => {
    const onChange = vi.fn();
    render(
      <LocalizedTextEditor
        layer="project"
        value={undefined}
        onChange={onChange}
        label="Button Text"
      />
    );

    expect(
      screen.getByRole('radio', { name: /inherit from instance default/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /override with no text/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /override with custom text/i })).toBeInTheDocument();
  });

  it('renders global layer mode buttons', () => {
    const onChange = vi.fn();
    render(
      <LocalizedTextEditor layer="global" value={null} onChange={onChange} label="Button Text" />
    );

    expect(screen.getByRole('radio', { name: /use built-in default/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /custom text/i })).toBeInTheDocument();
  });

  it('emits an LocalizedString seed when switching to custom on the project layer', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <LocalizedTextEditor
        layer="project"
        value={undefined}
        onChange={onChange}
        label="Button Text"
      />
    );

    await user.click(screen.getByRole('radio', { name: /override with custom text/i }));
    expect(onChange).toHaveBeenCalledWith({ en: '' });
  });

  it('emits null when "no text" is selected on the project layer', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <LocalizedTextEditor
        layer="project"
        value={undefined}
        onChange={onChange}
        label="Button Text"
      />
    );

    await user.click(screen.getByRole('radio', { name: /override with no text/i }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('renders locale tabs when value is an object and accepts en input', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <LocalizedTextEditor
        layer="project"
        value={{ en: '' }}
        onChange={onChange}
        label="Button Text"
      />
    );

    expect(screen.getByRole('tab', { name: /English/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Deutsch/i })).toBeInTheDocument();

    const enInput = screen.getByRole('textbox');
    await user.type(enInput, 'H');
    expect(onChange).toHaveBeenCalledWith({ en: 'H' });
  });
});
