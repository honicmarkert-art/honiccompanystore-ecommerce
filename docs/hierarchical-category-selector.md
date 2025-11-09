# Hierarchical Category Selector

## Overview
The Hierarchical Category Selector provides a two-step category selection process:
1. **Main Category**: Select the primary category first
2. **Sub Category**: Choose from subcategories under the selected main category

## Features
- **Two-step selection**: Main category → Sub category
- **Dynamic filtering**: Subcategories are filtered based on the selected main category
- **Add new categories**: Can add new main categories or subcategories on the fly
- **Visual feedback**: Shows the current selection path (e.g., "Electronics > Smartphones")
- **Error handling**: Graceful handling of loading states and errors

## Usage
```tsx
import { HierarchicalCategorySelector } from '@/components/hierarchical-category-selector'

<HierarchicalCategorySelector
  value={selectedCategory}
  onValueChange={setSelectedCategory}
  placeholder="Select a category"
  onAddNew={(newCategory) => {
    // Handle adding new category
    console.log('New category:', newCategory)
  }}
/>
```

## Props
- `value`: Currently selected category name
- `onValueChange`: Callback when category selection changes
- `placeholder`: Placeholder text for the selector
- `isLoading`: Loading state
- `error`: Error message to display
- `emptyMessage`: Message when no categories are available
- `onAddNew`: Callback for adding new categories
- `className`: Additional CSS classes

## Database Structure
The component works with the existing `categories` table structure:
- `id`: Primary key
- `name`: Category name
- `slug`: URL-friendly slug
- `parent_id`: Reference to parent category (null for main categories)
- `parent_name`: Name of parent category (for display)

## Integration
The component is integrated into:
- Product form (`app/siem-dashboard/products/product-form.tsx`)
- Uses the existing `useCategories` hook
- Compatible with the existing categories API (`/api/categories`)

## Benefits
1. **Better UX**: Clear hierarchy makes category selection intuitive
2. **Reduced errors**: Prevents selecting invalid category combinations
3. **Scalable**: Works with any number of main categories and subcategories
4. **Consistent**: Maintains the same API and data structure as existing components

