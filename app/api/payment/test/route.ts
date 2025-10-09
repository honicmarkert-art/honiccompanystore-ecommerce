import { NextRequest, NextResponse } from "next/server"
import { 
  tokenizeCard, 
  getTokenizedCard, 
  processPaymentWithToken,
  deletePaymentToken,
  getTokenStats,
  type CardDetails 
} from '@/lib/payment-tokenization'
import { Logger } from '@/lib/error-handler'

// GET /api/payment/test - Test payment tokenization system
export async function GET(request: NextRequest) {
  const logger = Logger.getInstance()
  
  try {
    // Test card details (using test card numbers)
    const testCardDetails: CardDetails = {
      number: "4111111111111111", // Visa test card
      expiryMonth: 12,
      expiryYear: 2025,
      cvv: "123",
      holderName: "Test User"
    }

    // Test tokenization
    const token = tokenizeCard(testCardDetails)
    logger.info('Test tokenization successful', { tokenId: token.token })

    // Test token retrieval
    const retrievedCard = getTokenizedCard(token.token)
    logger.info('Test token retrieval successful', { tokenId: token.token })

    // Test payment processing
    const paymentResult = await processPaymentWithToken(token.token, 1000, 'TZS', 'TEST_ORDER_123')
    logger.info('Test payment processing completed', { 
      tokenId: token.token, 
      success: paymentResult.success,
      transactionId: paymentResult.transactionId
    })

    // Get token stats
    const stats = getTokenStats()

    // Clean up test token
    deletePaymentToken(token.token)

    return NextResponse.json({
      success: true,
      message: "Payment tokenization system test completed successfully",
      results: {
        tokenization: {
          success: true,
          tokenId: token.token,
          last4: token.last4,
          brand: token.brand,
          expiresAt: token.expiresAt
        },
        retrieval: {
          success: !!retrievedCard,
          cardData: retrievedCard
        },
        payment: {
          success: paymentResult.success,
          transactionId: paymentResult.transactionId,
          error: paymentResult.error
        },
        stats: stats
      }
    })

  } catch (error) {
    logger.error('Payment tokenization test failed', error instanceof Error ? error : new Error(String(error)))
    
    return NextResponse.json({
      success: false,
      error: "Test failed",
      details: process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : String(error)) : undefined
    }, { status: 500 })
  }
}

// POST /api/payment/test - Test specific payment scenarios
export async function POST(request: NextRequest) {
  const logger = Logger.getInstance()
  
  try {
    const { scenario } = await request.json()
    
    switch (scenario) {
      case 'invalid_card':
        return await testInvalidCard(logger)
      
      case 'expired_token':
        return await testExpiredToken(logger)
      
      case 'payment_failure':
        return await testPaymentFailure(logger)
      
      default:
        return NextResponse.json({
          success: false,
          error: "Invalid test scenario. Supported scenarios: invalid_card, expired_token, payment_failure"
        }, { status: 400 })
    }

  } catch (error) {
    logger.error('Payment test scenario failed', error instanceof Error ? error : new Error(String(error)))
    
    return NextResponse.json({
      success: false,
      error: "Test scenario failed",
      details: process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : String(error)) : undefined
    }, { status: 500 })
  }
}

async function testInvalidCard(logger: Logger) {
  try {
    const invalidCardDetails: CardDetails = {
      number: "1234567890123456", // Invalid card number
      expiryMonth: 12,
      expiryYear: 2025,
      cvv: "123",
      holderName: "Test User"
    }

    // This should throw an error
    tokenizeCard(invalidCardDetails)
    
    return NextResponse.json({
      success: false,
      error: "Expected error for invalid card, but tokenization succeeded"
    })

  } catch (error) {
    logger.info('Invalid card test passed - error thrown as expected', { 
      error: error instanceof Error ? error.message : String(error) 
    })
    
    return NextResponse.json({
      success: true,
      message: "Invalid card test passed - error thrown as expected",
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

async function testExpiredToken(logger: Logger) {
  try {
    // Try to get a non-existent token
    const retrievedCard = getTokenizedCard('non-existent-token')
    
    if (retrievedCard === null) {
      logger.info('Expired token test passed - null returned as expected')
      
      return NextResponse.json({
        success: true,
        message: "Expired token test passed - null returned as expected"
      })
    } else {
      return NextResponse.json({
        success: false,
        error: "Expected null for non-existent token, but got data"
      })
    }

  } catch (error) {
    logger.error('Expired token test failed', error instanceof Error ? error : new Error(String(error)))
    
    return NextResponse.json({
      success: false,
      error: "Expired token test failed",
      details: error instanceof Error ? error.message : String(error)
    })
  }
}

async function testPaymentFailure(logger: Logger) {
  try {
    // Create a valid token
    const testCardDetails: CardDetails = {
      number: "4111111111111111",
      expiryMonth: 12,
      expiryYear: 2025,
      cvv: "123",
      holderName: "Test User"
    }

    const token = tokenizeCard(testCardDetails)
    
    // Process payment multiple times to increase chance of failure
    const results = []
    for (let i = 0; i < 10; i++) {
      const result = await processPaymentWithToken(token.token, 1000, 'TZS', `TEST_ORDER_${i}`)
      results.push(result)
    }
    
    const failures = results.filter(r => !r.success)
    const successes = results.filter(r => r.success)
    
    logger.info('Payment failure test completed', { 
      totalAttempts: results.length,
      failures: failures.length,
      successes: successes.length
    })
    
    return NextResponse.json({
      success: true,
      message: "Payment failure test completed",
      results: {
        totalAttempts: results.length,
        failures: failures.length,
        successes: successes.length,
        failureRate: `${((failures.length / results.length) * 100).toFixed(1)}%`
      }
    })

  } catch (error) {
    logger.error('Payment failure test failed', error instanceof Error ? error : new Error(String(error)))
    
    return NextResponse.json({
      success: false,
      error: "Payment failure test failed",
      details: error instanceof Error ? error.message : String(error)
    })
  }
}







