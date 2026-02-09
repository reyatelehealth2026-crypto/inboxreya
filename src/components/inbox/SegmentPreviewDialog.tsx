'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';

interface SegmentPreviewDialogProps {
  segmentId: number;
  onClose: () => void;
}

export function SegmentPreviewDialog({ segmentId, onClose }: SegmentPreviewDialogProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['segment-customers', segmentId],
    queryFn: async () => {
      const res = await fetch(`/api/inbox/segments/${segmentId}/customers`);
      if (!res.ok) throw new Error('Failed to fetch customers');
      return res.json();
    },
  });

  const customers = data?.customers || [];
  const total = data?.total || 0;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Segment Preview ({total} customers)
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-8">Loading customers...</div>
          ) : customers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No customers match this segment criteria
            </div>
          ) : (
            <div className="space-y-2">
              {customers.map((customer: any) => (
                <div
                  key={customer.id}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent"
                >
                  <Avatar>
                    <AvatarImage src={customer.pictureUrl} />
                    <AvatarFallback>
                      {customer.displayName?.[0] || '?'}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {customer.displayName || 'Unknown'}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {customer.lineUserId}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {customer.membershipTier && (
                      <Badge variant="secondary" className="capitalize">
                        {customer.membershipTier}
                      </Badge>
                    )}
                    {customer.tags && customer.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 justify-end">
                        {customer.tags.slice(0, 3).map((tag: string) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {customer.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{customer.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {total > 100 && (
            <div className="text-center text-sm text-muted-foreground mt-4 py-2 border-t">
              Showing first 100 customers. Total: {total}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
