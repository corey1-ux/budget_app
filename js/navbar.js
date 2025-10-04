// Load navbar HTML first
async function loadNavbar() {
    try {
        const response = await fetch('components/navbar.html');
        const html = await response.text();
        
        // Insert navbar at the top of body
        document.body.insertAdjacentHTML('afterbegin', html);
        
        // Update UI based on auth state
        await updateNavUI();

        // Initialize navbar functionality
        initNavbar();
        
        // Initialize month navigation if needed
        initMonthNavInNavbar();
        
    } catch (error) {
        console.error('Error loading navbar:', error);
    }
}

async function updateNavUI() {
    const userProfile = document.getElementById('userProfile');
    const userGreeting = document.getElementById('userGreeting');
    const userAvatar = document.getElementById('userAvatar');
    const signInBtn = document.getElementById('signInBtn');
    const mainNavLinks = document.querySelectorAll('.main-nav');

    try {
        const { data: { session } } = await supabase.auth.getSession();
        const isLandingPage = window.location.pathname === '/' || window.location.pathname.endsWith('/index.html');

        if (session) {
            // User is logged IN
            const user = session.user;
            
            if (isLandingPage) {
                // On landing page, show a "Go to Dashboard" button
                if (signInBtn) {
                    signInBtn.textContent = 'Go to Dashboard';
                    signInBtn.href = 'dashboard.html';
                    signInBtn.style.display = 'block';
                }
                if (userProfile) userProfile.style.display = 'none';
                mainNavLinks.forEach(link => link.style.display = 'none');
            } else {
                // On app pages, show the full user profile
                const fullName = user.user_metadata?.full_name || user.email.split('@')[0];
                const avatarUrl = user.user_metadata?.avatar_url;
                if(userGreeting) userGreeting.textContent = `Hello, ${fullName}`;
                
                if (avatarUrl && userAvatar) userAvatar.src = avatarUrl;
                
                if (userProfile) userProfile.style.display = 'flex';
                if (signInBtn) signInBtn.style.display = 'none';
                mainNavLinks.forEach(link => link.style.display = 'block');
            }
        } else {
            // User is logged OUT
            if (userProfile) userProfile.style.display = 'none';
            if (signInBtn) {
                signInBtn.textContent = 'Sign In';
                signInBtn.href = 'index.html';
                signInBtn.style.display = 'block';
            }
            mainNavLinks.forEach(link => link.style.display = 'none');
        }
    } catch (error) {
        console.error('Error updating nav UI:', error);
        if (userProfile) userProfile.style.display = 'none';
        if (signInBtn) signInBtn.style.display = 'block';
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

// Initialize month navigation in navbar
function initMonthNavInNavbar() {
    const monthNavInline = document.getElementById('monthNavInline');
    
    // Only show month nav on specific pages
    const currentPage = window.location.pathname.split('/').pop();
    const pagesWithMonthNav = ['dashboard.html', 'budget.html', 'transactions.html'];
    
    if (pagesWithMonthNav.includes(currentPage) && monthNavInline) {
        monthNavInline.style.display = 'flex';
        
        const prevMonthBtn = document.getElementById('prevMonth');
        const nextMonthBtn = document.getElementById('nextMonth');
        const goToCurrentMonthBtn = document.getElementById('goToCurrentMonth');
        const monthDisplayEl = document.getElementById('currentMonthDisplay');
        
        if (!prevMonthBtn || !nextMonthBtn || !monthDisplayEl) {
            console.error('Month nav elements not found');
            return;
        }
        
        // Update month display
        function updateMonthDisplay() {
            monthDisplayEl.textContent = MonthNavigation.getDisplayName(MonthNavigation.currentMonth);
            
            if (goToCurrentMonthBtn) {
                if (MonthNavigation.isViewingCurrentMonth()) {
                    goToCurrentMonthBtn.classList.add('hidden');
                } else {
                    goToCurrentMonthBtn.classList.remove('hidden');
                }
            }
        }
        
        // Event listeners
        prevMonthBtn.addEventListener('click', () => {
            MonthNavigation.previousMonth();
            updateMonthDisplay();
            window.dispatchEvent(new CustomEvent('monthChanged'));
        });
        
        nextMonthBtn.addEventListener('click', () => {
            MonthNavigation.nextMonth();
            updateMonthDisplay();
            window.dispatchEvent(new CustomEvent('monthChanged'));
        });
        
        if (goToCurrentMonthBtn) {
            goToCurrentMonthBtn.addEventListener('click', () => {
                MonthNavigation.goToCurrent();
                updateMonthDisplay();
                window.dispatchEvent(new CustomEvent('monthChanged'));
            });
        }
        
        // Initialize display
        MonthNavigation.init();
        updateMonthDisplay();
        
        // Fire ready event
        const readyEvent = new CustomEvent('monthNavReady');
        window.dispatchEvent(readyEvent);
    }
}

// Load navbar when script runs
loadNavbar();