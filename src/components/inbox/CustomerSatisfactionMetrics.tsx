'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Star, ThumbsUp, ThumbsDown, Smile, Frown, Meh } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomerSatisfactionMetricsProps {
  lineAccountId: number;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

// Placeholder component - will be populated when satisfaction data is available
export function CustomerSatisfactionMetrics({ 
  lineAccountId, 
  dateRange 
}: CustomerSatisfactionMetricsProps) {
  // This would fetch actual satisfaction data from the API
  // For now, showing placeholder structure
  const satisfactionData = {
    averageRating: 0,
    totalResponses: 0,
    ratings: {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    },
    sentiment: {
      positive: 0,
      neutral: 0,
      negative: 0,
    },
  };

  const hasData = satisfactionData.totalResponses > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5 text-yellow-500" />
          Customer Satisfaction
        </CardTitle>
        <CardDescription>
          {hasData 
            ? 'Customer feedback and satisfaction scores'
            : 'No satisfaction data available yet'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="text-center py-8 text-muted-foreground">
            <div className="mb-4">
              <Meh className="h-12 w-12 mx-auto text-muted-foreground/50" />
            </div>
            <p className="text-sm">
              Customer satisfaction tracking is not yet configured.
            </p>
            <p className="text-xs mt-2">
              Enable post-conversation surveys to collect satisfaction data.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Average Rating */}
            <div className="text-center">
              <div className="text-4xl font-bold">
                {satisfactionData.averageRating.toFixed(1)}
              </div>
              <div className="flex items-center justify-center gap-1 mt-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={cn(
                      'h-5 w-5',
                      star <= satisfactionData.averageRating
                        ? 'fill-yellow-500 text-yellow-500'
                        : 'text-gray-300'
                    )}
                  />
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Based on {satisfactionData.totalResponses} responses
              </p>
            </div>

            {/* Rating Distribution */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Rating Distribution</h4>
              {[5, 4, 3, 2, 1].map((rating) => {
                const count = satisfactionData.ratings[rating as keyof typeof satisfactionData.ratings];
                const percentage = satisfactionData.totalResponses > 0
                  ? (count / satisfactionData.totalResponses) * 100
                  : 0;

                return (
                  <div key={rating} className="flex items-center gap-2">
                    <div className="flex items-center gap-1 w-16">
                      <span className="text-sm">{rating}</span>
                      <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                    </div>
                    <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-12 text-right">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Sentiment Analysis */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Sentiment Analysis</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 rounded-lg bg-green-50 border border-green-200">
                  <Smile className="h-6 w-6 mx-auto text-green-600 mb-2" />
                  <div className="text-2xl font-bold text-green-600">
                    {satisfactionData.sentiment.positive}
                  </div>
                  <div className="text-xs text-muted-foreground">Positive</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <Meh className="h-6 w-6 mx-auto text-gray-600 mb-2" />
                  <div className="text-2xl font-bold text-gray-600">
                    {satisfactionData.sentiment.neutral}
                  </div>
                  <div className="text-xs text-muted-foreground">Neutral</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-red-50 border border-red-200">
                  <Frown className="h-6 w-6 mx-auto text-red-600 mb-2" />
                  <div className="text-2xl font-bold text-red-600">
                    {satisfactionData.sentiment.negative}
                  </div>
                  <div className="text-xs text-muted-foreground">Negative</div>
                </div>
              </div>
            </div>

            {/* Feedback Summary */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-2">
                <ThumbsUp className="h-4 w-4 text-green-600" />
                <span className="text-sm">
                  {Math.round((satisfactionData.sentiment.positive / satisfactionData.totalResponses) * 100)}% positive
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ThumbsDown className="h-4 w-4 text-red-600" />
                <span className="text-sm">
                  {Math.round((satisfactionData.sentiment.negative / satisfactionData.totalResponses) * 100)}% negative
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
