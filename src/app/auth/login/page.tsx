/* Hallmark · pre-emit critique: P4 H5 E4 S4 R3 V4
 * genre: modern-minimal · macrostructure: Split Studio (glass shell variant)
 * theme: verbatim parity port of wholesale.re-ya.com/admin
 * source: cny-wholesale-nuxt/pages/admin/login.vue — copy AND iconography are
 * reproduced as-is at the user's direction, so the two sign-ins are one screen.
 * icons: Bootstrap Icons 1.11.3 paths inlined (MIT) — the source app's set, and
 * inlining nine glyphs beats pulling in the whole icon font for one page.
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass (40-41) · tokens: pass (48)
 */
"use client"

import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import styles from './login.module.css'

/* ---------- Bootstrap Icons (1.11.3) ---------- */

type IconProps = { size?: number; className?: string }

function Icon({ size = 16, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      fill="currentColor"
      viewBox="0 0 16 16"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

const PlusLg = (p: IconProps) => (
  <Icon {...p}>
    <path fillRule="evenodd" d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2" />
  </Icon>
)

const ShieldCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5.338 1.59a61 61 0 0 0-2.837.856.48.48 0 0 0-.328.39c-.554 4.157.726 7.19 2.253 9.188a10.7 10.7 0 0 0 2.287 2.233c.346.244.652.42.893.533q.18.085.293.118a1 1 0 0 0 .101.025 1 1 0 0 0 .1-.025q.114-.034.294-.118c.24-.113.547-.29.893-.533a10.7 10.7 0 0 0 2.287-2.233c1.527-1.997 2.807-5.031 2.253-9.188a.48.48 0 0 0-.328-.39c-.651-.213-1.75-.56-2.837-.855C9.552 1.29 8.531 1.067 8 1.067c-.53 0-1.552.223-2.662.524zM5.072.56C6.157.265 7.31 0 8 0s1.843.265 2.928.56c1.11.3 2.229.655 2.887.87a1.54 1.54 0 0 1 1.044 1.262c.596 4.477-.787 7.795-2.465 9.99a11.8 11.8 0 0 1-2.517 2.453 7 7 0 0 1-1.048.625c-.28.132-.581.24-.829.24s-.548-.108-.829-.24a7 7 0 0 1-1.048-.625 11.8 11.8 0 0 1-2.517-2.453C1.928 10.487.545 7.169 1.141 2.692A1.54 1.54 0 0 1 2.185 1.43 63 63 0 0 1 5.072.56" />
    <path d="M10.854 5.146a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7.5 7.793l2.646-2.647a.5.5 0 0 1 .708 0" />
  </Icon>
)

const PersonLock = (p: IconProps) => (
  <Icon {...p}>
    <path d="M11 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0M8 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4m0 5.996V14H3s-1 0-1-1 1-4 6-4q.845.002 1.544.107a4.5 4.5 0 0 0-.803.918A11 11 0 0 0 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664zM9 13a1 1 0 0 1 1-1v-1a2 2 0 1 1 4 0v1a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1zm3-3a1 1 0 0 0-1 1v1h2v-1a1 1 0 0 0-1-1" />
  </Icon>
)

const Person = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6m2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0m4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4m-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10s-3.516.68-4.168 1.332c-.678.678-.83 1.418-.832 1.664z" />
  </Icon>
)

const Key = (p: IconProps) => (
  <Icon {...p}>
    <path d="M0 8a4 4 0 0 1 7.465-2H14a.5.5 0 0 1 .354.146l1.5 1.5a.5.5 0 0 1 0 .708l-1.5 1.5a.5.5 0 0 1-.708 0L13 9.207l-.646.647a.5.5 0 0 1-.708 0L11 9.207l-.646.647a.5.5 0 0 1-.708 0L9 9.207l-.646.647A.5.5 0 0 1 8 10h-.535A4 4 0 0 1 0 8m4-3a3 3 0 1 0 2.712 4.285A.5.5 0 0 1 7.163 9h.63l.853-.854a.5.5 0 0 1 .708 0l.646.647.646-.647a.5.5 0 0 1 .708 0l.646.647.646-.647a.5.5 0 0 1 .708 0l.646.647.793-.793-1-1h-6.63a.5.5 0 0 1-.451-.285A3 3 0 0 0 4 5" />
    <path d="M4 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0" />
  </Icon>
)

const Eye = (p: IconProps) => (
  <Icon {...p}>
    <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8M1.173 8a13 13 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5s3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8q-.086.13-.195.288c-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5s-3.879-1.168-5.168-2.457A13 13 0 0 1 1.172 8z" />
    <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0" />
  </Icon>
)

const EyeSlash = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7 7 0 0 0-2.79.588l.77.771A6 6 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8q-.086.13-.195.288c-.335.48-.83 1.12-1.465 1.755q-.247.248-.517.486z" />
    <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829" />
    <path d="M3.35 5.47q-.27.24-.518.487A13 13 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7 7 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12z" />
  </Icon>
)

const ExclamationCircle = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16" />
    <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0M7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0z" />
  </Icon>
)

const ArrowUpRight = (p: IconProps) => (
  <Icon {...p}>
    <path fillRule="evenodd" d="M14 2.5a.5.5 0 0 0-.5-.5h-6a.5.5 0 0 0 0 1h4.793L2.146 13.146a.5.5 0 0 0 .708.708L13 3.707V8.5a.5.5 0 0 0 1 0z" />
  </Icon>
)

/* ---------- page ---------- */

function StoryRail() {
  return (
    <aside className={styles.story}>
      <span className={styles.brand}>
        <span className={styles.brandMark} aria-hidden="true">
          <PlusLg size={15} />
        </span>
        <strong>CNY Pharmacy</strong>
      </span>

      <div>
        <span className={styles.kicker}>Operations workspace</span>
        <h1 className={styles.storyTitle}>
          ทุกงานหลังบ้าน
          <br />
          <em className={styles.storyTitleAccent}>ชัดเจนและเป็นจังหวะ</em>
        </h1>
        <p className={styles.storyBody}>
          พื้นที่ทำงานสำหรับติดตามคำสั่งซื้อ ดูแลสินค้า และควบคุมโปรโมชันของ CNY ขายส่ง
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

      setError('เข้าสู่ระบบไม่สำเร็จ โปรดตรวจสอบชื่อผู้ใช้และรหัสผ่าน')
      setIsLoading(false)
    } catch (err) {
      console.error('Login error:', err)
      setError('เข้าสู่ระบบไม่สำเร็จ โปรดตรวจสอบชื่อผู้ใช้และรหัสผ่าน')
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
            <PersonLock size={19} />
          </span>
          <span className={`${styles.kicker} ${styles.kickerDark}`}>Secure sign in</span>
          <h2 id="login-title" className={styles.cardTitle}>
            เข้าสู่ระบบผู้ดูแล
          </h2>
          <p className={styles.cardLede}>ใช้บัญชีที่องค์กรกำหนดให้เพื่อไปยังแดชบอร์ด</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label htmlFor="username">ชื่อผู้ใช้</label>
            <div className={wrapClass}>
              <Person className={styles.fieldIcon} />
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
              <Key className={styles.fieldIcon} />
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
                {showPassword ? <EyeSlash size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div className={styles.errorSlot} aria-live="polite">
            {error && (
              <p id="login-error" role="alert" className={styles.error}>
                <ExclamationCircle size={15} className={styles.errorIcon} />
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
            {isLoading && <span className={styles.spinner} aria-hidden="true" />}
            <span>{isLoading ? 'กำลังตรวจสอบบัญชี…' : 'เข้าสู่พื้นที่ทำงาน'}</span>
            {!isLoading && (
              <span className={styles.submitArrow} aria-hidden="true">
                <ArrowUpRight size={14} />
              </span>
            )}
          </button>
        </form>

        <p className={styles.help}>มีปัญหาในการเข้าถึง? ติดต่อผู้ดูแลระบบของคุณ</p>
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
              <span className={styles.spinner} aria-hidden="true" />
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
