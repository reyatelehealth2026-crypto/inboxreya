'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';

interface SegmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segment?: any;
}

export function SegmentDialog({ open, onOpenChange, segment }: SegmentDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logic, setLogic] = useState<'AND' | 'OR'>('AND');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedTiers, setSelectedTiers] = useState<string[]>([]);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch available tags
  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const res = await fetch('/api/inbox/tags');
      if (!res.ok) throw new Error('Failed to fetch tags');
      return res.json();
    },
  });

  const availableTags = tagsData?.tags || [];
  const availableTiers = ['bronze', 'silver', 'gold', 'platinum'];

  useEffect(() => {
    if (segment) {
      setName(segment.name);
      setDescription(segment.description || '');
      setLogic(segment.logic);
      setSelectedTags(segment.criteria.tags || []);
      setSelectedTiers(segment.criteria.membershipTiers || []);
    } else {
      setName('');
      setDescription('');
      setLogic('AND');
      setSelectedTags([]);
      setSelectedTiers([]);
    }
  }, [segment, open]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const url = segment
        ? `/api/inbox/segments/${segment.id}`
        : '/api/inbox/segments';
      const method = segment ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error('Failed to save segment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments'] });
      toast({
        title: 'Success',
        description: `Segment ${segment ? 'updated' : 'created'} successfully`,
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to save segment',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a segment name',
        variant: 'destructive',
      });
      return;
    }

    if (selectedTags.length === 0 && selectedTiers.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one criteria',
        variant: 'destructive',
      });
      return;
    }

    mutation.mutate({
      name,
      description,
      logic,
      criteria: {
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        membershipTiers: selectedTiers.length > 0 ? selectedTiers : undefined,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {segment ? 'Edit Segment' : 'Create New Segment'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Segment Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., VIP Customers"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this segment..."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="logic">Criteria Logic</Label>
            <Select value={logic} onValueChange={(v: 'AND' | 'OR') => setLogic(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AND">AND (All criteria must match)</SelectItem>
                <SelectItem value="OR">OR (Any criteria can match)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Tags</Label>
            <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
              {availableTags.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tags available</p>
              ) : (
                availableTags.map((tag: any) => (
                  <div key={tag.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`tag-${tag.id}`}
                      checked={selectedTags.includes(tag.name)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedTags([...selectedTags, tag.name]);
                        } else {
                          setSelectedTags(selectedTags.filter((t) => t !== tag.name));
                        }
                      }}
                    />
                    <label
                      htmlFor={`tag-${tag.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {tag.name}
                    </label>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <Label>Membership Tiers</Label>
            <div className="border rounded-md p-3 space-y-2">
              {availableTiers.map((tier) => (
                <div key={tier} className="flex items-center space-x-2">
                  <Checkbox
                    id={`tier-${tier}`}
                    checked={selectedTiers.includes(tier)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedTiers([...selectedTiers, tier]);
                      } else {
                        setSelectedTiers(selectedTiers.filter((t) => t !== tier));
                      }
                    }}
                  />
                  <label
                    htmlFor={`tier-${tier}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize"
                  >
                    {tier}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : segment ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
