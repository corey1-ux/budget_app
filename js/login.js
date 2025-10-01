const signInForm = document.getElementById('signInForm');
const signUpForm = document.getElementById('signUpForm');

// Handle Sign Up
signUpForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('signup-email').value;
    const username = document.getElementById('signup-user').value;
    const password = document.getElementById('signup-pass').value;
    const passwordRepeat = document.getElementById('signup-pass-repeat').value;
    
    // Validate passwords match
    if (password !== passwordRepeat) {
        alert('Passwords do not match!');
        return;
    }
    
    // Validate password length
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
                    username: username,
                    full_name: username
                }
            }
        });
        
        if (error) throw error;
        
        console.log('Sign up successful:', data);
        
        // Check if email confirmation is required
        if (data.user && data.user.identities && data.user.identities.length === 0) {
            alert('This email is already registered. Please sign in instead.');
        } else if (data.session) {
            // No email confirmation needed - go straight to dashboard
            alert('Account created successfully!');
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userId', data.user.id);
            localStorage.setItem('userEmail', data.user.email);
            window.location.href = 'dashboard.html';
        } else {
            // Email confirmation needed
            alert('Account created! Please check your email to verify your account, then sign in.');
            document.getElementById('tab-1').checked = true;
            signUpForm.reset();
        }
        
    } catch (error) {
        alert('Sign up failed: ' + error.message);
        console.error('Sign up error:', error);
    }
});

// Handle Sign In
signInForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('signin-user').value;
    const password = document.getElementById('signin-pass').value;
    const rememberMe = document.getElementById('check').checked;
    
    console.log('Sign In attempt:', { email, rememberMe });
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) throw error;
        
        console.log('Login successful:', data);
        
        // Store user info
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userId', data.user.id);
        localStorage.setItem('userEmail', data.user.email);
        localStorage.setItem('username', data.user.user_metadata?.username || email);
        
        // Redirect to dashboard
        window.location.href = 'dashboard.html';
        
    } catch (error) {
        alert('Login failed: ' + error.message);
        console.error('Login error:', error);
    }
});

// Check if user is already logged in on page load
async function checkIfLoggedIn() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
            // User is already logged in, redirect to dashboard
            console.log('User already logged in, redirecting...');
            window.location.href = 'dashboard.html';
        }
    } catch (error) {
        console.error('Error checking session:', error);
    }
}

// Run on page load
checkIfLoggedIn();