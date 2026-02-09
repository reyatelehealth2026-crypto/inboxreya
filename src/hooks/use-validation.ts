/**
 * Hook for form validation with Zod schemas
 */

import { useState, useCallback } from 'react'
import { z } from 'zod'
import { validateSafe, getValidationErrors } from '@/lib/validation'

export function useValidation<T>(schema: z.ZodSchema<T>) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isValid, setIsValid] = useState(true)

  const validate = useCallback((data: unknown): data is T => {
    const result = validateSafe(schema, data)

    if (result.success) {
      setErrors({})
      setIsValid(true)
      return true
    }

    setErrors(getValidationErrors(result.errors))
    setIsValid(false)
    return false
  }, [schema])

  const clearErrors = useCallback(() => {
    setErrors({})
    setIsValid(true)
  }, [])

  const setFieldError = useCallback((field: string, message: string) => {
    setErrors((prev) => ({ ...prev, [field]: message }))
    setIsValid(false)
  }, [])

  const clearFieldError = useCallback((field: string) => {
    setErrors((prev) => {
      const newErrors = { ...prev }
      delete newErrors[field]
      return newErrors
    })
  }, [])

  return {
    validate,
    errors,
    isValid,
    clearErrors,
    setFieldError,
    clearFieldError,
  }
}

/**
 * Hook for validating form fields on change
 */
export function useFieldValidation<T extends Record<string, any>>(
  schema: z.ZodSchema<T>
) {
  const [values, setValues] = useState<Partial<T>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const validateField = useCallback((field: keyof T, value: any) => {
    try {
      // Validate the entire object with the single field
      // This is a simplified approach
      const testData = { ...values, [field]: value }
      schema.parse(testData)
      
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field as string]
        return newErrors
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldError = error.issues.find((issue) => 
          issue.path.includes(field as string)
        )
        if (fieldError) {
          setErrors((prev) => ({
            ...prev,
            [field as string]: fieldError.message,
          }))
        }
      }
    }
  }, [schema, values])

  const setValue = useCallback((field: keyof T, value: any) => {
    setValues((prev) => ({ ...prev, [field]: value }))
    
    // Validate if field has been touched
    if (touched[field as string]) {
      validateField(field, value)
    }
  }, [touched, validateField])

  const setTouchedField = useCallback((field: keyof T) => {
    setTouched((prev) => ({ ...prev, [field as string]: true }))
    
    // Validate on blur
    if (values[field] !== undefined) {
      validateField(field, values[field])
    }
  }, [values, validateField])

  const validateAll = useCallback((): boolean => {
    const result = validateSafe(schema, values)

    if (result.success) {
      setErrors({})
      return true
    }

    setErrors(getValidationErrors(result.errors))
    
    // Mark all fields as touched
    const allTouched: Record<string, boolean> = {}
    Object.keys(values).forEach((key) => {
      allTouched[key] = true
    })
    setTouched(allTouched)

    return false
  }, [schema, values])

  const reset = useCallback(() => {
    setValues({})
    setErrors({})
    setTouched({})
  }, [])

  return {
    values,
    errors,
    touched,
    setValue,
    setTouchedField,
    validateAll,
    reset,
    isValid: Object.keys(errors).length === 0,
  }
}
