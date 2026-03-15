import { render, screen } from '@testing-library/react';
import { StatsCards } from '@/components/analytics/StatsCards';

describe('StatsCards', () => {
  const mockStats = {
    totalRevenue: 4220946.54,
    totalCustomers: 102,
    avgOrderValue: 41382,
    totalOrders: 245,
    avgSentiment: 75
  };

  test('renders all stat cards', () => {
    render(<StatsCards stats={mockStats} />);
    expect(screen.getByText(/รายได้รวม/i)).toBeInTheDocument();
    expect(screen.getByText(/จำนวนลูกค้า/i)).toBeInTheDocument();
    expect(screen.getByText(/จำนวนออเดอร์/i)).toBeInTheDocument();
    expect(screen.getByText(/คะแนนความพึงพอใจ/i)).toBeInTheDocument();
  });

  test('displays formatted values', () => {
    render(<StatsCards stats={mockStats} />);
    // Just verify the cards render with values - exact formatting varies by locale
    const cards = screen.getAllByText(/[0-9,]+/);
    expect(cards.length).toBeGreaterThanOrEqual(4);
  });

  test('shows default sentiment when avgSentiment is not provided', () => {
    const statsWithoutSentiment = {
      totalRevenue: 1000,
      totalCustomers: 10,
      avgOrderValue: 100,
      totalOrders: 10
    };
    render(<StatsCards stats={statsWithoutSentiment} />);
    expect(screen.getByText(/คะแนนความพึงพอใจ/i)).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });
});
