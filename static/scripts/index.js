  import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
  import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
  import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js"; import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-analytics.js";

  

    // Your web app's Firebase configuration
    const firebaseConfig = {
        apiKey: "AIzaSyB4MrS6O1ddu3gl2A0-Ki8EkFuVq176lE4",
        authDomain: "classscheduleiimk.firebaseapp.com",
        projectId: "classscheduleiimk",
        storageBucket: "classscheduleiimk.firebasestorage.app",
        messagingSenderId: "996493568119",
        appId: "1:996493568119:web:df1717722ce70c0cb83e72",
        measurementId: "G-K1FDWBYQ1N"
    };

    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const auth = getAuth();
    const db = getFirestore(app);

    let choicesInstance;
     const allSubjects = [
        "GT-A", "GT-B", 
        "DVT-A", "DVT-B", 
        "MOS-A", "MOS-B", 
        "IMC-A", "IMC-B", 
        "BS-A", "BS-B", 
        "SCM-A", "SCM-B", 
        "MAJVCG-A", "MAJVCG-B", 
        "IP", "ER", "SCF", "IF", "FRA", "MACR", "FINTECH", 
        "WTKY", "UPP", "FS", "AIB", "CB", "SDM", "AMMR", "SM", "MMT", 
        "MEIW", "GWO", "NWE", "LS", "OS", "DAR", 
        "PM", "CSL", "MFSA", "SI", "MFB", "XCBP", 
    
        // Finance electives
        "ER (FIN)", "HFS (FIN)", "FINT (FIN-Core)", "FRM (FIN-Core)", 
        "OSD (FIN-Core)", "IF (FIN-Core)",
    
        // LSM electives
        "XCBP (LSM)", "CB (LSM)", "EM (LSM)", "FS (LSM)", 
    
        // LSM Core
        "SOI (LSM-Core)", "MSB (LSM-Core)", "DIBT (LSM-Core)", 
        "AL (LSM-Core)", "BPP (LSM-Core)"
    ];

    document.addEventListener("DOMContentLoaded", function () {
    populateSubjectDropdown();

    onAuthStateChanged(auth, async (user) => {
    if (user) {
        const email = user.email;
        const docRef = doc(db, "user_subjects", email);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const subjects = docSnap.data().subjects || [];
            localStorage.setItem("mySubjects", JSON.stringify(subjects));
            choicesInstance.setValue(subjects);
        } else {
            console.log("No saved subjects for user");
        }
      }
    });

     if (choicesInstance) {
        choicesInstance.destroy(); // Destroy old instance
     }

    choicesInstance = new Choices('#subjectSelect', {
        removeItemButton: true,
        shouldSort: true,
        placeholder: true,
        placeholderValue: 'Select your subjects',
        searchEnabled: true,
    });

    });

    function populateSubjectDropdown() {
        const select = document.getElementById("subjectSelect");
        select.innerHTML = ""; // Clear existing

        allSubjects.forEach(subject => {
            const option = document.createElement("option");
            option.value = subject;
            option.textContent = subject;
            select.appendChild(option);
        });
    }

    window.openSubjectDialog = openSubjectDialog; 
   
    function openSubjectDialog() {
        const dialog = document.getElementById("subjectDialog");
        dialog.style.display = "flex";

        const stored = JSON.parse(localStorage.getItem("mySubjects") || "[]");
        const select = document.getElementById("subjectSelect");
        for (let option of select.options) {
            option.selected = stored.includes(option.value);
        }
    }

    window.closeSubjectDialog = closeSubjectDialog;

    function closeSubjectDialog() {
        document.getElementById("subjectDialog").style.display = "none";
    }

    window.saveSubjects = saveSubjects;
    window.resetSubjects = resetSubjects;

    async function saveSubjects() {
    const selected = choicesInstance.getValue(true); // selected subjects
    closeSubjectDialog();
    localStorage.setItem("mySubjects", JSON.stringify(selected));

    const user = auth.currentUser;
    if (user) {
        const email = user.email;
        const docRef = doc(db, "user_subjects", email);
        try {
            await setDoc(docRef, { subjects: selected }, { merge: true });
            console.log("Subjects saved for", email);

            // Now call the backend to update Flask session
            await fetch("/set_subjects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ subjects: selected }),
            });

            // Then reload AFTER everything is done
            window.location.reload();
        } catch (error) {
            console.error("Error saving subjects:", error);
        }
    }
   }

    function resetSubjects() {
        localStorage.removeItem("mySubjects");
    }


    async function sendSubjectsToBackend() {
    let subjects = JSON.parse(localStorage.getItem("mySubjects") || "[]");

    if (!subjects.length) {
        // fallback: fetch from Firebase if not in cache
        const userEmail = document.body.dataset.email;
        const dbRef = firebase.database().ref("users/" + userEmail.replace(".", "_"));
        const snapshot = await dbRef.get();
        subjects = snapshot.val()?.subjects || [];
        localStorage.setItem("mySubjects", JSON.stringify(subjects));
    }
    console.log(subjects)

        // Send to Flask backend
        await fetch("/set_subjects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subjects }),
        });
    } 

    window.onload = sendSubjectsToBackend;


