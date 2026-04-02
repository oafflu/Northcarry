// Firebase Cloud Messaging Service Worker

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize Firebase in service worker
// These values will be injected at build time or can be hardcoded
const firebaseConfig = {
  apiKey: self.firebaseConfig?.apiKey || "YOUR_API_KEY",
  authDomain: self.firebaseConfig?.authDomain || "brevi-ecommerce.firebaseapp.com",
  projectId: self.firebaseConfig?.projectId || "brevi-ecommerce",
  storageBucket: self.firebaseConfig?.storageBucket || "brevi-ecommerce.appspot.com",
  messagingSenderId: self.firebaseConfig?.messagingSenderId || "YOUR_SENDER_ID",
  appId: self.firebaseConfig?.appId || "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Background message received:', payload);

  const notificationTitle = payload.notification?.title || 'BREVI';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: payload.notification?.icon || '/icon.svg',
    badge: '/icon.svg',
    image: payload.notification?.image,
    data: payload.data,
    tag: payload.data?.type || 'general',
    requireInteraction: true,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();

  const urlToOpen = event.notification.data?.url || event.notification.data?.link || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
