// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBvlai2O1z823KfiNth57nLVx8eio2IqDI",
  authDomain: "sistemarpg-14d7d.firebaseapp.com",
  projectId: "sistemarpg-14d7d",
  storageBucket: "sistemarpg-14d7d.firebasestorage.app",
  messagingSenderId: "1013470257764",
  appId: "1:1013470257764:web:6fb83cb365f51894327571",
  measurementId: "G-CLQX5SGD2W"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);