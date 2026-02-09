/**
 * Template Utilities
 * 
 * Functions for working with quick reply templates including
 * variable substitution and shortcut detection.
 */

export interface TemplateVariable {
  name: string
  value: string
}

/**
 * Extract variables from template content
 * Variables are in the format {{variable_name}}
 */
export function extractVariables(content: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g
  const variables: string[] = []
  let match

  while ((match = regex.exec(content)) !== null) {
    const varName = match[1].trim()
    if (!variables.includes(varName)) {
      variables.push(varName)
    }
  }

  return variables
}

/**
 * Substitute variables in template content
 * Replaces {{variable_name}} with provided values
 */
export function substituteVariables(
  content: string,
  variables: TemplateVariable[]
): string {
  let result = content

  for (const variable of variables) {
    const regex = new RegExp(`\\{\\{\\s*${variable.name}\\s*\\}\\}`, 'g')
    result = result.replace(regex, variable.value)
  }

  return result
}

/**
 * Check if content has unsubstituted variables
 */
export function hasUnsubstitutedVariables(content: string): boolean {
  return /\{\{[^}]+\}\}/.test(content)
}

/**
 * Get list of unsubstituted variables
 */
export function getUnsubstitutedVariables(content: string): string[] {
  return extractVariables(content)
}

/**
 * Detect if input matches a template shortcut
 * Shortcuts typically start with / or #
 */
export function detectShortcut(input: string): string | null {
  const trimmed = input.trim()
  
  // Check for shortcuts starting with / or #
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) {
    return trimmed.substring(1).toLowerCase()
  }

  return null
}

/**
 * Match input against template shortcuts
 */
export function matchShortcut(
  input: string,
  shortcuts: string[]
): boolean {
  const detected = detectShortcut(input)
  if (!detected) return false

  return shortcuts.some(shortcut => 
    shortcut.toLowerCase() === detected ||
    shortcut.toLowerCase().startsWith(detected)
  )
}

/**
 * Filter templates by shortcut match
 */
export function filterTemplatesByShortcut<T extends { shortcuts?: string[] }>(
  templates: T[],
  input: string
): T[] {
  const detected = detectShortcut(input)
  if (!detected) return []

  return templates.filter(template => {
    if (!template.shortcuts || template.shortcuts.length === 0) {
      return false
    }

    return template.shortcuts.some(shortcut =>
      shortcut.toLowerCase().startsWith(detected)
    )
  })
}

/**
 * Prepare template for use
 * Extracts variables and prepares content for substitution
 */
export function prepareTemplate(content: string): {
  content: string
  variables: string[]
  needsSubstitution: boolean
} {
  const variables = extractVariables(content)
  
  return {
    content,
    variables,
    needsSubstitution: variables.length > 0,
  }
}

/**
 * Validate template content
 */
export function validateTemplateContent(content: string): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!content || content.trim().length === 0) {
    errors.push('Template content cannot be empty')
  }

  if (content.length > 5000) {
    errors.push('Template content is too long (max 5000 characters)')
  }

  // Check for malformed variables
  const openBraces = (content.match(/\{\{/g) || []).length
  const closeBraces = (content.match(/\}\}/g) || []).length

  if (openBraces !== closeBraces) {
    errors.push('Template has malformed variables (mismatched braces)')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Format template for display
 * Truncates long content and shows variable count
 */
export function formatTemplatePreview(
  content: string,
  maxLength: number = 100
): string {
  const variables = extractVariables(content)
  let preview = content

  if (content.length > maxLength) {
    preview = content.substring(0, maxLength) + '...'
  }

  if (variables.length > 0) {
    preview += ` (${variables.length} variable${variables.length > 1 ? 's' : ''})`
  }

  return preview
}
