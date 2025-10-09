import { NextRequest, NextResponse } from "next/server"
import { dbOptimizer } from '@/lib/database-optimizer'
import { cache } from '@/lib/cache'
import { measurePerformance } from '@/lib/error-handler'
import { Logger } from '@/lib/error-handler'

// GET /api/performance/test - Test performance optimizations
export async function GET(request: NextRequest) {
  const logger = Logger.getInstance()
  
  try {
    const results = {
      timestamp: new Date().toISOString(),
      tests: []
    }

    // Test 1: Cache performance
    const cacheTest = await testCachePerformance()
    results.tests.push(cacheTest)

    // Test 2: Database query optimization
    const dbTest = await testDatabaseOptimization()
    results.tests.push(dbTest)

    // Test 3: Batch operations
    const batchTest = await testBatchOperations()
    results.tests.push(batchTest)

    // Test 4: Memory usage
    const memoryTest = await testMemoryUsage()
    results.tests.push(memoryTest)

    // Calculate overall performance score
    const overallScore = calculateOverallScore(results.tests)

    return NextResponse.json({
      success: true,
      message: "Performance tests completed",
      results: {
        ...results,
        overallScore,
        recommendation: getPerformanceRecommendation(overallScore)
      }
    })

  } catch (error) {
    logger.error('Performance test failed', error instanceof Error ? error : new Error(String(error)))
    
    return NextResponse.json({
      success: false,
      error: "Performance test failed",
      details: process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : String(error)) : undefined
    }, { status: 500 })
  }
}

async function testCachePerformance() {
  const startTime = Date.now()
  
  // Test cache set operations
  const setOperations = 1000
  for (let i = 0; i < setOperations; i++) {
    cache.set(`test_key_${i}`, { data: `test_value_${i}`, timestamp: Date.now() })
  }
  
  // Test cache get operations
  let hits = 0
  for (let i = 0; i < setOperations; i++) {
    const value = cache.get(`test_key_${i}`)
    if (value) hits++
  }
  
  const endTime = Date.now()
  const duration = endTime - startTime
  
  // Clean up test data
  for (let i = 0; i < setOperations; i++) {
    cache.delete(`test_key_${i}`)
  }
  
  return {
    name: 'Cache Performance',
    duration: `${duration}ms`,
    operations: setOperations * 2, // Set + Get operations
    hitRate: `${((hits / setOperations) * 100).toFixed(2)}%`,
    opsPerSecond: Math.round((setOperations * 2) / (duration / 1000)),
    score: duration < 100 ? 100 : Math.max(0, 100 - (duration - 100) / 10)
  }
}

async function testDatabaseOptimization() {
  const startTime = Date.now()
  
  try {
    // Test optimized products query
    const products = await measurePerformance(
      'test_products_query',
      () => dbOptimizer.getProducts(1, 20, {}, { useCache: false }),
      {}
    )
    
    const endTime = Date.now()
    const duration = endTime - startTime
    
    return {
      name: 'Database Query Optimization',
      duration: `${duration}ms`,
      recordsReturned: products.data.length,
      totalRecords: products.total,
      score: duration < 200 ? 100 : Math.max(0, 100 - (duration - 200) / 20)
    }
  } catch (error) {
    return {
      name: 'Database Query Optimization',
      duration: 'N/A',
      error: error instanceof Error ? error.message : 'Unknown error',
      score: 0
    }
  }
}

async function testBatchOperations() {
  const startTime = Date.now()
  
  try {
    // Test batch stock validation
    const testItems = Array.from({ length: 50 }, (_, i) => ({
      product_id: i + 1,
      quantity: Math.floor(Math.random() * 5) + 1
    }))
    
    const results = await measurePerformance(
      'test_batch_validation',
      () => dbOptimizer.validateStockBatch(testItems, { 
        batchSize: 10, 
        concurrency: 5,
        useCache: false 
      }),
      { itemCount: testItems.length }
    )
    
    const endTime = Date.now()
    const duration = endTime - startTime
    
    return {
      name: 'Batch Operations',
      duration: `${duration}ms`,
      itemsProcessed: testItems.length,
      validItems: results.filter(r => r.valid).length,
      score: duration < 500 ? 100 : Math.max(0, 100 - (duration - 500) / 50)
    }
  } catch (error) {
    return {
      name: 'Batch Operations',
      duration: 'N/A',
      error: error instanceof Error ? error.message : 'Unknown error',
      score: 0
    }
  }
}

async function testMemoryUsage() {
  const memoryBefore = process.memoryUsage()
  
  // Perform some memory-intensive operations
  const largeArray = Array.from({ length: 10000 }, (_, i) => ({
    id: i,
    data: `test_data_${i}`,
    timestamp: Date.now()
  }))
  
  const memoryAfter = process.memoryUsage()
  const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed
  
  return {
    name: 'Memory Usage',
    memoryBefore: `${(memoryBefore.heapUsed / 1024 / 1024).toFixed(2)} MB`,
    memoryAfter: `${(memoryAfter.heapUsed / 1024 / 1024).toFixed(2)} MB`,
    memoryIncrease: `${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`,
    score: memoryIncrease < 10 * 1024 * 1024 ? 100 : Math.max(0, 100 - (memoryIncrease / 1024 / 1024) / 10) // 10MB threshold
  }
}

function calculateOverallScore(tests: any[]): number {
  const totalScore = tests.reduce((sum, test) => sum + test.score, 0)
  return Math.round(totalScore / tests.length)
}

function getPerformanceRecommendation(score: number): string {
  if (score >= 90) {
    return "Excellent performance! System is running optimally."
  } else if (score >= 75) {
    return "Good performance. Consider minor optimizations for better results."
  } else if (score >= 60) {
    return "Average performance. Some optimizations recommended."
  } else if (score >= 40) {
    return "Below average performance. Significant optimizations needed."
  } else {
    return "Poor performance. Immediate optimization required."
  }
}







