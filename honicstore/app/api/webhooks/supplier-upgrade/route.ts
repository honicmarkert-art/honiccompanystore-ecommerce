import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST() {
  return NextResponse.json(
    { error: "Supplier payments are confirmed by the Snippe webhook." },
    { status: 410 }
  )
}
