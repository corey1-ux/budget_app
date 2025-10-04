document.addEventListener('DOMContentLoaded', () => {
    const signInForm = document.getElementById('signInForm');
    const signUpForm = document.getElementById('signUpForm');
    const loginModal = document.getElementById('loginModal'); // Get the modal element
    const closeLoginModalBtn = document.getElementById('closeLoginModal'); // --- THIS IS THE FIX ---

    // Function to close the modal
    const closeModal = () => {
        if (loginModal) {
            loginModal.classList.remove('active');
        }
    };

    // --- THIS IS THE FIX ---
    // Handle Close Button Click
    if (closeLoginModalBtn) {
        closeLoginModalBtn.addEventListener('click', closeModal);
    }


    // Handle Sign Up
    if (signUpForm) {
        signUpForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-pass').value;
            const passwordRepeat = document.getElementById('signup-pass-repeat').value;
            
            if (password !== passwordRepeat) {
                alert('Passwords do not match!');
                return;
            }
            
            if (password.length < 6) {
                alert('Password must be at least 6 characters long');
                return;
            }
            
            try {
                const { data, error } = await supabase.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        data: {
                            // Using email prefix as a default full_name
                            full_name: email.split('@')[0]
                        }
                    }
                });
                
                if (error) throw error;
                
                if (data.user && data.user.identities && data.user.identities.length === 0) {
                    alert('This email is already registered. Please sign in instead.');
                } else {
                    alert('Account created! Please check your email to verify your account, then sign in.');
                    closeModal(); // Close modal on success
                    document.getElementById('tab-1').checked = true; // Switch back to sign-in tab
                    signUpForm.reset();
                }
                
            } catch (error) {
                alert('Sign up failed: ' + error.message);
                console.error('Sign up error:', error);
            }
        });
    }

    // Handle Sign In
    if (signInForm) {
        signInForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('signin-user').value;
            const password = document.getElementById('signin-pass').value;
            
            try {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password
                });
                
                if (error) throw error;
                
                console.log('Login successful:', data);
                
                // Redirect to dashboard
                window.location.href = 'dashboard.html';
                
            } catch (error) {
                alert('Login failed: ' + error.message);
                console.error('Login error:', error);
            }
        });
    }

    // This function is for redirecting already-logged-in users away from a dedicated login page.
    // Since the login is now a modal, this isn't strictly necessary but is good practice
    // to keep in case you ever link to index.html with a parameter to auto-open the modal.
    async function checkIfLoggedIn() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                // If a user is logged in and somehow the modal is open,
                // maybe redirect them, or just ensure the UI reflects their status.
                // For now, we don't need to redirect from the landing page.
                console.log('User is already logged in.');
            }
        } catch (error) {
            console.error('Error checking session:', error);
        }
    }

    checkIfLoggedIn();
});