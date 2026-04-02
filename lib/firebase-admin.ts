import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      console.warn('Firebase Admin credentials not configured. Push notifications will be disabled.');
    } else {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      console.log('✅ Firebase Admin initialized successfully');
    }
  } catch (error) {
    console.error('❌ Firebase Admin initialization error:', error);
  }
}

export const messaging = admin.apps.length > 0 ? admin.messaging() : null;

// Types
export interface PushNotificationData {
  title: string;
  body: string;
  icon?: string;
  image?: string;
  url?: string;
  data?: Record<string, string>;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
  invalidToken?: boolean;
}

/**
 * Send push notification to a single device token
 */
export async function sendPushNotification(
  token: string,
  notification: PushNotificationData
): Promise<NotificationResult> {
  if (!messaging) {
    return {
      success: false,
      error: 'Firebase Admin not initialized',
    };
  }

  try {
    const message: admin.messaging.Message = {
      token,
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.image,
      },
      data: notification.data || {},
      webpush: {
        fcmOptions: {
          link: notification.url || process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com',
        },
        notification: {
          icon: notification.icon || '/icon.svg',
          badge: '/icon.svg',
          requireInteraction: true,
          tag: notification.data?.type || 'general',
        },
      },
    };

    const messageId = await messaging.send(message);
    
    return {
      success: true,
      messageId,
    };
  } catch (error: any) {
    console.error('Push notification error:', error);
    
    // Handle invalid/expired tokens
    if (
      error.code === 'messaging/invalid-registration-token' ||
      error.code === 'messaging/registration-token-not-registered'
    ) {
      return {
        success: false,
        error: 'INVALID_TOKEN',
        invalidToken: true,
      };
    }
    
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Send push notification to multiple device tokens
 */
export async function sendMulticastPushNotification(
  tokens: string[],
  notification: PushNotificationData
): Promise<{
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
}> {
  if (!messaging) {
    return { successCount: 0, failureCount: tokens.length, invalidTokens: [] };
  }

  if (tokens.length === 0) {
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  try {
    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.image,
      },
      data: notification.data || {},
      webpush: {
        fcmOptions: {
          link: notification.url || process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com',
        },
        notification: {
          icon: notification.icon || '/icon.svg',
          badge: '/icon.svg',
          requireInteraction: true,
          tag: notification.data?.type || 'general',
        },
      },
    };

    const response = await messaging.sendEachForMulticast(message);
    
    // Collect invalid tokens
    const invalidTokens: string[] = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const error = resp.error;
        if (
          error?.code === 'messaging/invalid-registration-token' ||
          error?.code === 'messaging/registration-token-not-registered'
        ) {
          invalidTokens.push(tokens[idx]);
        }
      }
    });

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      invalidTokens,
    };
  } catch (error) {
    console.error('Multicast push notification error:', error);
    return {
      successCount: 0,
      failureCount: tokens.length,
      invalidTokens: [],
    };
  }
}

export default admin;
