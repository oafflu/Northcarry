// Firebase client-side utilities
// Uses Firebase loaded from CDN in layout.tsx

declare global {
  interface Window {
    firebase: any;
    firebaseAppsInitialized?: boolean;
  }
}

/**
 * Get Firebase Messaging instance (only in browser)
 */
export async function getFirebaseMessaging(): Promise<any | null> {
  if (typeof window === 'undefined') return null;
  
  if (!window.firebase) {
    console.warn('Firebase not loaded. Make sure Firebase scripts are included in layout.tsx');
    return null;
  }

  try {
    if (!window.firebase.messaging) {
      console.warn('Firebase Messaging not available');
      return null;
    }
    
    return window.firebase.messaging();
  } catch (error) {
    console.error('Error getting messaging instance:', error);
    return null;
  }
}

/**
 * Request notification permission and get FCM token
 */
export async function requestNotificationPermission(): Promise<string | null> {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('Notifications not supported');
      return null;
    }

    // Check if permission is already granted
    if (Notification.permission === 'granted') {
      return await getFCMToken();
    }

    // Request permission
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      return await getFCMToken();
    }
    
    console.warn('Notification permission denied');
    return null;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return null;
  }
}

/**
 * Get FCM token
 */
export async function getFCMToken(): Promise<string | null> {
  try {
    const messagingInstance = await getFirebaseMessaging();
    if (!messagingInstance) return null;

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn('FCM VAPID key not configured');
      return null;
    }

    const token = await messagingInstance.getToken({ vapidKey });
    return token;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
}

/**
 * Listen for foreground messages
 */
export async function onForegroundMessage(callback: (payload: any) => void) {
  try {
    const messagingInstance = await getFirebaseMessaging();
    if (!messagingInstance) return;

    messagingInstance.onMessage((payload: any) => {
      console.log('Foreground message received:', payload);
      callback(payload);
    });
  } catch (error) {
    console.error('Error setting up foreground message listener:', error);
  }
}
