import { NextRequest, NextResponse } from "next/server"
import { 

// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
  isClickPesaConfigured,
  getConfigStatus,
  CLICKPESA_CLIENT_ID,
  CLICKPESA_API_KEY,
  CLICKPESA_CHECKSUM_KEY
} from "@/lib/clickpesa-api"

// GET /api/debug/clickpesa - Debug ClickPesa configuration and connectivity
export async function GET(request: NextRequest) {
  try {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      configuration: {
        isConfigured: isClickPesaConfigured(),
        configStatus: getConfigStatus(),
        hasClientId: Boolean(CLICKPESA_CLIENT_ID),
        hasApiKey: Boolean(CLICKPESA_API_KEY),
        hasChecksumKey: Boolean(CLICKPESA_CHECKSUM_KEY),
        clientIdPreview: CLICKPESA_CLIENT_ID ? `${CLICKPESA_CLIENT_ID.substring(0, 8)}...` : 'Not set',
        apiKeyPreview: CLICKPESA_API_KEY ? `${CLICKPESA_API_KEY.substring(0, 8)}...` : 'Not set',
        checksumKeyPreview: CLICKPESA_CHECKSUM_KEY ? `${CLICKPESA_CHECKSUM_KEY.substring(0, 8)}...` : 'Not set'
      },
      environmentVariables: {
        NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
        SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        CLICKPESA_CLIENT_ID: Boolean(process.env.CLICKPESA_CLIENT_ID),
        CLICKPESA_API_KEY: Boolean(process.env.CLICKPESA_API_KEY),
        CLICKPESA_CHECKSUM_KEY: Boolean(process.env.CLICKPESA_CHECKSUM_KEY),
        CLICKPESA_WEBHOOK_SECRET: Boolean(process.env.CLICKPESA_WEBHOOK_SECRET)
      }
    }

    return NextResponse.json({
      success: true,
      debug: debugInfo
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: "Debug failed",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// POST /api/debug/clickpesa - Test ClickPesa API connectivity
export async function POST(request: NextRequest) {
  try {
    const { testType } = await request.json()

    switch (testType) {
      case 'config':
        return await testConfiguration()
      
      case 'connectivity':
        return await testConnectivity()
      
      case 'token':
        return await testTokenGeneration()
      
      default:
        return NextResponse.json({
          success: false,
          error: "Invalid test type. Supported types: config, connectivity, token"
        }, { status: 400 })
    }

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: "Test failed",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

async function testConfiguration() {
  const configStatus = getConfigStatus()
  
  return NextResponse.json({
    success: true,
    testType: 'config',
    result: {
      isConfigured: isClickPesaConfigured(),
      configStatus,
      issues: findConfigurationIssues(configStatus)
    }
  })
}

async function testConnectivity() {
  try {
    // Test basic connectivity to ClickPesa API
    const response = await fetch('https://api.clickpesa.com/health', {
      method: 'GET',
      headers: {
        'User-Agent': 'HonicCo-Debug/1.0'
      },
      timeout: 10000 // 10 second timeout
    })

    const responseText = await response.text()
    
    return NextResponse.json({
      success: true,
      testType: 'connectivity',
      result: {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseText.substring(0, 500), // First 500 chars
        isJson: isJsonString(responseText),
        connectivity: response.ok ? 'success' : 'failed'
      }
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      testType: 'connectivity',
      error: error instanceof Error ? error.message : String(error),
      result: {
        connectivity: 'failed',
        errorType: error instanceof Error ? error.constructor.name : 'Unknown'
      }
    })
  }
}

async function testTokenGeneration() {
  try {
    // Test token generation
    const response = await fetch('https://api.clickpesa.com/third-parties/generate-token', {
      method: 'POST',
      headers: {
        'api-key': CLICKPESA_API_KEY,
        'client-id': CLICKPESA_CLIENT_ID,
        'Content-Type': 'application/json'
      }
    })

    const responseText = await response.text()
    
    return NextResponse.json({
      success: response.ok,
      testType: 'token',
      result: {
        status: response.status,
        statusText: response.statusText,
        body: responseText.substring(0, 500),
        isJson: isJsonString(responseText),
        tokenGeneration: response.ok ? 'success' : 'failed'
      }
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      testType: 'token',
      error: error instanceof Error ? error.message : String(error),
      result: {
        tokenGeneration: 'failed',
        errorType: error instanceof Error ? error.constructor.name : 'Unknown'
      }
    })
  }
}

function findConfigurationIssues(configStatus: any): string[] {
  const issues: string[] = []
  
  if (!configStatus.hasAccessToken) issues.push('Missing access token')
  if (!configStatus.hasClientId) issues.push('Missing client ID')
  if (!configStatus.hasApiKey) issues.push('Missing API key')
  if (!configStatus.hasChecksumKey) issues.push('Missing checksum key')
  
  return issues
}

function isJsonString(str: string): boolean {
  try {
    JSON.parse(str)
    return true
  } catch {
    return false
  }
}







