"use client"

import { useState } from 'react'
import { Heart, AlertTriangle, Pill, Activity, Edit2, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useHealthProfile, useUpdateHealthProfile } from '@/hooks/use-health-profile'

interface HealthProfileSectionProps {
  userId: string
}

export function HealthProfileSection({ userId }: HealthProfileSectionProps) {
  const { data: profile, isLoading } = useHealthProfile(userId)
  const updateProfile = useUpdateHealthProfile(userId)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    age: '',
    gender: '',
    weight: '',
    height: '',
    bloodType: '',
    medicalConditions: [] as string[],
  })

  const handleEdit = () => {
    if (profile) {
      setFormData({
        age: profile.age?.toString() || '',
        gender: profile.gender || '',
        weight: profile.weight?.toString() || '',
        height: profile.height?.toString() || '',
        bloodType: profile.bloodType || '',
        medicalConditions: profile.medicalConditions || [],
      })
    }
    setIsEditing(true)
  }

  const handleSave = async () => {
    await updateProfile.mutateAsync({
      age: formData.age ? parseInt(formData.age) : undefined,
      gender: formData.gender || undefined,
      weight: formData.weight ? parseFloat(formData.weight) : undefined,
      height: formData.height ? parseFloat(formData.height) : undefined,
      bloodType: formData.bloodType || undefined,
      medicalConditions: formData.medicalConditions,
    })
    setIsEditing(false)
  }

  const handleCancel = () => {
    setIsEditing(false)
  }

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </Card>
    )
  }

  if (!profile) {
    return (
      <Card className="p-4">
        <div className="text-center text-sm text-muted-foreground">
          <Heart className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No health profile available</p>
          <Button size="sm" className="mt-2" onClick={handleEdit}>
            Add Health Profile
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 text-red-500" />
          <h3 className="font-semibold text-sm">Health Profile</h3>
        </div>
        {!isEditing ? (
          <Button size="sm" variant="ghost" onClick={handleEdit}>
            <Edit2 className="h-3 w-3" />
          </Button>
        ) : (
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={handleSave} disabled={updateProfile.isPending}>
              <Save className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancel}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Completeness Indicator */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-muted-foreground">Profile Completeness</span>
          <span className="font-medium">{profile.completeness}%</span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all",
              profile.completeness >= 80 ? "bg-green-500" :
              profile.completeness >= 50 ? "bg-yellow-500" :
              "bg-red-500"
            )}
            style={{ width: `${profile.completeness}%` }}
          />
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="age" className="text-xs">Age</Label>
              <Input
                id="age"
                type="number"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="gender" className="text-xs">Gender</Label>
              <select
                id="gender"
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="weight" className="text-xs">Weight (kg)</Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="height" className="text-xs">Height (cm)</Label>
              <Input
                id="height"
                type="number"
                step="0.1"
                value={formData.height}
                onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="bloodType" className="text-xs">Blood Type</Label>
            <select
              id="bloodType"
              value={formData.bloodType}
              onChange={(e) => setFormData({ ...formData, bloodType: e.target.value })}
              className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Select</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="AB">AB</option>
              <option value="O">O</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
            </select>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {profile.age && (
              <div>
                <p className="text-xs text-muted-foreground">Age</p>
                <p className="font-medium">{profile.age} years</p>
              </div>
            )}
            {profile.gender && (
              <div>
                <p className="text-xs text-muted-foreground">Gender</p>
                <p className="font-medium capitalize">{profile.gender}</p>
              </div>
            )}
            {profile.weight && (
              <div>
                <p className="text-xs text-muted-foreground">Weight</p>
                <p className="font-medium">{profile.weight} kg</p>
              </div>
            )}
            {profile.height && (
              <div>
                <p className="text-xs text-muted-foreground">Height</p>
                <p className="font-medium">{profile.height} cm</p>
              </div>
            )}
            {profile.bloodType && (
              <div>
                <p className="text-xs text-muted-foreground">Blood Type</p>
                <p className="font-medium">{profile.bloodType}</p>
              </div>
            )}
          </div>

          {/* Medical Conditions */}
          {profile.medicalConditions && profile.medicalConditions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-3 w-3 text-orange-500" />
                <p className="text-xs font-medium text-muted-foreground">Medical Conditions</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {profile.medicalConditions.map((condition, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {condition}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Allergies Warning */}
          {profile.allergies && profile.allergies.length > 0 && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-md p-2">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-3 w-3 text-red-500" />
                <p className="text-xs font-medium text-red-700 dark:text-red-400">Drug Allergies</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {profile.allergies.map((allergy, index) => (
                  <Badge key={index} variant="destructive" className="text-xs">
                    {allergy}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Current Medications */}
          {profile.currentMedications && profile.currentMedications.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Pill className="h-3 w-3 text-blue-500" />
                <p className="text-xs font-medium text-muted-foreground">Current Medications</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {profile.currentMedications.map((medication, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {medication}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Communication Type */}
          {profile.communicationType && (
            <div className="text-xs text-muted-foreground">
              Communication Style: <span className="font-medium">{profile.communicationType}</span>
              {profile.confidence && (
                <span className="ml-1">({Math.round(profile.confidence * 100)}% confidence)</span>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
