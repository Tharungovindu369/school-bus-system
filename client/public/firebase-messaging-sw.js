importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBjHZ4KhSJN7-uH-AXPqNP-5mQUPwL8jTU",
  authDomain: "prathibha-bus-tracker.firebaseapp.com",
  projectId: "prathibha-bus-tracker",
  storageBucket: "prathibha-bus-tracker.firebasestorage.app",
  messagingSenderId: "522166488802",
  appId: "1:522166488802:web:fdffbab2f5f8d18a9d18bb"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || "Bus Tracker Notification";
  const notificationOptions = {
    body: payload.notification?.body || "Update from bus tracker",
    icon: '/logo.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
