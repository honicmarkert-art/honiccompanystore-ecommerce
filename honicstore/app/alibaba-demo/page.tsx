"use client"

export default function AlibabaDemoPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="bg-orange-50 dark:bg-orange-950 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            Get ready for 2027
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Find quality products at the best prices
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-full shadow-lg p-4 flex items-center gap-2">
          <input
            type="text"
            placeholder="Search products..."
            className="flex-1 border-0 bg-transparent focus:outline-none text-gray-900 dark:text-white placeholder:text-gray-500"
          />
          <button className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-full font-medium">
            Search
          </button>
        </div>
      </div>

      {/* Trust Badges */}
      <div className="max-w-6xl mx-auto px-4 py-8 border-b border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              ✓ Verified Supplier
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Shop from verified sellers with proven capabilities
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              ✓ Order Protection
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Secure transactions at every stage
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              ✓ Best Prices
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Factory-direct pricing across 40+ industries
            </p>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="max-w-6xl mx-auto px-4 py-8 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          Categories for you
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
          {['Electronics', 'Components', 'Machinery', 'Tools', 'Apparel', 'Sports', 'Home', 'Supplies'].map(cat => (
            <div key={cat} className="text-center p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
              <div className="text-2xl mb-2">📦</div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{cat}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Hot Picks */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          🔥 Hot Picks
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-4">
              <div className="bg-gray-200 dark:bg-gray-700 aspect-square rounded mb-3" />
              <h3 className="font-medium text-sm text-gray-900 dark:text-white mb-2">
                Product {i}
              </h3>
              <p className="text-orange-600 font-bold">$29.99</p>
            </div>
          ))}
        </div>
      </div>

      {/* Info Box */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h2 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
            Alibaba-Style Demo Page
          </h2>
          <p className="text-sm text-blue-800 dark:text-blue-200">
            This is a minimal working version of the Alibaba-style design.
            If you see this page working, the basic structure is good.
          </p>
        </div>
      </div>
    </div>
  )
}
