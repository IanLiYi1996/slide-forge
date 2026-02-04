// S3 Storage Service Layer
// Provides a complete replacement for PostgreSQL/Prisma storage

// Core S3 client operations
export {
  getObject,
  putObject,
  putObjectSimple,
  deleteObject,
  deleteObjects,
  objectExists,
  listObjects,
  listAllObjects,
  withOptimisticLock,
  getObjectWithVersion,
  BUCKET_NAME,
  DATA_PREFIX,
  type S3ObjectWithVersion,
  type PutOptions,
  type ListOptions,
  type ListResult,
} from './s3-client';

// Index management for efficient queries
export {
  getUserDocumentsIndex,
  addDocumentToIndex,
  updateDocumentInIndex,
  removeDocumentFromIndex,
  getPublicDocumentsIndex,
  getUserSessionsIndex,
  addSessionToIndex,
  updateSessionInIndex,
  removeSessionFromIndex,
  type DocumentIndexEntry,
  type UserDocumentsIndex,
  type SessionIndexEntry,
  type UserSessionsIndex,
  type PublicDocumentsIndex,
} from './index-service';

// User profile management
export {
  getUserProfile,
  getUserData,
  createUserProfile,
  updateUserProfile,
  deleteUserProfile,
  addAccount,
  getAccountByProvider,
  updateAccount,
  removeAccount,
  ensureUserExists,
  type UserRole,
  type UserProfile,
  type AccountInfo,
  type UserData,
} from './user-service';

// Document/Presentation management
export {
  createPresentation,
  getPresentation,
  getPresentationContent,
  updatePresentation,
  deletePresentation,
  deletePresentations,
  getUserPresentations,
  getPublicPresentations,
  getUserPublicPresentations,
  flattenPresentation,
  type DocumentType,
  type PresentationMode,
  type BaseDocumentData,
  type PresentationData,
  type DocumentWithPresentation,
  type FlatPresentation,
} from './document-service';

// Session management (Agent and Document Processor)
export {
  createAgentSession,
  getAgentSession,
  getAgentSessionByUserId,
  getAgentSessionBySdkId,
  updateAgentSession,
  updateAgentSessionMessages,
  saveAgentSessionOutline,
  saveAgentSessionSlides,
  updateAgentSessionStatus,
  deleteAgentSession,
  getUserAgentSessions,
  cleanupOldAgentSessions,
  createDocProcessorSession,
  getDocProcessorSession,
  getDocProcessorSessionByUserId,
  updateDocProcessorSession,
  deleteDocProcessorSession,
  getUserDocProcessorSessions,
  type SessionStatus,
  type WorkflowStage,
  type Message,
  type AgentSessionData,
  type DocumentProcessorSessionData,
} from './session-service';

// Quota management
export {
  getUserQuotas,
  getQuota,
  checkQuota,
  checkAndUpdateQuota,
  incrementQuota,
  addPurchasedQuota,
  resetQuota,
  resetAllExpiredQuotas,
  formatQuotaForDisplay,
  ALL_USAGE_TYPES,
  DEFAULT_QUOTAS,
  type UsageType,
  type PeriodType,
  type QuotaEntry,
  type UserQuotas,
  type CheckQuotaResult,
} from './quota-service';

// Usage logging and statistics
export {
  logUsage,
  getUserUsageLogs,
  getUserUsageStats,
  getRecentUsage,
  getUsageByResource,
  type UsageLogEntry,
  type UsageStats,
} from './usage-service';

// API configuration management
export {
  getApiConfiguration,
  getUserApiConfigurations,
  createApiConfiguration,
  updateApiConfiguration,
  deleteApiConfiguration,
  getActiveApiConfiguration,
  setApiConfigurationActive,
  type ApiConfiguration,
} from './api-config-service';

// Theme management
export {
  getTheme,
  getThemeByUserId,
  createTheme,
  updateTheme,
  deleteTheme,
  getUserThemes,
  getPublicThemes,
  type CustomTheme,
} from './theme-service';

// Purchase management
export {
  createPurchase,
  getPurchase,
  updatePurchase,
  getUserPurchases,
  getPurchaseStats,
  deletePurchase,
  type PurchaseStatus,
  type QuotaPurchase,
} from './purchase-service';

// Generated image management
export {
  createGeneratedImage,
  getGeneratedImage,
  getUserGeneratedImages,
  deleteGeneratedImage,
  type GeneratedImage,
} from './generated-image-service';
