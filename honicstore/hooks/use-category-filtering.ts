import { useMemo } from 'react'

interface Category {
  id: string
  name: string
  slug: string
  parent_id?: string | null
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

function isSubOf(parentId: string | null | undefined, mainId: string): boolean {
  return parentId != null && String(parentId) === String(mainId)
}

export function useCategoryFiltering({
  selectedMainCategory,
  selectedSubCategories,
  categoriesData
}: UseCategoryFilteringProps) {
  const categoryIds = useMemo(() => {
    if (!selectedMainCategory && selectedSubCategories.length === 0) {
      return { mainCategoryId: null, subCategoryIds: [], allCategoryIds: [] as string[] }
    }

    let mainCategoryId: string | null = null
    let subCategoryIds: string[] = []
    let allCategoryIds: string[] = []

    if (selectedMainCategory) {
      const mainCategory = categoriesData.mainCategories.find(
        (cat) => cat.slug === selectedMainCategory
      )

      if (mainCategory) {
        mainCategoryId = mainCategory.id
        const subsUnderMain = categoriesData.subCategories.filter((cat) =>
          isSubOf(cat.parent_id, mainCategory.id)
        )

        // No explicit sub-picks: treat as "whole main" — include parent id and every sub id
        // so products stored on either the main row or a subcategory row match.
        if (selectedSubCategories.length === 0) {
          const subIds = subsUnderMain.map((c) => c.id)
          allCategoryIds =
            subIds.length > 0 ? [mainCategory.id, ...subIds] : [mainCategory.id]
        }
      }
    }

    if (selectedSubCategories.length > 0) {
      subCategoryIds = selectedSubCategories
        .map((slug) => {
          const subCategory = categoriesData.subCategories.find((cat) => cat.slug === slug)
          return subCategory?.id
        })
        .filter(Boolean) as string[]

      if (subCategoryIds.length > 0) {
        allCategoryIds = subCategoryIds
      }
    }

    allCategoryIds = [...new Set(allCategoryIds.filter(Boolean))]

    return { mainCategoryId, subCategoryIds, allCategoryIds }
  }, [selectedMainCategory, selectedSubCategories, categoriesData])

  return categoryIds
}
