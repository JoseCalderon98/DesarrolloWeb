// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// IMPORTANT: Reemplaza estos valores con los de tu proyecto en Firebase Console.
const firebaseConfig = {
  apiKey: "AIzaSyAjzdOdRdIx5xNk89kwY3RgNYpCUaPhCGY",
  authDomain: "desarrolloweb-2ebe5.firebaseapp.com",
  projectId: "desarrolloweb-2ebe5",
  storageBucket: "desarrolloweb-2ebe5.firebasestorage.app",
  messagingSenderId: "955494178458",
  appId: "1:955494178458:web:7a26ef518f3650e8810923",
  measurementId: "G-MNFVHBE15E"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
