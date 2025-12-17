import { useMemo } from 'react'

interface Category {
  id: string
  name: string
  slug: string
  parent_id?: string
}

interface CategoryData {
  mainCategories: Category[]
  subCategories: Category[]
  allCategories: Category[]
}

interface UseCategoryFilteringProps {
  selectedMainCategory: string | null
  selectedSubCategories: string[]
  categoriesData: CategoryData
}

export function useCategoryFiltering({
  selectedMainCategory,
  selectedSubCategories,
  categoriesData
}: UseCategoryFilteringProps) {
  const categoryIds = useMemo(() => {

    if (!selectedMainCategory && selectedSubCategories.length === 0) {
      return { mainCategoryId: null, subCategoryIds: [], allCategoryIds: [] }
    }

    let mainCategoryId = null
    let subCategoryIds: string[] = []
    let allCategoryIds: string[] = []

    if (selectedMainCategory) {
      const mainCategory = categoriesData.mainCategories.find(cat => cat.slug === selectedMainCategory)
      
      if (mainCategory) {
        mainCategoryId = mainCategory.id
        // Get all subcategories under this main category
        const subcategoriesUnderMain = categoriesData.subCategories.filter(cat => cat.parent_id === mainCategory.id)
        
        allCategoryIds = subcategoriesUnderMain.map(cat => cat.id)
        
        // If main category has no subcategories, set allCategoryIds to empty array
        // This will be handled by the API to return 0 products
        if (subcategoriesUnderMain.length === 0) {
          allCategoryIds = []
        }
      }
    }

    if (selectedSubCategories.length > 0) {
      subCategoryIds = selectedSubCategories
        .map(slug => {
          const subCategory = categoriesData.subCategories.find(cat => cat.slug === slug)
          return subCategory?.id
        })
        .filter(Boolean) as string[]
      
      
      // If we have specific subcategories selected, use those; otherwise use all subcategories under main
      allCategoryIds = subCategoryIds.length > 0 ? subCategoryIds : allCategoryIds
    }

    const result = { mainCategoryId, subCategoryIds, allCategoryIds }
    return result
  }, [selectedMainCategory, selectedSubCategories, categoriesData])

  return categoryIds
}
