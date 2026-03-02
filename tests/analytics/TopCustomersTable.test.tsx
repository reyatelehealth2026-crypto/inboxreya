import { render, screen } from '@testing-library/react';
import { TopCustomersTable } from '@/components/analytics/TopCustomersTable';

describe('TopCustomersTable', () => {
  const mockCustomers = [
    {
      memberId: 'PC001',
      name: 'Customer 1',
      totalSpent: 180000,
      orderCount: 10,
      tier: 'vip',
      avgOrderValue: 18000
    }
  ];

  test('renders table with customer data', () => {
    render(<TopCustomersTable customers={mockCustomers} />);
    expect(screen.getByText(/ลูกค้ายอดซื้อสูงสุด/i)).toBeInTheDocument();
    expect(screen.getByText('Customer 1')).toBeInTheDocument();
  });
});
