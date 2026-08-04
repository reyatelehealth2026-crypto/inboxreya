/* Hallmark · pre-emit critique: P4 H5 E4 S4 R3 V4
 * genre: modern-minimal · macrostructure: Split Studio (glass shell variant)
 * theme: parity port of wholesale.re-ya.com/admin — navy diagonal + cobalt accent
 * source: cny-wholesale-nuxt/pages/admin/login.vue (user-directed parity port)
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass (40-41) · icons: lucide only (30) · tokens: pass (48)
 * copy: adapted to this product (LINE CRM inbox), not copied from wholesale
 */
"use client"

import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertCircle,
  ArrowUpRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  Plus,
  ShieldCheck,
  User,
} from 'lucide-react'
import Link from 'next/link'
import styles from './login.module.css'

function StoryRail() {
  return (
    <aside className={styles.story}>
      <span className={styles.brand}>
        <span className={styles.brandMark} aria-hidden="true">
          <Plus size={16} strokeWidth={2.5} />
        </span>
        <strong>CNY Pharmacy</strong>
      </span>

      <div>
        <span className={styles.kicker}>LINE CRM Inbox</span>
        <h1 className={styles.storyTitle}>
          ทุกแชทลูกค้า
          <br />
          <span className={styles.storyTitleAccent}>รวมอยู่ที่เดียว</span>
        </h1>
        <p className={styles.storyBody}>
          พื้นที่ทำงานสำหรับตอบแชทลูกค้า ดูแลข้อมูลลูกค้า และตรวจสลิปของ CNY
        </p>
      </div>

      <div className={styles.trust}>
        <span className={styles.trustIcon} aria-hidden="true">
          <ShieldCheck size={15} />
        </span>
        <span>เข้าถึงเฉพาะผู้ที่ได้รับสิทธิ์เท่านั้น</span>
      </div>
    </aside>
  )
}

function LoginCard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams?.get('callbackUrl') || '/dashboard'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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

  const wrapClass = error
    ? `${styles.inputWrap} ${styles.inputWrapError}`
    : styles.inputWrap

  return (
    <section className={styles.cardWrap}>
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <span className={styles.cardIcon} aria-hidden="true">
            <LockKeyhole size={19} />
          </span>
          <span className={`${styles.kicker} ${styles.kickerDark}`}>Secure sign in</span>
          <h2 id="login-title" className={styles.cardTitle}>
            เข้าสู่ระบบ
          </h2>
          <p className={styles.cardLede}>ใช้บัญชีพนักงานที่ได้รับจากผู้ดูแลระบบ</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label htmlFor="username">ชื่อผู้ใช้</label>
            <div className={wrapClass}>
              <User size={16} className={styles.fieldIcon} aria-hidden="true" />
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="กรอกชื่อผู้ใช้"
                required
                aria-required="true"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'login-error' : undefined}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="password">รหัสผ่าน</label>
            <div className={wrapClass}>
              <KeyRound size={16} className={styles.fieldIcon} aria-hidden="true" />
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="กรอกรหัสผ่าน"
                required
                aria-required="true"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'login-error' : undefined}
                disabled={isLoading}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                aria-pressed={showPassword}
                disabled={isLoading}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Reserved slot: the alert appears in place, without pushing the button down. */}
          <div className={styles.errorSlot} aria-live="polite">
            {error && (
              <p id="login-error" role="alert" className={styles.error}>
                <AlertCircle size={15} className={styles.errorIcon} aria-hidden="true" />
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            className={styles.submit}
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                <span>กำลังเข้าสู่ระบบ...</span>
              </>
            ) : (
              <>
                <span>เข้าสู่ระบบ</span>
                <span className={styles.submitArrow} aria-hidden="true">
                  <ArrowUpRight size={14} />
                </span>
              </>
            )}
          </button>
        </form>

        <p className={styles.help}>
          ยังไม่มีบัญชี?{' '}
          <Link href="/auth/register" className={styles.helpLink}>
            สมัครสมาชิก
          </Link>
        </p>
      </div>
    </section>
  )
}

export default function LoginPage() {
  return (
    <main className={styles.page} aria-labelledby="login-title">
      <div className={`${styles.orb} ${styles.orbOne}`} aria-hidden="true" />
      <div className={`${styles.orb} ${styles.orbTwo}`} aria-hidden="true" />
      <div className={styles.shell}>
        <StoryRail />
        <Suspense
          fallback={
            <section className={styles.cardWrap}>
              <Loader2 className="h-6 w-6 animate-spin motion-reduce:animate-none" />
              <span className="sr-only">กำลังโหลด</span>
            </section>
          }
        >
          <LoginCard />
        </Suspense>
      </div>
    </main>
  )
}
