// js/accounts.js

// ==========================================
// STATE MANAGEMENT
// ==========================================

let isInitialized = false;

// ==========================================
// INITIALIZATION
// ==========================================

async function initializeAccountsPage() {
    const user = await requireAuth();
    if (!user) return;

    // Set up event listeners (only once)
    if (!isInitialized) {
        setupEventListeners();
        isInitialized = true;
    }
    
    // Load accounts data
    await fetchAndRenderAccounts();
}

function setupEventListeners() {
    const showAddAccountModalBtn = document.getElementById('showAddAccountModalBtn');
    const closeAccountModalBtn = document.getElementById('closeAccountModalBtn');
    const accountModal = document.getElementById('accountModal');
    const accountForm = document.getElementById('accountForm');
    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    
    // Show modal
    if (showAddAccountModalBtn) {
        showAddAccountModalBtn.addEventListener('click', () => showModal());
    }
    
    // Close modal
    if (closeAccountModalBtn) {
        closeAccountModalBtn.addEventListener('click', hideModal);
    }
    
    // Close modal on overlay click
    if (accountModal) {
        accountModal.addEventListener('click', (e) => {
            if (e.target === accountModal) hideModal();
        });
    }
    
    // Form submission
    if (accountForm) {
        accountForm.addEventListener('submit', handleFormSubmit);
    }
    
    // Delete button
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', handleDelete);
    }
}

// ==========================================
// PAGE LIFECYCLE EVENT LISTENERS
// ==========================================

window.addEventListener('DOMContentLoaded', initializeAccountsPage);

window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        isInitialized = false;
        initializeAccountsPage();
    }
});

// ==========================================
// MODAL FUNCTIONS
// ==========================================

function showModal(account = null) {
    const accountModal = document.getElementById('accountModal');
    const accountForm = document.getElementById('accountForm');
    const modalTitle = document.getElementById('modalTitle');
    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    
    if (!accountModal || !accountForm) return;
    
    accountForm.reset();
    
    if (account) {
        // Edit mode
        modalTitle.textContent = 'Edit Account';
        document.getElementById('accountId').value = account.id;
        document.getElementById('accountName').value = account.name;
        // Just set the numeric value, not formatted
        document.getElementById('accountBalance').value = parseFloat(account.balance);
        document.getElementById('accountType').value = account.type;
        if (deleteAccountBtn) deleteAccountBtn.style.display = 'flex';
    } else {
        // Add mode
        modalTitle.textContent = 'Add Account';
        document.getElementById('accountId').value = '';
        if (deleteAccountBtn) deleteAccountBtn.style.display = 'none';
    }
    
    accountModal.classList.add('active');
    
    // Initialize Lucide icons in modal
    setTimeout(() => {
        lucide.createIcons();
    }, 10);
}

function hideModal() {
    const accountModal = document.getElementById('accountModal');
    if (accountModal) {
        accountModal.classList.remove('active');
    }
}

// ==========================================
// EVENT HANDLERS
// ==========================================

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        alert('You must be logged in to add an account.');
        return;
    }

    const accountId = document.getElementById('accountId').value;
    const accountData = {
        name: document.getElementById('accountName').value,
        balance: parseFloat(document.getElementById('accountBalance').value),
        type: document.getElementById('accountType').value,
    };

    try {
        let error;
        if (accountId) {
            // Update existing account
            ({ error } = await supabase
                .from('accounts')
                .update(accountData)
                .eq('id', accountId));
        } else {
            // Insert new account
            accountData.user_id = user.id;
            ({ error } = await supabase
                .from('accounts')
                .insert(accountData));
        }

        if (error) throw error;

        hideModal();
        await fetchAndRenderAccounts();
        
    } catch (err) {
        console.error('Error saving account:', err);
        alert('Failed to save account. Check the console for details.');
    }
}

async function handleDelete() {
    const accountId = document.getElementById('accountId').value;
    
    if (!accountId || !confirm('Are you sure you want to delete this account? This action cannot be undone.')) {
        return;
    }

    try {
        const { error } = await supabase
            .from('accounts')
            .delete()
            .eq('id', accountId);
            
        if (error) throw error;

        hideModal();
        await fetchAndRenderAccounts();
        
    } catch (err) {
        console.error('Error deleting account:', err);
        alert('Failed to delete account.');
    }
}

// ==========================================
// DATA LOADING AND RENDERING
// ==========================================

async function fetchAndRenderAccounts() {
    try {
        const { data: accounts, error } = await supabase
            .from('accounts')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) throw error;

        const accountsList = document.getElementById('accountsList');
        const emptyState = document.getElementById('emptyState');
        const totalAssetsEl = document.getElementById('totalAssets');
        const totalDebtsEl = document.getElementById('totalDebts');
        const netWorthEl = document.getElementById('netWorth');

        if (!accountsList) return;

        let totalAssets = 0;
        let totalDebts = 0;

        // Clear existing accounts
        accountsList.innerHTML = '';

        if (!accounts || accounts.length === 0) {
            if (emptyState) emptyState.classList.add('visible');
            if (totalAssetsEl) totalAssetsEl.textContent = '$0.00';
            if (totalDebtsEl) totalDebtsEl.textContent = '$0.00';
            if (netWorthEl) netWorthEl.textContent = '$0.00';
            return;
        }

        // Hide empty state
        if (emptyState) emptyState.classList.remove('visible');

        // Render accounts
        accounts.forEach(account => {
            const accountItem = createAccountItem(account);
            accountsList.appendChild(accountItem);

            // Calculate totals
            const balance = parseFloat(account.balance) || 0;
            if (account.type === 'asset') {
                totalAssets += balance;
            } else {
                totalDebts += balance;
            }
        });

        // Update summary
        if (totalAssetsEl) totalAssetsEl.textContent = formatCurrency(totalAssets);
        if (totalDebtsEl) totalDebtsEl.textContent = formatCurrency(totalDebts);
        if (netWorthEl) {
            const netWorth = totalAssets - totalDebts;
            netWorthEl.textContent = formatCurrency(netWorth);
        }

        // Initialize Lucide icons
        lucide.createIcons();

    } catch (err) {
        console.error('Error fetching accounts:', err);
    }
}

function createAccountItem(account) {
    const accountItem = document.createElement('div');
    accountItem.className = `account-item ${account.type}`;
    
    const balance = parseFloat(account.balance) || 0;
    const balanceClass = balance >= 0 ? 'positive' : 'negative';
    
    // Choose icon based on type
    const icon = account.type === 'asset' ? 'wallet' : 'credit-card';
    
    accountItem.innerHTML = `
        <div class="account-info">
            <div class="account-icon ${account.type}">
                <i data-lucide="${icon}"></i>
            </div>
            <div class="account-details">
                <h4>${account.name}</h4>
                <p>${account.type}</p>
            </div>
        </div>
        <div class="account-balance ${balanceClass}">
            ${formatCurrency(balance)}
        </div>
    `;
    
    // Click to edit
    accountItem.addEventListener('click', () => showModal(account));
    
    return accountItem;
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function formatCurrency(amount) {
    const value = parseFloat(amount) || 0;
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(value);
}