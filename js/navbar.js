// Load navbar HTML first
async function loadNavbar() {
    try {
        const response = await fetch('components/navbar.html');
        const html = await response.text();
        
        // Insert navbar at the top of body
        document.body.insertAdjacentHTML('afterbegin', html);
        
        // Now initialize navbar functionality
        initNavbar();
        
    } catch (error) {
        console.error('Error loading navbar:', error);
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