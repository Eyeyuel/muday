import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../src/App';

const response = {
  locale: 'en',
  user: { firstName: 'Abebe', lastName: 'Tesfaye', username: 'abebe' },
  period: 'month',
  range: { start: '2026-08-01T00:00:00.000Z', end: '2026-09-01T00:00:00.000Z' },
  summary: {
    incomeEtb: '5000.00',
    expenseEtb: '550.00',
    netEtb: '4450.00',
    earnedIncomeEtb: '5000.00',
    ordinaryExpenseEtb: '550.00',
    earnedNetEtb: '4450.00',
    cashInflowEtb: '6000.00',
    cashOutflowEtb: '550.00',
    cashFlowNetEtb: '5450.00',
  },
  expenseCategories: [{ category: 'food', amountEtb: '550.00', percentage: 100 }],
  specialMovements: [{ kind: 'loan_received', amountEtb: '1000.00' }],
  recentTransactions: [
    {
      id: 'tx-1',
      type: 'expense',
      kind: 'expense',
      amountEtb: '550.00',
      category: 'food',
      note: 'Lunch',
      source: 'text',
      occurredAt: '2026-08-03T10:00:00.000Z',
    },
  ],
};

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv('VITE_ALLOW_LOCAL_DEV_AUTH', 'true');
    vi.stubEnv('VITE_API_BASE_URL', 'http://127.0.0.1:3001');
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    delete window.Telegram;
    window.history.pushState({}, '', '/');
  });

  it('loads the month dashboard in explicit development mode', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));

    render(<App />);

    expect(await screen.findByText('Muday')).toBeVisible();
    expect(screen.getByText(/total transactions|ጠቅላላ ግብይት|balance|አጠቃላይ ቀሪ ሒሳብ/i)).toBeVisible();
    expect(screen.getAllByText(/abyssinia|አቢሲኒያ/i)[0]).toBeVisible();
    expect(screen.getAllByText(/telebirr|ቴሌብር/i)[0]).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/dashboard?period=month&limit=20',
      expect.objectContaining({ headers: { Authorization: 'dev' }, cache: 'no-store' }),
    );
  });

  it('reloads data when the weekly timeframe is selected', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
    render(<App />);
    await screen.findByText('Muday');

    fireEvent.click(screen.getByRole('button', { name: /weekly|ሳምንታዊ/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'http://127.0.0.1:3001/api/dashboard?period=week&limit=20',
    );
  });

  it('shows empty message when transactions list is empty', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ...response,
          summary: Object.fromEntries(Object.keys(response.summary).map((key) => [key, '0.00'])),
          expenseCategories: [],
          specialMovements: [],
          recentTransactions: [],
        }),
        { status: 200 },
      ),
    );
    render(<App />);

    expect(
      await screen.findByText(/no transactions in this period yet|በዚህ ጊዜ ውስጥ ግብይት የለም/i),
    ).toBeVisible();
  });

  it('does not offer retry when Telegram authentication is rejected', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 401 }));
    render(<App />);

    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  it('navigates to history tab when history navigation button is clicked', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(response), { status: 200 }),
    );
    render(<App />);
    await screen.findByText('Muday');

    fireEvent.click(screen.getByRole('button', { name: /history|ታሪክ/i }));
    expect(await screen.findByText(/transaction history|የግብይት ታሪክ/i)).toBeVisible();
  });

  it('does not request a Telegram dashboard while rendering an admin login route', async () => {
    window.history.pushState({}, '', '/admin/login');
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: /admin sign in|የአስተዳዳሪ መግቢያ/i }),
    ).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
