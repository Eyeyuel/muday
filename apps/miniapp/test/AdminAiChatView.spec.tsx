import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as adminApi from '../src/api/admin-api';
import { AdminAiChatView } from '../src/components/admin/AdminAiChatView';

vi.mock('../src/api/admin-api', () => ({
  sendAdminAiMessage: vi.fn(),
}));

describe('AdminAiChatView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders initial empty state with suggested prompt chips', () => {
    render(<AdminAiChatView />);

    expect(screen.getByText(/Muday AI Data Assistant/i)).toBeInTheDocument();
    expect(screen.getByText(/How can I help explore Muday data today\?/i)).toBeInTheDocument();

    // Check suggested prompt chips
    expect(screen.getByText(/Top Categories/i)).toBeInTheDocument();
    expect(screen.getByText(/Telebirr vs CBE/i)).toBeInTheDocument();
    expect(screen.getByText(/Top Spender Audit/i)).toBeInTheDocument();
    expect(screen.getByText(/Generate Excel Sheet/i)).toBeInTheDocument();
  });

  it('submits a custom prompt and renders AI response', async () => {
    vi.mocked(adminApi.sendAdminAiMessage).mockResolvedValueOnce({
      sessionId: 'session-123',
      reply: 'Food & Groceries represents 37.2% of total expenses.',
      toolsExecuted: [{ toolName: 'getSpendingHabitsAndCategoryAnalytics', args: {} }],
    });

    render(<AdminAiChatView />);

    const textarea = screen.getByPlaceholderText(/Ask about spending habits/i);
    fireEvent.change(textarea, { target: { value: 'What is our top expense category?' } });

    const sendButton = screen.getByRole('button', { name: /Send inquiry/i });
    fireEvent.click(sendButton);

    // User message should appear immediately
    expect(screen.getByText('What is our top expense category?')).toBeInTheDocument();

    // Wait for AI response to appear
    await waitFor(() => {
      expect(
        screen.getByText(/Food & Groceries represents 37.2% of total expenses./i),
      ).toBeInTheDocument();
    });

    expect(adminApi.sendAdminAiMessage).toHaveBeenCalledWith(
      'What is our top expense category?',
      undefined,
    );
  });

  it('clicking a suggested prompt automatically sends the inquiry', async () => {
    vi.mocked(adminApi.sendAdminAiMessage).mockResolvedValueOnce({
      sessionId: 'session-456',
      reply: 'Telebirr handled 57.1% and CBE handled 42.9% of payment volume.',
      toolsExecuted: [{ toolName: 'getPaymentMethodAndBankDistribution', args: {} }],
    });

    render(<AdminAiChatView />);

    const chipButton = screen.getByText('Telebirr vs CBE').closest('button');
    expect(chipButton).not.toBeNull();
    fireEvent.click(chipButton!);

    // Prompt text sent
    expect(screen.getByText('Compare payment volume between Telebirr and CBE')).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText(/Telebirr handled 57.1% and CBE handled 42.9% of payment volume./i),
      ).toBeInTheDocument();
    });
  });

  it('handles backend API error with friendly error alert', async () => {
    vi.mocked(adminApi.sendAdminAiMessage).mockRejectedValueOnce(
      new Error('Rate limit exceeded. Please wait a moment.'),
    );

    render(<AdminAiChatView />);

    const textarea = screen.getByPlaceholderText(/Ask about spending habits/i);
    fireEvent.change(textarea, { target: { value: 'Trigger rate limit test' } });

    const sendButton = screen.getByRole('button', { name: /Send inquiry/i });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('Rate limit exceeded. Please wait a moment.')).toBeInTheDocument();
    });
  });

  it('"New Analysis" button resets conversation state', async () => {
    vi.mocked(adminApi.sendAdminAiMessage).mockResolvedValueOnce({
      sessionId: 'session-789',
      reply: 'There are 130 active users.',
      toolsExecuted: [],
    });

    render(<AdminAiChatView />);

    const textarea = screen.getByPlaceholderText(/Ask about spending habits/i);
    fireEvent.change(textarea, { target: { value: 'How many users?' } });

    const sendButton = screen.getByRole('button', { name: /Send inquiry/i });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('There are 130 active users.')).toBeInTheDocument();
    });

    // Click "New Analysis"
    const newChatButton = screen.getByRole('button', { name: /New Analysis/i });
    fireEvent.click(newChatButton);

    // Empty hero should be restored
    expect(screen.getByText(/How can I help explore Muday data today\?/i)).toBeInTheDocument();
    expect(screen.queryByText('There are 130 active users.')).not.toBeInTheDocument();
  });
});
