import Link from "next/link"

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  const error = Array.isArray(params.error) ? params.error[0] : params.error

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-white/10 bg-black/40 p-6">
        <h1 className="text-xl font-semibold text-white">Login error</h1>
        <p className="mt-2 text-sm text-white/70">
          {error ? (
            <>
              Error code: <span className="font-mono">{error}</span>
            </>
          ) : (
            "An authentication error occurred."
          )}
        </p>

        {error === "Configuration" ? (
          <p className="mt-3 text-sm text-white/70">
            This usually means your deployment is missing auth environment
            variables. Check Vercel env: <span className="font-mono">AUTH_SECRET</span>{" "}
            (or <span className="font-mono">NEXTAUTH_SECRET</span>) and{" "}
            <span className="font-mono">NEXTAUTH_URL</span>.
          </p>
        ) : null}

        <div className="mt-6 flex gap-3">
          <Link
            href="/auth/login"
            className="inline-flex items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-medium text-black"
          >
            Back to login
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-white/15 px-4 py-2 text-sm font-medium text-white"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  )
}

