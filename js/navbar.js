// Load navbar HTML first
async function loadNavbar() {
    try {
        const response = await fetch('components/navbar.html');
        const html = await response.text();
        
        // Insert navbar at the top of body
        document.body.insertAdjacentHTML('afterbegin', html);
        
        // Initialize dark mode FIRST (before other UI updates)
        initializeDarkMode();
        
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

// Initialize dark mode on page load
function initializeDarkMode() {
    console.log('Initializing dark mode...');
    
    // Check saved preference
    const savedMode = localStorage.getItem('darkMode');
    console.log('Saved dark mode preference:', savedMode);
    
    const isDarkMode = savedMode === 'true';
    console.log('Should enable dark mode:', isDarkMode);
    
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        console.log('Dark mode class added to body');
    } else {
        document.body.classList.remove('dark-mode');
        console.log('Dark mode class removed from body');
    }
    
    console.log('Body classes after init:', document.body.className);
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
    const userAvatar = document.getElementById('userAvatar');
    const avatarDropdown = document.getElementById('avatarDropdown');

    // Hamburger menu
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function() {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });

        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', function(e) {
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

    // Avatar dropdown
    if (userAvatar && avatarDropdown) {
        userAvatar.addEventListener('click', function(e) {
            e.stopPropagation();
            avatarDropdown.classList.toggle('visible');
            
            // Update dark mode UI when opening dropdown
            const isDarkMode = document.body.classList.contains('dark-mode');
            updateDarkModeUI(isDarkMode);
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', function(event) {
            if (!avatarDropdown.contains(event.target) && event.target !== userAvatar) {
                avatarDropdown.classList.remove('visible');
            }
        });
    }

    // Dark mode toggle
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('Dark mode toggle clicked!');
            console.log('Current body classes:', document.body.className);
            console.log('Has dark-mode class before toggle:', document.body.classList.contains('dark-mode'));
            
            // Toggle dark mode
            const isDark = document.body.classList.toggle('dark-mode');
            
            console.log('Dark mode is now:', isDark);
            console.log('Body classes after toggle:', document.body.className);
            
            // Save preference
            localStorage.setItem('darkMode', isDark.toString());
            console.log('Saved to localStorage:', localStorage.getItem('darkMode'));
            
            // Update UI
            updateDarkModeUI(isDark);
            
            // Close dropdown
            if (avatarDropdown) avatarDropdown.classList.remove('visible');
        });
    }

    // Settings link in dropdown
    const settingsDropdownLink = document.getElementById('settingsDropdownLink');
    if (settingsDropdownLink) {
        settingsDropdownLink.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Close dropdown
            if (avatarDropdown) avatarDropdown.classList.remove('visible');
            
            // Open settings modal
            if (typeof window.openSettingsModal === 'function') {
                window.openSettingsModal();
            } else {
                console.error('Settings modal not loaded yet');
            }
        });
    }

    // Logout in dropdown
    const logoutDropdownBtn = document.getElementById('logoutDropdownBtn');
    if (logoutDropdownBtn) {
        logoutDropdownBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            
            // Close dropdown
            if (avatarDropdown) avatarDropdown.classList.remove('visible');
            
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

// Update dark mode button text and icon
function updateDarkModeUI(isDark) {
    console.log('Updating dark mode UI:', isDark);
    console.log('Body background color:', window.getComputedStyle(document.body).backgroundColor);
    
    const darkModeText = document.getElementById('darkModeText');
    const darkModeIcon = document.getElementById('darkModeIcon');
    
    if (darkModeText) {
        darkModeText.textContent = isDark ? 'Light Mode' : 'Dark Mode';
        console.log('Text updated to:', darkModeText.textContent);
    }
    
    if (darkModeIcon) {
        // Change the icon
        const newIcon = isDark ? 'sun' : 'lightbulb';
        darkModeIcon.setAttribute('data-lucide', newIcon);
        console.log('Icon changed to:', newIcon);
        
        // Reinitialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
}

// Initialize month navigation in navbar
function initMonthNavInNavbar() {
    // Don't show month navigation on certain pages
    const currentPage = window.location.pathname.split('/').pop();
    const pagesWithoutMonthNav = ['accounts.html', 'index.html', 'login.html', 'signup.html'];
    
    const monthNavContainer = document.getElementById('monthNavInline');
    const navbarTop = document.querySelector('.navbar-top');
    
    if (pagesWithoutMonthNav.includes(currentPage)) {
        // Hide month navigation on these pages
        if (monthNavContainer) {
            monthNavContainer.style.display = 'none';
        }
        if (navbarTop) {
            navbarTop.classList.add('no-month-nav');
        }
        return;
    }
    
    // Show month navigation for other pages
    if (monthNavContainer) {
        monthNavContainer.style.display = 'flex';
    }
    
    // Get elements
    const prevMonthBtn = document.getElementById('prevMonth');
    const nextMonthBtn = document.getElementById('nextMonth');
    const monthDisplayEl = document.getElementById('currentMonthDisplay');
    const goToCurrentMonthBtn = document.getElementById('goToCurrentMonth');
    
    if (!prevMonthBtn || !nextMonthBtn || !monthDisplayEl) {
        console.error('Month navigation elements not found');
        return;
    }
    
    // Update month display
    function updateMonthDisplay() {
        if (typeof MonthNavigation === 'undefined') return;
        
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
    
    // Initialize
    if (typeof MonthNavigation !== 'undefined') {
        MonthNavigation.init();
        updateMonthDisplay();
        
        // Fire ready event
        const readyEvent = new CustomEvent('monthNavReady');
        window.dispatchEvent(readyEvent);
    }
}

// Load navbar when script runs
loadNavbar();