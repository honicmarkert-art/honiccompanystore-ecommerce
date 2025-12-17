export type Language = 'en' | 'sw'

interface Translations {
  [key: string]: string | Translations
}

const translations: Record<Language, Translations> = {
  en: {
    // Supplier Navigation
    dashboard: 'Dashboard',
    products: 'Products',
    orders: 'Orders',
    analytics: 'Analytics',
    marketing: 'Marketing',
    featured: 'Featured',
    company: 'Company',
    support: 'Support',
    
    // Supplier Layout
    supplier: 'Supplier',
    accountActive: 'Account Active',
    accountInactive: 'Account Inactive',
    freePlan: 'Free Plan',
    upgradePlan: 'Upgrade Plan',
    currency: 'Currency',
    language: 'Language',
    english: 'English',
    swahili: 'Swahili',
    logout: 'Logout',
    signingOut: 'Signing out...',
    
    // Company Info Modal
    completeRegistration: 'Complete Your Registration',
    fillCompanyInfo: 'Please fill in your company information to complete your registration and access all features.',
    companyName: 'Company Name',
    location: 'Location',
    officeNumber: 'Office Number',
    saveContinue: 'Save & Continue',
    saving: 'Saving...',
    
    // Declaration Form
    supplierDeclarationTerms: 'Supplier Declaration & Terms',
    readAgreeTerms: 'Please read and agree to the terms for the',
    plan: 'plan',
    supplierResponsibilities: 'Supplier Responsibilities',
    provideAccurateInfo: 'Provide accurate product information and high-quality products',
    maintainInventory: 'Maintain adequate inventory levels',
    processOrdersPromptly: 'Process orders promptly and ship within agreed timeframes',
    respondToCustomers: 'Respond to customer inquiries and resolve issues professionally',
    complyWithLaws: 'Comply with all applicable laws and regulations',
    commissionPayment: 'Commission & Payment',
    commissionRatesSpecified: 'Commission rates are as specified in your selected plan',
    commissionRate: 'Commission Rate',
    commissionRateValue: 'A commission rate of',
    commissionRatePerProduct: 'will be applied to each product sold',
    paymentsProcessed: 'Payments will be processed according to the agreed schedule',
    transactionsSubjectFees: 'All transactions are subject to platform fees',
    refundsReturnsHandled: 'Refunds and returns will be handled according to platform policies',
    productListingGuidelines: 'Product Listing Guidelines',
    productsAccuratelyDescribed: 'Products must be accurately described with clear images',
    prohibitedItemsForbidden: 'Prohibited items are strictly forbidden',
    pricingCompetitive: 'Pricing must be competitive and transparent',
    productLimitsApply: 'Product limits apply based on your selected plan',
    accountManagement: 'Account Management',
    maintainAccountSecurity: 'You are responsible for maintaining account security',
    accountSuspension: 'Account suspension may occur for policy violations',
    planUpgradesDowngrades: 'Plan upgrades and downgrades are subject to terms',
    deleteAccountAnytime: 'You can delete your account at any time',
    platformRights: 'Platform Rights',
    reviewApproveProducts: 'We reserve the right to review and approve products',
    modifyTermsNotice: 'We may modify terms with prior notice',
    suspendTerminateAccounts: 'We can suspend or terminate accounts for violations',
    updatePlatformFeatures: 'We maintain the right to update platform features',
    agreeToTerms: 'I have read, understood, and agree to all the terms and conditions stated above. I understand that by proceeding, I am entering into a binding agreement with',
    iAgreeContinue: 'I Agree & Continue',
    agreementRequired: 'Agreement Required',
    pleaseAgreeToTerms: 'Please read and agree to the terms and conditions to continue.',
    
    // Plan Cards
    chooseYourPlan: 'Choose Your Plan',
    selectPerfectPlan: 'Select the perfect plan for your business needs',
    monthly: 'Monthly',
    yearly: 'Yearly',
    features: 'Features',
    getStarted: 'Get Started',
    choosePremium: 'Choose Premium',
    perfectForGettingStarted: 'Perfect for getting started',
    forGrowingBusinesses: 'For growing businesses',
    
    // Common
    back: 'Back',
    save: 'Save',
    update: 'Update',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    refresh: 'Refresh',
    close: 'Close',
    confirm: 'Confirm',
    yes: 'Yes',
    no: 'No',
    submit: 'Submit',
    search: 'Search',
    filter: 'Filter',
    clear: 'Clear',
    apply: 'Apply',
    reset: 'Reset',
    next: 'Next',
    previous: 'Previous',
    view: 'View',
    download: 'Download',
    upload: 'Upload',
    remove: 'Remove',
    select: 'Select',
    all: 'All',
    none: 'None',
    
    // Dashboard & Pages
    welcomeBack: 'Welcome back',
    completePayment: 'Complete Payment',
    completeYourPremiumPlanPayment: 'Complete Your Premium Plan Payment',
    youHaveSelectedPremiumPlan: 'You have selected the Premium plan. Complete your payment to unlock unlimited products and premium features.',
    tryPaymentAgain: 'Try Payment Again',
    createNewPayment: 'Create New Payment',
    checkPaymentStatus: 'Check Payment Status',
    paymentSuccessful: 'Payment Successful',
    paymentFailed: 'Payment Failed',
    paymentPending: 'Payment Pending',
    paymentCancelled: 'Payment Cancelled',
    proceedToPayment: 'Proceed to Payment',
    paymentPageOpened: 'Payment Page Opened',
    pleaseCompletePayment: 'Please complete your payment in the new tab. You will be redirected back after payment.',
    
    // Account & Settings
    deleteAccount: 'Delete Account',
    permanentlyDeleteAccount: 'Permanently delete your supplier account',
    warningActionCannotBeUndone: '⚠️ Warning: This action cannot be undone',
    accountWillBeDeactivated: 'Your account will be permanently deactivated',
    allProductsWillBeHidden: 'All your products will be hidden from customers',
    loseAccessToFeatures: 'You will lose access to all supplier features',
    orderHistoryPreserved: 'Your order history and analytics will be preserved but inaccessible',
    reasonForDeletion: 'Reason for Deletion',
    feedback: 'Feedback',
    confirmDeletion: 'Confirm Deletion',
    typeDeleteToConfirm: 'Type "DELETE" to confirm',
    companyDetails: 'Company Details',
    
    // Invoices & Billing
    invoicesBilling: 'Invoices & Billing',
    viewDownloadInvoices: 'View and download your payment invoices and billing history',
    totalInvoices: 'Total Invoices',
    totalPaid: 'Total Paid',
    totalFailed: 'Total Failed',
    failedInvoices: 'Failed Invoices',
    invoiceNumber: 'Invoice Number',
    planName: 'Plan Name',
    amount: 'Amount',
    date: 'Date',
    transactionId: 'Transaction ID',
    status: 'Status',
    paid: 'Paid',
    failed: 'Failed',
    pending: 'Pending',
    cancelled: 'Cancelled',
    downloadInvoice: 'Download Invoice',
    viewInvoice: 'View Invoice',
    fromDate: 'From Date',
    toDate: 'To Date',
    clearFilters: 'Clear Filters',
    noInvoicesFound: 'No invoices found',
    
    // Navigation
    up: 'Up',
    upgrade: 'Upgrade',
  },
  sw: {
    // Supplier Navigation
    dashboard: 'Dashibodi',
    products: 'Bidhaa',
    orders: 'Maagizo',
    analytics: 'Uchambuzi',
    marketing: 'Uuzaji',
    featured: 'Maalum',
    company: 'Kampuni',
    support: 'Msaada',
    
    // Supplier Layout
    supplier: 'Msambazaji',
    accountActive: 'Akaunti Hai',
    accountInactive: 'Akaunti Haijaamilishwa',
    freePlan: 'Mpango wa Bure',
    upgradePlan: 'Boresha Mpango',
    currency: 'Sarafu',
    language: 'Lugha',
    english: 'Kiingereza',
    swahili: 'Kiswahili',
    logout: 'Toka',
    signingOut: 'Inatoka...',
    
    // Company Info Modal
    completeRegistration: 'Kamilisha Usajili Wako',
    fillCompanyInfo: 'Tafadhali jaza taarifa za kampuni yako ili kukamilisha usajili na kufikia vipengele vyote.',
    companyName: 'Jina la Kampuni',
    location: 'Eneo',
    officeNumber: 'Nambari ya Ofisi',
    saveContinue: 'Hifadhi na Endelea',
    saving: 'Inahifadhi...',
    
    // Declaration Form
    supplierDeclarationTerms: 'Tamko na Masharti ya Msambazaji',
    readAgreeTerms: 'Tafadhali soma na kukubali masharti ya',
    plan: 'mpango',
    supplierResponsibilities: 'Jukumu la Msambazaji',
    provideAccurateInfo: 'Toa taarifa sahihi za bidhaa na bidhaa za ubora wa juu',
    maintainInventory: 'Dumisha viwango vya kutosha vya hesabu',
    processOrdersPromptly: 'Fanya maagizo haraka na peleka ndani ya muda uliokubaliwa',
    respondToCustomers: 'Jibu maswali ya wateja na kutatua matatizo kwa ujuzi',
    complyWithLaws: 'Kuzingatia sheria na kanuni zote zinazotumika',
    commissionPayment: 'Ada na Malipo',
    commissionRatesSpecified: 'Viwango vya ada ni kama ilivyobainishwa katika mpango wako uliochaguliwa',
    commissionRate: 'Kiwango cha Ada',
    commissionRateValue: 'Ada ya kiwango cha',
    commissionRatePerProduct: 'itatozwa kwa kila bidhaa iliyouzwa',
    paymentsProcessed: 'Malipo yatafanywa kulingana na ratiba iliyokubaliwa',
    transactionsSubjectFees: 'Miamala yote ina ada za jukwaa',
    refundsReturnsHandled: 'Rudisha pesa na kurudisha bidhaa zitatatuliwa kulingana na sera za jukwaa',
    productListingGuidelines: 'Miongozo ya Kuorodhesha Bidhaa',
    productsAccuratelyDescribed: 'Bidhaa lazima zielezewe kwa usahihi na picha wazi',
    prohibitedItemsForbidden: 'Vitu vilivyopigwa marufuku vimekatazwa kabisa',
    pricingCompetitive: 'Bei lazima iwe ya ushindani na wazi',
    productLimitsApply: 'Vikomo vya bidhaa vinatumika kulingana na mpango wako uliochaguliwa',
    accountManagement: 'Usimamizi wa Akaunti',
    maintainAccountSecurity: 'Wewe ni mwenye jukumu la kudumisha usalama wa akaunti',
    accountSuspension: 'Kusimamishwa kwa akaunti kunaweza kutokea kwa ukiukaji wa sera',
    planUpgradesDowngrades: 'Kuboresha na kupunguza mpango ni chini ya masharti',
    deleteAccountAnytime: 'Unaweza kufuta akaunti yako wakati wowote',
    platformRights: 'Haki za Jukwaa',
    reviewApproveProducts: 'Tunahifadhi haki ya kukagua na kuidhinisha bidhaa',
    modifyTermsNotice: 'Tunaweza kubadilisha masharti kwa taarifa ya awali',
    suspendTerminateAccounts: 'Tunaweza kusimamisha au kukomesha akaunti kwa ukiukaji',
    updatePlatformFeatures: 'Tunahifadhi haki ya kusasisha vipengele vya jukwaa',
    agreeToTerms: 'Nimesoma, nimeelewa, na nakubali masharti na hali zote zilizotajwa hapo juu. Ninaelewa kuwa kwa kuendelea, ninaingia kwenye makubaliano ya lazima na',
    iAgreeContinue: 'Nakubali na Kuendelea',
    agreementRequired: 'Makubaliano Yanahitajika',
    pleaseAgreeToTerms: 'Tafadhali soma na kukubali masharti na hali ili kuendelea.',
    
    // Plan Cards
    chooseYourPlan: 'Chagua Mpango Wako',
    selectPerfectPlan: 'Chagua mpango kamili kwa mahitaji ya biashara yako',
    monthly: 'Kila Mwezi',
    yearly: 'Kila Mwaka',
    features: 'Vipengele',
    getStarted: 'Anza',
    choosePremium: 'Chagua Premium',
    perfectForGettingStarted: 'Kamili kwa kuanza',
    forGrowingBusinesses: 'Kwa biashara zinazokua',
    
    // Common
    back: 'Rudi',
    save: 'Hifadhi',
    update: 'Sasisha',
    cancel: 'Ghairi',
    delete: 'Futa',
    edit: 'Hariri',
    add: 'Ongeza',
    loading: 'Inapakia...',
    error: 'Kosa',
    success: 'Mafanikio',
    refresh: 'Onyesha Upya',
    close: 'Funga',
    confirm: 'Thibitisha',
    yes: 'Ndiyo',
    no: 'Hapana',
    submit: 'Wasilisha',
    search: 'Tafuta',
    filter: 'Chuja',
    clear: 'Futa',
    apply: 'Tumia',
    reset: 'Weka Upya',
    next: 'Ifuatayo',
    previous: 'Iliyotangulia',
    view: 'Angalia',
    download: 'Pakua',
    upload: 'Pakia',
    remove: 'Ondoa',
    select: 'Chagua',
    all: 'Zote',
    none: 'Hakuna',
    
    // Dashboard & Pages
    welcomeBack: 'Karibu tena',
    completePayment: 'Kamilisha Malipo',
    completeYourPremiumPlanPayment: 'Kamilisha Malipo ya Mpango wa Premium',
    youHaveSelectedPremiumPlan: 'Umechagua mpango wa Premium. Kamilisha malipo yako ili kufungua bidhaa zisizo na kikomo na vipengele vya premium.',
    tryPaymentAgain: 'Jaribu Malipo Tena',
    createNewPayment: 'Unda Malipo Mapya',
    checkPaymentStatus: 'Angalia Hali ya Malipo',
    paymentSuccessful: 'Malipo Yamefanikiwa',
    paymentFailed: 'Malipo Yameshindwa',
    paymentPending: 'Malipo Yanasubiri',
    paymentCancelled: 'Malipo Yameghairiwa',
    proceedToPayment: 'Endelea kwa Malipo',
    paymentPageOpened: 'Ukurasa wa Malipo Umefunguliwa',
    pleaseCompletePayment: 'Tafadhali kamilisha malipo yako kwenye tabo mpya. Utaelekezwa kurudi baada ya malipo.',
    
    // Account & Settings
    deleteAccount: 'Futa Akaunti',
    permanentlyDeleteAccount: 'Futa kabisa akaunti yako ya msambazaji',
    warningActionCannotBeUndone: '⚠️ Onyo: Kitendo hiki hakiwezi kufutwa',
    accountWillBeDeactivated: 'Akaunti yako itazimwa kabisa',
    allProductsWillBeHidden: 'Bidhaa zako zote zitafichwa kutoka kwa wateja',
    loseAccessToFeatures: 'Utapoteza ufikiaji wa vipengele vyote vya msambazaji',
    orderHistoryPreserved: 'Historia yako ya maagizo na uchambuzi itahifadhiwa lakini haitapatikana',
    reasonForDeletion: 'Sababu ya Kufuta',
    feedback: 'Maoni',
    confirmDeletion: 'Thibitisha Kufuta',
    typeDeleteToConfirm: 'Andika "FUTA" ili kuthibitisha',
    companyDetails: 'Maelezo ya Kampuni',
    
    // Invoices & Billing
    invoicesBilling: 'Faktura na Malipo',
    viewDownloadInvoices: 'Angalia na pakua faktura zako za malipo na historia ya malipo',
    totalInvoices: 'Jumla ya Faktura',
    totalPaid: 'Jumla ya Kulipwa',
    totalFailed: 'Jumla ya Kushindwa',
    failedInvoices: 'Faktura Zilizoshindwa',
    invoiceNumber: 'Nambari ya Faktura',
    planName: 'Jina la Mpango',
    amount: 'Kiasi',
    date: 'Tarehe',
    transactionId: 'Kitambulisho cha Muamala',
    status: 'Hali',
    paid: 'Imelipwa',
    failed: 'Imeshindwa',
    pending: 'Inasubiri',
    cancelled: 'Imeghairiwa',
    downloadInvoice: 'Pakua Faktura',
    viewInvoice: 'Angalia Faktura',
    fromDate: 'Kutoka Tarehe',
    toDate: 'Hadi Tarehe',
    clearFilters: 'Futa Vichujio',
    noInvoicesFound: 'Hakuna faktura zilizopatikana',
    
    // Navigation
    up: 'Juu',
    upgrade: 'Boresha',
  },
}

export function getTranslation(language: Language, key: string): string {
  const keys = key.split('.')
  let value: any = translations[language]
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k]
    } else {
      // Fallback to English if translation not found
      value = translations.en
      for (const k2 of keys) {
        if (value && typeof value === 'object' && k2 in value) {
          value = value[k2]
        } else {
          return key // Return key if translation not found
        }
      }
      break
    }
  }
  
  return typeof value === 'string' ? value : key
}

export function t(language: Language) {
  return (key: string) => getTranslation(language, key)
}

