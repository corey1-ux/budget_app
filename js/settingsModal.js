// Load settings modal component
async function loadSettingsModal() {
    try {
        const response = await fetch('components/settingsModal.html');
        const html = await response.text();
        
        // Insert at end of body
        document.body.insertAdjacentHTML('beforeend', html);
        
        // Initialize modal
        initSettingsModal();
        
    } catch (error) {
        console.error('Error loading settings modal:', error);
    }
}

// Initialize settings modal functionality
function initSettingsModal() {
    const modal = document.getElementById('settingsModal');
    const closeBtn = document.getElementById('closeSettingsModal');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    // Open modal function (called from navbar)
    window.openSettingsModal = function() {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent background scroll
    };
    
    // Close modal
    function closeModal() {
        modal.classList.remove('active');
        document.body.style.overflow = ''; // Restore scroll
    }
    
    closeBtn.addEventListener('click', closeModal);
    
    // Close on overlay click
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeModal();
        }
    });
    
    // Tab switching
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            
            // Remove active from all tabs and panes
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            
            // Add active to clicked tab and corresponding pane
            this.classList.add('active');
            document.getElementById(`${tabName}-tab`).classList.add('active');
        });
    });
    
    // Initialize forms
    initAccountForms();
}

// Initialize account forms
function initAccountForms() {
    const changeEmailForm = document.getElementById('changeEmailForm');
    const changePasswordForm = document.getElementById('changePasswordForm');
    const emailNotifications = document.getElementById('emailNotifications');
    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    
    // Change Email
    if (changeEmailForm) {
        changeEmailForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const newEmail = document.getElementById('newEmail').value;
            
            // TODO: Implement with Supabase in next step
            alert(`Email change requested: ${newEmail}`);
            changeEmailForm.reset();
        });
    }
    
    // Change Password
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            if (newPassword !== confirmPassword) {
                alert('Passwords do not match!');
                return;
            }
            
            // TODO: Implement with Supabase in next step
            alert('Password change requested');
            changePasswordForm.reset();
        });
    }
    
    // Email Notifications Toggle
    if (emailNotifications) {
        // Load saved preference
        const saved = localStorage.getItem('emailNotifications');
        emailNotifications.checked = saved === 'true';
        
        emailNotifications.addEventListener('change', function() {
            localStorage.setItem('emailNotifications', this.checked);
            alert(`Email notifications ${this.checked ? 'enabled' : 'disabled'}`);
        });
    }
    
    // Delete Account
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', function() {
            const confirmed = confirm('Are you sure you want to delete your account? This action cannot be undone!');
            if (confirmed) {
                const doubleCheck = prompt('Type "DELETE" to confirm:');
                if (doubleCheck === 'DELETE') {
                    // TODO: Implement with Supabase in next step
                    alert('Account deletion requested');
                }
            }
        });
    }
}

// Load modal on script run
loadSettingsModal();