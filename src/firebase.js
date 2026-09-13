// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// IMPORTANT: Reemplaza estos valores con los de tu proyecto en Firebase Console.
const firebaseConfig = {
  apiKey: "AIzaSyCYQEojGcBE5G-t-fxjzdH7MIHa4fk2kn0",
  authDomain: "desarrolloweb-e8531.firebaseapp.com",
  projectId: "desarrolloweb-e8531",
  storageBucket: "desarrolloweb-e8531.firebasestorage.app",
  messagingSenderId: "986911853700",
  appId: "1:986911853700:web:7f98d474de54ab495006d1"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
