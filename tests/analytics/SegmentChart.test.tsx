import { render, screen } from '@testing-library/react';
import { SegmentChart } from '@/components/analytics/SegmentChart';

describe('SegmentChart', () => {
  const mockSegments = [
    { name: 'VIP', tier: 'vip' as const, minSpent: 100000, count: 7, percentage: 7 },
    { name: 'Gold', tier: 'gold' as const, minSpent: 50000, count: 6, percentage: 6 }
  ];

  test('renders chart with segment data', () => {
    render(<SegmentChart segments={mockSegments} />);
    expect(screen.getByText(/กลุ่มลูกค้า/i)).toBeInTheDocument();
  });
});
