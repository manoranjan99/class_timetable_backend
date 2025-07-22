    // Import the functions you need from the SDKs you need
    import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
    import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-analytics.js";
    import {
    getAuth,
    signInWithPopup,
    GoogleAuthProvider
    } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
    
    const firebaseConfig = {
    apiKey: "AIzaSyB4MrS6O1ddu3gl2A0-Ki8EkFuVq176lE4",
    authDomain: "classscheduleiimk.firebaseapp.com",
    projectId: "classscheduleiimk",
    storageBucket: "classscheduleiimk.firebasestorage.app",
    messagingSenderId: "996493568119",
    appId: "1:996493568119:web:df1717722ce70c0cb83e72",
    measurementId: "G-K1FDWBYQ1N"
    };

    const app = initializeApp(firebaseConfig);
    const analytics = getAnalytics(app);
    const auth = getAuth(app);

    window.signInWithGoogle = function () {
        const provider = new GoogleAuthProvider();

        signInWithPopup(auth, provider)
            .then((result) => {
            const user = result.user;
            const email = user.email;

            if (!email.endsWith('@iimklive.com') && !email.endsWith('@iimk.ac.in')) {
                alert("Please use your IIMKLive Google account.");
                return;
            }

            document.cookie = `user_email=${email}; path=/`;
            window.location.href = '/';
            })
            .catch((error) => {
            console.error("Login failed", error);
            alert("Login failed. Please try again.");
            });
   };
