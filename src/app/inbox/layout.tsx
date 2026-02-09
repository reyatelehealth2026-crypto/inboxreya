import { ReactNode } from "react"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import InboxLayoutClient from "./InboxLayoutClient"

export default async function InboxLayout({ children }: { children: ReactNode }) {
  const session = await auth()

  if (!session?.user) {
    redirect("/auth/login")
  }

  return <InboxLayoutClient>{children}</InboxLayoutClient>
}
