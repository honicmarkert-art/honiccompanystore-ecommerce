import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST() {
  return NextResponse.json({ error: "This payment provider is no longer used." }, { status: 410 })
}

export async function GET() {
  return NextResponse.json({ error: "This payment provider is no longer used." }, { status: 410 })
}
