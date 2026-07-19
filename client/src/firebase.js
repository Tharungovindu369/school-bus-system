import { initializeApp } from 'firebase/app';
import { getMessaging, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyBjHZ4KhSJN7-uH-AXPqNP-5mQUPwL8jTU",
  authDomain: "prathibha-bus-tracker.firebaseapp.com",
  projectId: "prathibha-bus-tracker",
  storageBucket: "prathibha-bus-tracker.firebasestorage.app",
  messagingSenderId: "522166488802",
  appId: "1:522166488802:web:fdffbab2f5f8d18a9d18bb"
};

const app = initializeApp(firebaseConfig);

let messagingInstance = null;

export const getMessagingInstance = async () => {
  if (typeof window !== 'undefined' && await isSupported()) {
    if (!messagingInstance) {
      messagingInstance = getMessaging(app);
    }
    return messagingInstance;
  }
  return null;
};
export const isMessagingSupported = async () => {
  return typeof window !== 'undefined' && await isSupported();
};
