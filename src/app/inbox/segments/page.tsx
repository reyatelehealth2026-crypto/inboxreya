'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Plus, Users, Download, Eye, Pencil, Trash2 } from 'lucide-react';
import { SegmentDialog } from '@/components/inbox/SegmentDialog';
import { SegmentPreviewDialog } from '@/components/inbox/SegmentPreviewDialog';
import { useToast } from '@/hooks/use-toast';

interface Segment {
  id: number;
  name: string;
  description?: string;
  criteria: any;
  logic: 'AND' | 'OR';
  customerCount?: number;
  createdAt: string;
  updatedAt: string;
}

function SegmentContent() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [previewSegmentId, setPreviewSegmentId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch segments
  const { data, isLoading } = useQuery({
    queryKey: ['segments'],
    queryFn: async () => {
      const res = await fetch('/api/inbox/segments');
      if (!res.ok) throw new Error('Failed to fetch segments');
      return res.json();
    },
  });

  // Delete segment mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/inbox/segments/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete segment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments'] });
      toast({
        title: 'Success',
        description: 'Segment deleted successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete segment',
        variant: 'destructive',
      });
    },
  });

  // Export segment
  const handleExport = async (id: number, name: string) => {
    try {
      const res = await fetch(`/api/inbox/segments/${id}/export`);
      if (!res.ok) throw new Error('Failed to export');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `segment-${name}-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Success',
        description: 'Segment exported successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export segment',
        variant: 'destructive',
      });
    }
  };

  const segments = data?.segments || [];

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Customer Segments</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage customer segments for targeted messaging
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Segment
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Loading segments...</div>
      ) : segments.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No segments yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first customer segment to start targeted messaging
          </p>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Segment
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {segments.map((segment: Segment) => (
            <div
              key={segment.id}
              className="border rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{segment.name}</h3>
                  {segment.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {segment.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {segment.customerCount || 0} customers
                </span>
              </div>

              <div className="mb-4">
                <div className="text-xs text-muted-foreground mb-1">Criteria:</div>
                <div className="flex flex-wrap gap-1">
                  {segment.criteria.tags && segment.criteria.tags.length > 0 && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      Tags: {segment.criteria.tags.join(', ')}
                    </span>
                  )}
                  {segment.criteria.membershipTiers && segment.criteria.membershipTiers.length > 0 && (
                    <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                      Tiers: {segment.criteria.membershipTiers.join(', ')}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Logic: {segment.logic}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewSegmentId(segment.id)}
                >
                  <Eye className="w-3 h-3 mr-1" />
                  Preview
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingSegment(segment);
                    setIsDialogOpen(true);
                  }}
                >
                  <Pencil className="w-3 h-3 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport(segment.id, segment.name)}
                >
                  <Download className="w-3 h-3 mr-1" />
                  Export
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this segment?')) {
                      deleteMutation.mutate(segment.id);
                    }
                  }}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <SegmentDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingSegment(null);
        }}
        segment={editingSegment}
      />

      {previewSegmentId && (
        <SegmentPreviewDialog
          segmentId={previewSegmentId}
          onClose={() => setPreviewSegmentId(null)}
        />
      )}
    </div>
  );
}

export default function CustomerSegmentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return <SegmentContent />;
}
