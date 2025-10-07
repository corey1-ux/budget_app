// js/login.js

document.addEventListener('DOMContentLoaded', () => {
    const signInForm = document.getElementById('signInForm');
    const signUpForm = document.getElementById('signUpForm');
    const loginModal = document.getElementById('loginModal');
    const closeLoginModalBtn = document.getElementById('closeLoginModal');

    // Function to close the modal
    const closeModal = () => {
        if (loginModal) {
            loginModal.classList.remove('active');
        }
    };

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
                            full_name: email.split('@')[0]
                        }
                    }
                });
                
                if (error) throw error;
                
                if (data.user && data.user.identities && data.user.identities.length === 0) {
                    alert('This email is already registered. Please sign in instead.');
                } else {
                    alert('Account created! Please check your email to verify your account, then sign in.');
                    closeModal();
                    document.getElementById('tab-1').checked = true;
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
                // Sign out all other sessions first
                await supabase.auth.signOut({ scope: 'global' });
                
                // Then sign in
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

    // Check if already logged in
    async function checkIfLoggedIn() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                console.log('User is already logged in.');
            }
        } catch (error) {
            console.error('Error checking session:', error);
        }
    }

    checkIfLoggedIn();
});