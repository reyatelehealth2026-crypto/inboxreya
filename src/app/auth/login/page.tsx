/* Hallmark · pre-emit critique: P5 H5 E4 S4 R5 V5
 * genre: modern-minimal · macrostructure: Split Studio · theme: project palette
 * (slate ink + LINE green accent) · enrichment: none · scope: app/auth
 * design-system: src/app/globals.css shadcn tokens · designed-as-app
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass (40-41) · honest: pass (46) · chrome: pass (47) · tokens: pass (48)
 * responsive: pass (49-53) · icons: pass (30) · mobile: pass (34 page-local, 49, 50-57)
 * known deviation: display face is Inter/Noto Sans Thai, preserved from pre-flight
 * (gate 1 waived - the project's font stack is not a Hallmark pick)
 */
"use client"

import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const MODULES = ['กล่องข้อความ', 'ลูกค้า', 'ศูนย์สลิป'] as const

function SystemRail() {
  return (
    <aside className="flex shrink-0 flex-col justify-between bg-primary px-6 py-8 text-primary-foreground lg:w-[380px] lg:px-10 lg:py-12">
      <div>
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="h-2 w-2 shrink-0 rounded-full bg-line"
          />
          <span className="text-sm font-semibold tracking-[0.18em]">INBOX</span>
        </div>

        <p className="mt-6 min-w-0 max-w-[22ch] text-balance text-xl font-semibold leading-snug tracking-tight [overflow-wrap:anywhere] lg:mt-10 lg:text-3xl">
          ระบบกล่องข้อความ LINE สำหรับร้านยา
        </p>

        <p className="mt-3 text-sm text-primary-foreground/60">
          LINE CRM Pharmacy Inbox System
        </p>
      </div>

      <ul className="mt-8 hidden border-t border-primary-foreground/15 lg:block">
        {MODULES.map((name) => (
          <li
            key={name}
            className="border-b border-primary-foreground/15 py-3 text-sm text-primary-foreground/75"
          >
            {name}
          </li>
        ))}
      </ul>
    </aside>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams?.get('callbackUrl') || '/dashboard'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false,
      })

      if (result?.ok && !result.error) {
        // Keep the button in its loading state through navigation so it never
        // flickers back to idle while the route transition is in flight.
        router.push(callbackUrl)
        router.refresh()
        return
      }

      setError(
        result?.error
          ? 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
          : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'
      )
      setIsLoading(false)
    } catch (err) {
      console.error('Login error:', err)
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
      setIsLoading(false)
    }
  }

  const fieldClass =
    // 44px is pinned, not h-11: the rem-based scale resolves differently for the
    // input and the button, and a form whose field is shorter than its submit
    // button reads untuned. 44px is also the touch-target floor.
    'h-[44px] rounded-md text-base transition-colors motion-reduce:transition-none hover:bg-muted/50 focus-visible:bg-background aria-[invalid=true]:border-destructive'

  return (
    <main className="flex min-w-0 flex-1 items-center px-6 py-10 lg:px-14 lg:py-12">
      <div className="w-full max-w-sm">
        <h1 className="min-w-0 text-2xl font-semibold tracking-tight [overflow-wrap:anywhere]">
          เข้าสู่ระบบ
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          ใช้บัญชีพนักงานที่ได้รับจากผู้ดูแลระบบ
        </p>

        <form onSubmit={handleSubmit} className="mt-4" noValidate>
          {/* Reserved slot: the alert appears in place, without pushing the fields down. */}
          <div className="min-h-[52px] pt-2" aria-live="polite">
            {/* Message text stays ink, not destructive-red: red-on-tinted-red
                measures 3.85:1, under the 4.5:1 floor. The border and tint carry
                the colour signal; role/aria carry it non-visually. */}
            {error && (
              <p
                id="login-error"
                role="alert"
                className="rounded-md border border-destructive/60 bg-destructive/10 px-3 py-2.5 text-sm text-foreground"
              >
                {error}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="username" className="block text-sm font-medium">
              ชื่อผู้ใช้
            </label>
            <Input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              aria-required="true"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'login-error' : undefined}
              disabled={isLoading}
              className={fieldClass}
            />
          </div>

          <div className="mt-4 space-y-1.5">
            <label htmlFor="password" className="block text-sm font-medium">
              รหัสผ่าน
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              aria-required="true"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'login-error' : undefined}
              disabled={isLoading}
              className={fieldClass}
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            aria-busy={isLoading}
            className="mt-6 h-[44px] w-full text-base active:translate-y-px motion-reduce:transition-none"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                กำลังเข้าสู่ระบบ...
              </>
            ) : (
              'เข้าสู่ระบบ'
            )}
          </Button>
        </form>

        <p className="mt-8 border-t pt-5 text-sm text-muted-foreground">
          ยังไม่มีบัญชี?{' '}
          <Link
            href="/auth/register"
            className="whitespace-nowrap font-medium text-foreground underline underline-offset-4 hover:decoration-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            สมัครสมาชิก
          </Link>
        </p>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    // Flex, not an arbitrary grid template: this app lets users change the root
    // font size, so rem-based track sizing drifts. Fixed px rail + flexible main.
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <SystemRail />
      <Suspense
        fallback={
          <div className="flex min-w-0 flex-1 items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin motion-reduce:animate-none text-muted-foreground" />
            <span className="sr-only">กำลังโหลด</span>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  )
}
