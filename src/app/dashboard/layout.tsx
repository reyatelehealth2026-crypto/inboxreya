import { ReactNode } from "react"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import DashboardLayoutClient from "./DashboardLayoutClient"

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth()

  if (!session?.user) {
    redirect("/auth/login")
  }

  return <DashboardLayoutClient>{children}</DashboardLayoutClient>
}
