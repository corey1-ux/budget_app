// Load navbar HTML first
async function loadNavbar() {
    try {
        const response = await fetch('components/navbar.html');
        const html = await response.text();
        
        // Insert navbar at the top of body
        document.body.insertAdjacentHTML('afterbegin', html);
        
        // Update UI based on auth state
        await updateNavUI();

        // Now initialize navbar functionality
        initNavbar();
        
    } catch (error) {
        console.error('Error loading navbar:', error);
    }
}

// Update Nav based on Login State
async function updateNavUI() {
    const userProfile = document.getElementById('userProfile');
    const userGreeting = document.getElementById('userGreeting');
    const userAvatar = document.getElementById('userAvatar');
    const signInBtn = document.getElementById('signInBtn');
    const mainNavLinks = document.querySelectorAll('.main-nav');

    try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
            // User is logged IN
            const user = session.user;
            const fullName = user.user_metadata?.full_name || user.email.split('@')[0];
            const avatarUrl = user.user_metadata?.avatar_url;

            userGreeting.textContent = `Hello, ${fullName}`;
            if (avatarUrl) {
                userAvatar.src = avatarUrl;
            }
            
            userProfile.style.display = 'flex';
            signInBtn.style.display = 'none';
            mainNavLinks.forEach(link => link.style.display = 'block');

        } else {
            // User is logged OUT
            userProfile.style.display = 'none';
            signInBtn.style.display = 'block';
            mainNavLinks.forEach(link => link.style.display = 'none'); // Hide links if not logged in
        }
    } catch (error) {
        console.error('Error updating nav UI:', error);
        userProfile.style.display = 'none';
        signInBtn.style.display = 'block';
    }
}


// Initialize navbar functionality
function initNavbar() {
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('navMenu');

    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function() {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });

        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                // Don't close menu for Settings (opens modal)
                if (link.id === 'settingsLink') {
                    return;
                }
                
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });

        document.addEventListener('click', function(event) {
            const isClickInsideNav = navMenu.contains(event.target);
            const isClickOnHamburger = hamburger.contains(event.target);
            
            if (!isClickInsideNav && !isClickOnHamburger && navMenu.classList.contains('active')) {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            }
        });
    }

    // Settings link - opens modal
    const settingsLink = document.getElementById('settingsLink');
    if (settingsLink) {
        settingsLink.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Open settings modal
            if (typeof window.openSettingsModal === 'function') {
                window.openSettingsModal();
                
                // Close hamburger menu if open
                if (hamburger) hamburger.classList.remove('active');
                if (navMenu) navMenu.classList.remove('active');
            } else {
                console.error('Settings modal not loaded yet');
            }
        });
    }

    // Logout functionality
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            
            try {
                const { error } = await supabase.auth.signOut();
                
                if (error) throw error;
                
                // Clear local storage
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('userId');
                localStorage.removeItem('userEmail');
                localStorage.removeItem('username');
                
                // Redirect to login
                window.location.href = 'index.html';
                
            } catch (error) {
                alert('Logout failed: ' + error.message);
                console.error('Logout error:', error);
            }
        });
    }
}

// Load navbar when script runs
loadNavbar();