export type NotificationPayload = {
  title: string
  message: string
  type?: string
  link?: string
  metadata?: Record<string, any>
}

// Placeholder notification sender to avoid build-time module errors.
// If a real notification service is added later, replace this stub.
export async function sendNotification(userId: string, payload: NotificationPayload) {
  console.info('[notifications] sendNotification stub called', { userId, payload })
  return { success: true }
}
