"use client"

import { useState } from 'react'
import { 
  FileText, 
  Eye, 
  Check, 
  AlertCircle,
  Calendar,
  User,
  Pill
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn, formatDate } from '@/lib/utils'
import { usePrescriptions, useUpdatePrescription } from '@/hooks/use-prescriptions'

interface PrescriptionsSectionProps {
  userId: string
}

interface Medication {
  name: string
  dosage?: string
  frequency?: string
}

export function PrescriptionsSection({ userId }: PrescriptionsSectionProps) {
  const { data: prescriptions, isLoading } = usePrescriptions(userId)
  const updatePrescription = useUpdatePrescription()
  const [selectedPrescription, setSelectedPrescription] = useState<any>(null)
  const [showImageDialog, setShowImageDialog] = useState(false)

  const handleStatusChange = async (prescriptionId: string, status: string) => {
    await updatePrescription.mutateAsync({
      prescriptionId,
      status,
    })
  }

  const handleViewImage = (prescription: any) => {
    setSelectedPrescription(prescription)
    setShowImageDialog(true)
  }

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </Card>
    )
  }

  if (!prescriptions || prescriptions.length === 0) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-500" />
            <h3 className="font-semibold text-sm">Prescriptions</h3>
          </div>
        </div>
        <div className="text-center text-sm text-muted-foreground py-4">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No prescriptions on file</p>
        </div>
      </Card>
    )
  }

  return (
    <>
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-500" />
            <h3 className="font-semibold text-sm">Prescriptions</h3>
            <Badge variant="secondary" className="text-xs">
              {prescriptions.length}
            </Badge>
          </div>
        </div>

        <ScrollArea className="h-96">
          <div className="space-y-3">
            {prescriptions.map((prescription) => (
              <div
                key={prescription.id}
                className={cn(
                  "border rounded-lg p-3 space-y-2",
                  prescription.isExpired && "border-red-300 bg-red-50/50 dark:bg-red-950/20",
                  prescription.isExpiringSoon && !prescription.isExpired && "border-orange-300 bg-orange-50/50 dark:bg-orange-950/20"
                )}
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">
                        {prescription.prescriptionNumber || `RX-${prescription.id}`}
                      </p>
                      <Badge
                        variant={
                          prescription.status === 'dispensed' ? 'default' :
                          prescription.status === 'verified' ? 'secondary' :
                          prescription.status === 'pending' ? 'outline' :
                          'destructive'
                        }
                        className="text-xs"
                      >
                        {prescription.status}
                      </Badge>
                    </div>
                    {prescription.prescribedDate && (
                      <p className="text-xs text-muted-foreground mt-1">
                        <Calendar className="h-3 w-3 inline mr-1" />
                        {formatDate(prescription.prescribedDate)}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleViewImage(prescription)}
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                </div>

                {/* Expiration Warning */}
                {prescription.isExpiringSoon && !prescription.isExpired && prescription.expiresAt && (
                  <div className="flex items-center gap-2 text-xs text-orange-600 dark:text-orange-400">
                    <AlertCircle className="h-3 w-3" />
                    <span>Expires soon: {formatDate(prescription.expiresAt)}</span>
                  </div>
                )}
                {prescription.isExpired && prescription.expiresAt && (
                  <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                    <AlertCircle className="h-3 w-3" />
                    <span>Expired: {formatDate(prescription.expiresAt)}</span>
                  </div>
                )}

                {/* Medications */}
                {prescription.medications && prescription.medications.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      <Pill className="h-3 w-3 inline mr-1" />
                      Medications:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {prescription.medications.map((med: any, index: number) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {typeof med === 'string' ? med : med.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Prescribed By */}
                {prescription.prescribedBy && (
                  <p className="text-xs text-muted-foreground">
                    <User className="h-3 w-3 inline mr-1" />
                    Dr. {prescription.prescribedBy}
                  </p>
                )}

                {/* Notes */}
                {prescription.notes && (
                  <p className="text-xs text-muted-foreground italic">
                    {prescription.notes}
                  </p>
                )}

                {/* Verification Status */}
                {prescription.requiresVerification && !prescription.verifiedAt && (
                  <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded p-2">
                    <p className="text-xs text-yellow-700 dark:text-yellow-400">
                      Requires pharmacist verification
                    </p>
                  </div>
                )}

                {/* Actions */}
                {prescription.status === 'pending' && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleStatusChange(prescription.id, 'verified')}
                      disabled={updatePrescription.isPending}
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Verify
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleStatusChange(prescription.id, 'dispensed')}
                      disabled={updatePrescription.isPending}
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Dispense
                    </Button>
                  </div>
                )}
                {prescription.status === 'verified' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => handleStatusChange(prescription.id, 'dispensed')}
                    disabled={updatePrescription.isPending}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Mark as Dispensed
                  </Button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>

      {/* Image Preview Dialog */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Prescription: {selectedPrescription?.prescriptionNumber || `RX-${selectedPrescription?.id}`}
            </DialogTitle>
            <DialogDescription>
              {selectedPrescription?.prescribedDate && (
                <>Prescribed on {formatDate(selectedPrescription.prescribedDate)}</>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedPrescription?.imageUrl && (
            <div className="relative w-full">
              <img
                src={selectedPrescription.imageUrl}
                alt="Prescription"
                className="w-full h-auto rounded-lg"
              />
            </div>
          )}

          {selectedPrescription?.medications && selectedPrescription.medications.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Medications:</p>
              <div className="space-y-1">
                {selectedPrescription.medications.map((med: string | Medication, index: number) => (
                  <div key={index} className="text-sm">
                    {typeof med === 'string' ? (
                      <span>{med}</span>
                    ) : (
                      <div>
                        <span className="font-medium">{med.name}</span>
                        {med.dosage && <span className="text-muted-foreground"> - {med.dosage}</span>}
                        {med.frequency && <span className="text-muted-foreground"> ({med.frequency})</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedPrescription?.notes && (
            <div>
              <p className="text-sm font-medium mb-1">Notes:</p>
              <p className="text-sm text-muted-foreground">{selectedPrescription.notes}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
