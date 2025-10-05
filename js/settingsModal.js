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
    window.openSettingsModal = async function() {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent background scroll
        
        // Populate profile tab with current user data
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                document.getElementById('fullName').value = user.user_metadata.full_name || '';
                document.getElementById('avatarPreview').src = user.user_metadata.avatar_url || 'https://ozherbfevdunekopxwli.supabase.co/storage/v1/object/public/avatars/default-avatar.png';
            }
        } catch (error) {
            console.error('Error fetching user data for modal:', error);
        }
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
    initProfileForms(); // Initialize the new profile forms
}

// Initialize account forms
function initAccountForms() {
    const changeEmailForm = document.getElementById('changeEmailForm');
    const changePasswordForm = document.getElementById('changePasswordForm');
    const emailNotifications = document.getElementById('emailNotifications');
    const deleteAccountBtn = document.getElementById('deleteUserAccountBtn');
    
    // Change Email
    if (changeEmailForm) {
        changeEmailForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const newEmail = document.getElementById('newEmail').value;
            const currentPassword = document.getElementById('currentPassword').value;

            // First, get the current user's email
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) {
                alert('Could not get user information. Please log in again.');
                return;
            }

            // Verify the user's current password by trying to sign in with it.
            // This proves they own the account.
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: currentPassword,
            });

            if (signInError) {
                alert('Incorrect password. Please try again.');
                return; // Stop the function if the password is wrong
            }
            
            // If password was correct, proceed with updating the email
            try {
                const { data, error } = await supabase.auth.updateUser({ email: newEmail });
                if (error) throw error;
                
                alert('Update request sent! Check your NEW email inbox for a verification link to complete the change. A notification has also been sent to your old address.');
                changeEmailForm.reset();
                
            } catch (error) {
                alert('Email change failed: ' + error.message);
                console.error('Email change error:', error);
            }
        });
    }
    
    // Change Password
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            if (newPassword.length < 6) {
                alert('Password must be at least 6 characters long.');
                return;
            }
            
            if (newPassword !== confirmPassword) {
                alert('Passwords do not match!');
                return;
            }
            
            try {
                const { data, error } = await supabase.auth.updateUser({ password: newPassword });
                if (error) throw error;
                
                alert('Password updated successfully!');
                changePasswordForm.reset();
                
            } catch (error) {
                alert('Password change failed: ' + error.message);
                console.error('Password change error:', error);
            }
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
    if (deleteUserAccountBtn) {
        deleteAccountBtn.addEventListener('click', function() {
            alert('Account deletion is a server-side operation and has not been implemented in this version.');
            // NOTE: To implement this, you would need a Supabase Edge Function
            // that takes the user's JWT, verifies it, and then uses the service_role
            // key to delete the user via `supabase.auth.admin.deleteUser(userId)`.
            // Client-side deletion is disabled for security reasons.
        });
    }
}


// --- PROFILE UPDATE LOGIC ---
function initProfileForms() {
    const updateNameForm = document.getElementById('updateNameForm');
    const updateAvatarForm = document.getElementById('updateAvatarForm');
    const avatarUploadInput = document.getElementById('avatarUpload');
    const avatarPreview = document.getElementById('avatarPreview');
    const uploadAvatarBtn = document.getElementById('uploadAvatarBtn');

    let selectedFile = null;

    // Handle Name Update
    updateNameForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = document.getElementById('fullName').value;

        try {
            const { data, error } = await supabase.auth.updateUser({
                data: { full_name: fullName }
            });
            if (error) throw error;

            alert('Name updated successfully!');
            await updateNavUI(); // Refresh navbar
        } catch (error) {
            alert('Failed to update name: ' + error.message);
        }
    });

    // Handle File Selection
    avatarUploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Check file size (e.g., max 1MB)
        if (file.size > 1024 * 1024) {
            alert('File is too large! Please select an image under 1MB.');
            return;
        }

        selectedFile = file;
        const reader = new FileReader();
        reader.onload = (event) => {
            avatarPreview.src = event.target.result;
        };
        reader.readAsDataURL(file);
        
        uploadAvatarBtn.disabled = false;
    });

    // Handle Avatar Upload
    updateAvatarForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedFile) return;

        uploadAvatarBtn.disabled = true;
        uploadAvatarBtn.textContent = 'Uploading...';

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not found.');

            const fileExt = selectedFile.name.split('.').pop();
            // --- THIS IS THE FIX ---
            // Create a path with a folder named after the user's ID
            const filePath = `${user.id}/avatar.${fileExt}`;

            // Upload the file to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('avatar')
                .upload(filePath, selectedFile, { upsert: true });

            if (uploadError) throw uploadError;

            // Get the public URL of the uploaded file
            const { data: { publicUrl } } = supabase.storage
                .from('avatar')
                .getPublicUrl(filePath);

            // Update user metadata with the new avatar URL
            const { error: updateError } = await supabase.auth.updateUser({
                data: { avatar_url: publicUrl }
            });

            if (updateError) throw updateError;
            
            alert('Profile picture updated successfully!');
            await updateNavUI(); // Refresh the navbar with the new picture

        } catch (error) {
            alert('Failed to upload avatar: ' + error.message);
        } finally {
            uploadAvatarBtn.disabled = false;
            uploadAvatarBtn.textContent = 'Upload & Save';
            selectedFile = null;
        }
    });
}


// Load modal on script run
loadSettingsModal();