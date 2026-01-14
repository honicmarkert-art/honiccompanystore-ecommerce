# Product Fetching Flow: API to Client

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. PAGE LOAD (0ms)                                              │
│    - User navigates to /products                                │
│    - React component mounts                                     │
│    - useInfiniteProducts hook initializes                       │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. CLIENT-SIDE CACHE CHECK (0-5ms)                             │
│    Location: hooks/use-infinite-products.ts:152-177            │
│    - Check sessionStorage for cached products                   │
│    - Cache key: products_{filters}_{offset}_{limit}             │
│    - Valid if < 5 minutes old                                    │
│                                                                  │
│    ✅ CACHE HIT:                                                 │
│       - Set products immediately (synchronous)                  │
│       - Hide skeleton instantly                                 │
│       - Return early (skip API call)                            │
│       - Time: ~1-2ms                                            │
│                                                                  │
│    ❌ CACHE MISS:                                                │
│       - Continue to API fetch                                   │
│       - Time: ~1-2ms                                            │
└─────────────────────────────────────────────────────────────────┘
                            ↓ (if cache miss)
┌─────────────────────────────────────────────────────────────────┐
│ 3. BUILD API REQUEST (5-10ms)                                   │
│    Location: hooks/use-infinite-products.ts:198-250             │
│    - Construct URL: /api/products                               │
│    - Build query parameters:                                    │
│      * limit, offset, category, brand, search                   │
│      * minPrice, maxPrice, categories, sortBy, sortOrder         │
│    - Add cache busting (if search/filter): ?t={timestamp}       │
│    - Time: ~5-10ms                                              │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. FETCH-CACHE LAYER (10-15ms)                                  │
│    Location: lib/fetch-cache.ts:55-100                          │
│    - Check in-memory cache (Map)                                 │
│    - Check localStorage cache                                   │
│    - Deduplicate in-flight requests                             │
│                                                                  │
│    ✅ FRESH CACHE (< 30s):                                       │
│       - Return cached data immediately                          │
│       - Time: ~2-5ms                                            │
│                                                                  │
│    ⚠️ STALE CACHE (30s-3min):                                    │
│       - Return stale data immediately                           │
│       - Fetch fresh data in background                          │
│       - Time: ~2-5ms (stale), +200-500ms (fresh)                │
│                                                                  │
│    ❌ NO CACHE:                                                  │
│       - Continue to network fetch                               │
│       - Time: ~2-5ms                                            │
└─────────────────────────────────────────────────────────────────┘
                            ↓ (if no cache)
┌─────────────────────────────────────────────────────────────────┐
│ 5. NETWORK REQUEST (50-200ms)                                   │
│    Location: lib/fetch-cache.ts:42-53                           │
│    - HTTP GET /api/products?{params}                            │
│    - Network latency: 50-150ms (local) / 100-300ms (remote)      │
│    - DNS lookup: 0-50ms (if needed)                             │
│    - Time: ~50-200ms                                            │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. API ROUTE HANDLER (100-2000ms)                               │
│    Location: app/api/products/route.ts:43                       │
│                                                                  │
│    6a. Rate Limiting Check (1-2ms)                               │
│        - enhancedRateLimit(request)                              │
│        - Time: ~1-2ms                                           │
│                                                                  │
│    6b. Server-Side Cache Check (2-5ms)                           │
│        - getCachedData(cacheKey)                                 │
│        - In-memory cache (Map)                                   │
│        - TTL: 30 minutes                                         │
│                                                                  │
│        ✅ CACHE HIT:                                             │
│           - Return cached response                               │
│           - Add X-Cache: HIT header                              │
│           - Time: ~2-5ms                                         │
│                                                                  │
│        ❌ CACHE MISS:                                            │
│           - Continue to database query                           │
│           - Time: ~2-5ms                                         │
│                                                                  │
│    6c. Database Query (100-1500ms)                              │
│        - Supabase client connection                             │
│        - Build PostgreSQL query                                  │
│        - Apply filters (category, brand, search, price)          │
│        - Execute query                                           │
│        - Time: ~100-500ms (simple) / 500-1500ms (complex)         │
│                                                                  │
│    6d. Data Transformation (10-50ms)                            │
│        - Map database fields to API format                       │
│        - Calculate pagination                                     │
│        - Apply business logic                                    │
│        - Time: ~10-50ms                                          │
│                                                                  │
│    6e. Cache Response (1-2ms)                                    │
│        - setCachedData(cacheKey, data, TTL)                      │
│        - Store in memory cache                                   │
│        - Time: ~1-2ms                                            │
│                                                                  │
│    Total API Time:                                               │
│    - Cache Hit: ~5-10ms                                          │
│    - Cache Miss (Simple Query): ~150-600ms                       │
│    - Cache Miss (Complex Query): ~600-2000ms                     │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. NETWORK RESPONSE (50-200ms)                                   │
│    - Receive JSON response                                       │
│    - Parse response body                                         │
│    - Network transfer: 50-150ms (depends on payload size)        │
│    - JSON parsing: ~5-20ms                                       │
│    - Time: ~55-220ms                                            │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 8. CLIENT-SIDE PROCESSING (10-30ms)                             │
│    Location: hooks/use-infinite-products.ts:305-370             │
│                                                                  │
│    8a. Response Parsing (5-10ms)                                │
│        - Extract products array                                  │
│        - Extract pagination info                                 │
│        - Time: ~5-10ms                                           │
│                                                                  │
│    8b. Data Transformation (5-15ms)                             │
│        - Map fields (inStock, importChina, etc.)                 │
│        - Filter out-of-stock products                            │
│        - Time: ~5-15ms                                           │
│                                                                  │
│    8c. Update State (1-2ms)                                      │
│        - setProducts(newProducts)                                │
│        - setHasMore(hasMore)                                     │
│        - setLoading(false)                                       │
│        - Time: ~1-2ms                                            │
│                                                                  │
│    8d. Cache to sessionStorage (5-10ms)                          │
│        - JSON.stringify(data)                                    │
│        - sessionStorage.setItem(key, data)                       │
│        - Time: ~5-10ms                                           │
│                                                                  │
│    Total Client Processing: ~16-37ms                            │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 9. REACT RENDER (10-50ms)                                       │
│    Location: app/products/page.tsx:3791-3820                     │
│                                                                  │
│    9a. Component Re-render (5-20ms)                             │
│        - React detects state change                              │
│        - Re-render products grid                                │
│        - Time: ~5-20ms                                           │
│                                                                  │
│    9b. Hide Skeleton (1ms)                                       │
│        - setShowSkeleton(false)                                  │
│        - Remove skeleton component                               │
│        - Time: ~1ms                                              │
│                                                                  │
│    9c. Render Product Cards (5-30ms)                            │
│        - Map products to Card components                         │
│        - Render images (lazy loading)                            │
│        - Apply styles                                            │
│        - Time: ~5-30ms                                           │
│                                                                  │
│    Total Render Time: ~11-51ms                                   │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 10. PRODUCTS DISPLAYED ✅                                         │
│     - Products visible to user                                   │
│     - Skeleton removed                                           │
│     - Ready for interaction                                      │
└─────────────────────────────────────────────────────────────────┘
```

## Time Estimates Summary

### Scenario 1: First Visit (No Cache)
```
┌─────────────────────────────────────────────────────────┐
│ Step                    │ Time Estimate                │
├─────────────────────────────────────────────────────────┤
│ 1. Page Load            │ 0ms                          │
│ 2. Client Cache Check   │ 1-2ms                        │
│ 3. Build API Request    │ 5-10ms                       │
│ 4. Fetch-Cache Layer    │ 2-5ms                        │
│ 5. Network Request      │ 50-200ms                     │
│ 6. API Route Handler    │ 150-2000ms (depends on query) │
│ 7. Network Response     │ 55-220ms                     │
│ 8. Client Processing    │ 16-37ms                      │
│ 9. React Render         │ 11-51ms                      │
├─────────────────────────────────────────────────────────┤
│ TOTAL                   │ 300-2500ms                   │
│                         │ (0.3-2.5 seconds)            │
└─────────────────────────────────────────────────────────┘
```

### Scenario 2: Returning Visit (Client Cache Hit)
```
┌─────────────────────────────────────────────────────────┐
│ Step                    │ Time Estimate                │
├─────────────────────────────────────────────────────────┤
│ 1. Page Load            │ 0ms                          │
│ 2. Client Cache Check   │ 1-2ms ✅ CACHE HIT           │
│ 3. Set Products         │ 1ms                          │
│ 4. Hide Skeleton        │ 1ms                          │
│ 5. React Render         │ 11-51ms                      │
├─────────────────────────────────────────────────────────┤
│ TOTAL                   │ 14-55ms                      │
│                         │ (0.014-0.055 seconds)        │
│                         │ ⚡ INSTANT!                   │
└─────────────────────────────────────────────────────────┘
```

### Scenario 3: Server Cache Hit (No Client Cache)
```
┌─────────────────────────────────────────────────────────┐
│ Step                    │ Time Estimate                │
├─────────────────────────────────────────────────────────┤
│ 1. Page Load            │ 0ms                          │
│ 2. Client Cache Check   │ 1-2ms ❌ CACHE MISS          │
│ 3. Build API Request    │ 5-10ms                       │
│ 4. Fetch-Cache Layer    │ 2-5ms                        │
│ 5. Network Request      │ 50-200ms                     │
│ 6. API Route Handler    │ 5-10ms ✅ SERVER CACHE HIT    │
│ 7. Network Response     │ 55-220ms                     │
│ 8. Client Processing    │ 16-37ms                      │
│ 9. React Render         │ 11-51ms                      │
├─────────────────────────────────────────────────────────┤
│ TOTAL                   │ 150-535ms                    │
│                         │ (0.15-0.5 seconds)            │
└─────────────────────────────────────────────────────────┘
```

### Scenario 4: Stale-While-Revalidate (Background Refresh)
```
┌─────────────────────────────────────────────────────────┐
│ Step                    │ Time Estimate                │
├─────────────────────────────────────────────────────────┤
│ 1. Page Load            │ 0ms                          │
│ 2. Client Cache Check   │ 1-2ms ✅ STALE CACHE         │
│ 3. Set Products (stale) │ 1ms                          │
│ 4. Hide Skeleton        │ 1ms                          │
│ 5. React Render         │ 11-51ms                      │
│ 6. Background Fetch     │ 150-2000ms (async)           │
│ 7. Update Products      │ 1ms (when fresh data arrives)│
├─────────────────────────────────────────────────────────┤
│ INITIAL DISPLAY         │ 14-55ms                      │
│                         │ (stale data shown instantly)  │
│ FRESH DATA UPDATE       │ +150-2000ms                   │
│                         │ (updates when ready)          │
└─────────────────────────────────────────────────────────┘
```

## Detailed Step Breakdown

### Step 2: Client-Side Cache Check
```typescript
// Location: hooks/use-infinite-products.ts:152-177
// Time: 1-2ms

if (!forceRefresh && !isLoadMore && typeof window !== 'undefined') {
  const cacheKey = `products_${JSON.stringify({...filters})}_${offset}_${limit}`
  const cached = sessionStorage.getItem(cacheKey)  // ~0.5ms
  if (cached) {
    const cacheData = JSON.parse(cached)            // ~0.5ms
    const now = Date.now()
    if (cacheData.timestamp && (now - cacheData.timestamp) < 5 * 60 * 1000) {
      setProducts(cacheData.products)                // ~0.5ms
      setLoading(false)                              // ~0.1ms
      return  // Early return - skip API call
    }
  }
}
```

### Step 4: Fetch-Cache Layer
```typescript
// Location: lib/fetch-cache.ts:55-100
// Time: 2-5ms (cache hit) or 2-5ms (cache miss check)

const mem = inMemory.get(key)        // ~0.1ms (Map lookup)
const stor = readStorage(key)        // ~1-3ms (localStorage read)
const best = mem || stor

const isFresh = best && now - best.ts <= ttlMs      // ~0.1ms
if (isFresh) return best!.data                      // ~0.1ms

const isStaleButValid = best && now - best.ts <= (ttlMs + swrMs)
if (isStaleButValid) {
  // Return stale, fetch fresh in background
  void networkFetch(url, opts)                       // Async, non-blocking
  return best!.data                                  // ~0.1ms
}
```

### Step 6: API Route Handler
```typescript
// Location: app/api/products/route.ts:43-1403
// Time: 5-10ms (cache hit) or 150-2000ms (cache miss)

// 6a. Rate Limiting (1-2ms)
const rateLimitResult = enhancedRateLimit(request)

// 6b. Server Cache Check (2-5ms)
const cachedData = getCachedData(cacheKey)  // In-memory Map lookup
if (cachedData) {
  return createSecureResponse(cachedData)     // ~1ms
}

// 6c. Database Query (100-1500ms)
const publicClient = createClient(supabaseUrl, supabaseAnonKey)
let queryBuilder = publicClient.from('products')
// Apply filters, sorting, pagination
const { data, error } = await queryBuilder  // ~100-1500ms

// 6d. Data Transformation (10-50ms)
const transformedProducts = data.map(product => ({
  // Transform fields
}))

// 6e. Cache Response (1-2ms)
setCachedData(cacheKey, responseData, CACHE_TTL.PRODUCTS)
```

### Step 8: Client-Side Processing
```typescript
// Location: hooks/use-infinite-products.ts:305-370
// Time: 16-37ms

// 8a. Response Parsing (5-10ms)
const newProducts = Array.isArray(data) ? data : (data.products || [])
const pagination = !Array.isArray(data) ? data.pagination : null

// 8b. Data Transformation (5-15ms)
const transformedProducts = newProducts.map((product: any) => {
  // Map inStock, importChina, etc.
  // Filter out-of-stock
})

// 8c. Update State (1-2ms)
setProducts(transformedProducts)
setHasMore(hasMoreData)
setLoading(false)

// 8d. Cache to sessionStorage (5-10ms)
const cacheData = {
  products: transformedProducts,
  hasMore: hasMoreData,
  totalCount: pagination?.total,
  timestamp: Date.now()
}
sessionStorage.setItem(cacheKey, JSON.stringify(cacheData))
```

## Performance Optimizations Applied

### 1. Multi-Layer Caching
- **Client Cache (sessionStorage)**: 5-minute TTL, instant access
- **Fetch Cache (localStorage)**: 30s fresh, 3min stale-while-revalidate
- **Server Cache (in-memory)**: 30-minute TTL, sub-millisecond access

### 2. Request Deduplication
- Prevents duplicate API calls for same query
- Uses Map to track in-flight requests
- Reuses existing promise if request already in progress

### 3. Stale-While-Revalidate
- Shows cached data immediately
- Fetches fresh data in background
- Updates UI when fresh data arrives

### 4. Smart Cache Busting
- Only cache busts when needed (search, filters, explicit refresh)
- Regular browsing uses cache for speed
- Reduces unnecessary API calls

### 5. Parallel Loading
- Products load immediately (don't wait for ads/categories)
- Multiple resources load in parallel
- Faster perceived performance

## Typical User Experience

### First Visit (Cold Start)
- **Time to First Product**: 300-2500ms
- **Skeleton Visible**: 300-2500ms
- **User Experience**: Moderate (depends on network/DB)

### Returning Visit (Warm Cache)
- **Time to First Product**: 14-55ms
- **Skeleton Visible**: 0ms (hidden immediately)
- **User Experience**: ⚡ Instant!

### Search/Filter Change
- **Time to First Product**: 150-2000ms
- **Skeleton Visible**: 150-2000ms
- **User Experience**: Fast (with cache) to Moderate (without cache)

## Visual Timeline

### First Visit (No Cache) - Worst Case
```
Time (ms)    │ Activity
─────────────┼─────────────────────────────────────────────────────
0            │ Page loads, component mounts
1-2          │ Check client cache ❌ MISS
5-10         │ Build API request URL
10-15        │ Check fetch-cache ❌ MISS
15-215       │ Network request to API (50-200ms network latency)
215-2215     │ API processes request:
             │   - Rate limit check (1ms)
             │   - Server cache check ❌ MISS (2ms)
             │   - Database query (100-1500ms) ⏱️ SLOWEST STEP
             │   - Data transform (10-50ms)
             │   - Cache response (1ms)
2215-2435    │ Network response (55-220ms)
2435-2472    │ Client processing (16-37ms)
2472-2523    │ React render (11-51ms)
2523         │ ✅ Products displayed
             │
Total: ~2.5 seconds (worst case with slow DB query)
```

### Returning Visit (Client Cache Hit) - Best Case
```
Time (ms)    │ Activity
─────────────┼─────────────────────────────────────────────────────
0            │ Page loads, component mounts
1            │ Check client cache ✅ HIT
1            │ Set products from cache (synchronous)
1            │ Hide skeleton
12-52        │ React render (11-51ms)
52           │ ✅ Products displayed
             │
Total: ~0.05 seconds (50ms) ⚡ INSTANT!
```

### Server Cache Hit (No Client Cache)
```
Time (ms)    │ Activity
─────────────┼─────────────────────────────────────────────────────
0            │ Page loads, component mounts
1-2          │ Check client cache ❌ MISS
5-10         │ Build API request URL
10-15        │ Check fetch-cache ❌ MISS
15-215       │ Network request to API
215-220      │ API processes request:
             │   - Rate limit check (1ms)
             │   - Server cache check ✅ HIT (2ms)
             │   - Return cached response (1ms)
220-440      │ Network response (55-220ms)
440-477      │ Client processing (16-37ms)
477-528      │ React render (11-51ms)
528          │ ✅ Products displayed
             │
Total: ~0.5 seconds (500ms)
```

## Key Bottlenecks & Solutions

### Bottleneck 1: Database Query (100-1500ms)
**Problem**: Slowest step in the flow
**Solutions Applied**:
- ✅ Server-side caching (30min TTL)
- ✅ Client-side caching (5min TTL)
- ✅ Query optimization (indexes, materialized views)
- ✅ Minimal payload mode (`minimal=true`)

**Further Optimization**:
- Add database connection pooling
- Use read replicas for product queries
- Implement database query result caching

### Bottleneck 2: Network Latency (50-200ms)
**Problem**: Round-trip time to API
**Solutions Applied**:
- ✅ Client-side caching (eliminates network call)
- ✅ Stale-while-revalidate (shows cached, updates in background)
- ✅ Request deduplication (prevents duplicate calls)

**Further Optimization**:
- Use CDN for API responses
- Implement HTTP/2 server push
- Prefetch on page hover

### Bottleneck 3: Initial Render (11-51ms)
**Problem**: React rendering time
**Solutions Applied**:
- ✅ Lazy image loading
- ✅ Virtual scrolling (if needed)
- ✅ Memoization of product cards

**Further Optimization**:
- Use React Server Components
- Implement progressive rendering
- Code splitting for product components

## Recommendations for Further Optimization

1. **Preload Products on Hover**: Prefetch products when user hovers over category
2. **Service Worker Cache**: Add service worker for offline support
3. **Image Optimization**: Use WebP, lazy loading, responsive images
4. **Database Indexing**: Ensure proper indexes on filtered columns
5. **CDN Caching**: Cache static product data at CDN level
6. **Streaming SSR**: Stream initial HTML with products
7. **Database Connection Pooling**: Reuse connections for faster queries
8. **Read Replicas**: Use read replicas for product queries to reduce load
