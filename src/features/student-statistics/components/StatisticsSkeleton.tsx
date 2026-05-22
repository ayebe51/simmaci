import { Card, CardContent } from '@/components/ui/card';

export function StatisticsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="animate-pulse">
          <CardContent className="p-6 space-y-4">
            {/* Title area */}
            <div className="h-4 bg-slate-200 rounded w-2/3" />
            {/* Count area */}
            <div className="h-8 bg-slate-200 rounded w-1/3" />
            {/* Percentage area */}
            <div className="h-3 bg-slate-200 rounded w-1/4" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
