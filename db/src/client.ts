import { PrismaClient, Prisma as PrismaNamespace } from './generated'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['error', 'warn']
      : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Re-export everything from Prisma client for convenience
export * from './generated'

// Explicitly re-export Prisma namespace (for ESM/CJS compatibility)
export { PrismaNamespace as Prisma }

// Explicitly re-export enums (for ESM/CJS compatibility)
export {
  // User & Auth
  UserRole,
  // Channel & Shop
  ChannelKind,
  ChannelPlatform,
  // Orders & Payments
  CustomerOrderStatus,
  TossPaymentMethod,
  TossPaymentStatus,
  // Pricing & Discounts
  DiscountType,
  // Inquiries
  InquiryType,
  InquiryStatus,
  // Returns & Refunds
  ReturnType,
  ReturnStatus,
  RefundMethod,
  // Settlement
  SettlementStatus,
  // Notifications
  NotificationType,
  // Sourcing & AI
  SourcingPlatform,
  AiProvider,
  // Workflow
  WorkflowType,
  WorkflowStatus,
  TriggerType,
  StepType,
  StepStatus,
} from './generated'

// Toss Payments 공통 타입
export type {
  TossTransaction,
  TossTransactionsResponse,
  TransactionsSummary,
} from './types/toss-payments.types'

// Default export for backwards compatibility
export default prisma
