import { NextRequest } from "next/server"
import { POST as createSnippePayment } from "../snippe/route"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  return createSnippePayment(request)
}
