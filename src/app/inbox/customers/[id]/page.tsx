import { Suspense } from 'react'
import { CustomerDetailPage } from '@/components/inbox/CustomerDetailPage'
import { Skeleton } from '@/components/ui/skeleton'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: PageProps) {
  const { id } = await params

  return (
    <Suspense fallback={<CustomerDetailPageSkeleton />}>
      <CustomerDetailPage userId={id} />
    </Suspense>
  )
}

function CustomerDetailPageSkeleton() {
  return (
    <div className="container max-w-7xl mx-auto p-6 space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    </div>
  )
}
