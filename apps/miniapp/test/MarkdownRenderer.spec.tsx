import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownRenderer } from '../src/components/admin/MarkdownRenderer';

describe('MarkdownRenderer Component', () => {
  it('renders bold, italic, and inline code formatting', () => {
    render(
      <MarkdownRenderer content="Here is **bold text**, *italic text*, and `code snippet`." />,
    );

    expect(screen.getByText('bold text')).toBeInTheDocument();
    expect(screen.getByText('italic text')).toBeInTheDocument();
    expect(screen.getByText('code snippet')).toBeInTheDocument();
  });

  it('renders unordered bullet lists', () => {
    const markdown = `- Item 1: Telebirr volume\n- Item 2: CBE volume\n- Item 3: Cash volume`;
    render(<MarkdownRenderer content={markdown} />);

    expect(screen.getByText(/Item 1: Telebirr volume/i)).toBeInTheDocument();
    expect(screen.getByText(/Item 2: CBE volume/i)).toBeInTheDocument();
    expect(screen.getByText(/Item 3: Cash volume/i)).toBeInTheDocument();
  });

  it('renders markdown tables properly', () => {
    const tableMd = `| Category | Volume (ETB) | Share |\n|---|---|---|\n| Food | 10,200 | 45% |\n| Utilities | 5,000 | 22% |`;
    render(<MarkdownRenderer content={tableMd} />);

    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Food')).toBeInTheDocument();
    expect(screen.getByText('10,200')).toBeInTheDocument();
    expect(screen.getByText('Utilities')).toBeInTheDocument();
  });
});
