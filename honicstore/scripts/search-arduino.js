/**
 * Quick Search Script: Search for "arduino" products
 * Run: node scripts/search-arduino.js
 */

const searchQuery = 'arduino';
const LOCALHOST_PORT = process.env.LOCALHOST_PORT || '3000'
const apiUrl = `http://localhost:${LOCALHOST_PORT}/api/products?search=${encodeURIComponent(searchQuery)}&limit=1000`;

console.log(`\n🔍 Searching for: "${searchQuery}"`);
console.log(`📍 URL: ${apiUrl}\n`);

fetch(apiUrl)
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  })
  .then(data => {
    const products = Array.isArray(data) ? data : (data.products || []);
    const pagination = !Array.isArray(data) ? data.pagination : null;
    
    console.log('='.repeat(80));
    console.log('📊 SEARCH RESULTS');
    console.log('='.repeat(80));
    console.log(`\nTotal Products Found: ${pagination?.total || products.length}`);
    console.log(`Products Returned: ${products.length}\n`);
    
    if (products.length === 0) {
      console.log('❌ No products found matching "arduino"');
      console.log('\n💡 Possible reasons:');
      console.log('   - No products contain "arduino" in search_vector');
      console.log('   - Products are hidden (is_hidden = true)');
      console.log('   - search_vector column needs updating');
      return;
    }
    
    console.log('📦 PRODUCTS LIST:');
    console.log('='.repeat(80));
    
    products.forEach((product, index) => {
      console.log(`\n${index + 1}. ${product.name || 'Unnamed Product'}`);
      console.log(`   ID: ${product.id}`);
      console.log(`   Brand: ${product.brand || 'N/A'}`);
      console.log(`   Category: ${product.category || 'N/A'}`);
      console.log(`   Price: ${product.price ? `TZS ${parseFloat(product.price).toLocaleString()}` : 'N/A'}`);
      console.log(`   Stock: ${product.stockQuantity || product.stock_quantity || 0} units`);
      console.log(`   In Stock: ${product.inStock !== false && product.in_stock !== false ? 'Yes' : 'No'}`);
      if (product.sku) console.log(`   SKU: ${product.sku}`);
      if (product.model) console.log(`   Model: ${product.model}`);
      if (product.search_vector) {
        const sv = product.search_vector.length > 80 
          ? product.search_vector.substring(0, 80) + '...' 
          : product.search_vector;
        console.log(`   Search Vector: ${sv}`);
      }
    });
    
    console.log('\n' + '='.repeat(80));
    console.log(`✅ Found ${products.length} product(s) matching "arduino"`);
    console.log('='.repeat(80) + '\n');
  })
  .catch(error => {
    console.error('\n❌ Error:', error.message);
    console.error('\n💡 Make sure:');
    console.error('   1. Development server is running (npm run dev)');
    console.error(`   2. Server is accessible at http://localhost:${LOCALHOST_PORT}`);
    console.error('   3. API endpoint is working\n');
    process.exit(1);
  });



