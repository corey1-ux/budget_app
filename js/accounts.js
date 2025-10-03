// At the very top of js/dashboard.js
document.addEventListener('DOMContentLoaded', async () => {
    const user = await requireAuth();
    if (!user) return; // Stop executing if not authenticated

    // The rest of your dashboard code...
    MonthNavigation.init();
    loadDashboardData();
});

document.addEventListener('DOMContentLoaded', () => {
    // Modal elements
    const accountModal = document.getElementById('accountModal');
    const showAddAccountModalBtn = document.getElementById('showAddAccountModalBtn');
    const closeAccountModalBtn = document.getElementById('closeAccountModalBtn');
    const accountForm = document.getElementById('accountForm');
    const modalTitle = document.getElementById('modalTitle');
    const deleteAccountBtn = document.getElementById('deleteAccountBtn');

    // DOM elements for display
    const accountsList = document.getElementById('accountsList');
    const totalAssetsEl = document.getElementById('totalAssets');
    const totalDebtsEl = document.getElementById('totalDebts');
    const netWorthEl = document.getElementById('netWorth');

    // --- Modal Logic ---
    const showModal = (account = null) => {
        accountForm.reset();
        if (account) {
            modalTitle.textContent = 'Edit Account';
            document.getElementById('accountId').value = account.id;
            document.getElementById('accountName').value = account.name;
            document.getElementById('accountBalance').value = account.balance;
            document.getElementById('accountType').value = account.type;
            deleteAccountBtn.style.display = 'block';
        } else {
            modalTitle.textContent = 'Add Account';
            document.getElementById('accountId').value = '';
            deleteAccountBtn.style.display = 'none';
        }
        accountModal.classList.add('active');
    };

    const hideModal = () => {
        accountModal.classList.remove('active');
    };

    showAddAccountModalBtn.addEventListener('click', () => showModal());
    closeAccountModalBtn.addEventListener('click', hideModal);
    accountModal.addEventListener('click', (e) => {
        if (e.target === accountModal) hideModal();
    });

    // --- Data Logic ---
    const fetchAndRenderAccounts = async () => {
        try {
            const { data: accounts, error } = await supabase
                .from('accounts')
                .select('*')
                .order('created_at', { ascending: true });

            if (error) throw error;

            accountsList.innerHTML = '';
            let totalAssets = 0;
            let totalDebts = 0;

            if (accounts.length === 0) {
                accountsList.innerHTML = '<p class="empty-state">No accounts yet. Add your first one!</p>';
            }

            accounts.forEach(account => {
                const card = document.createElement('div');
                card.className = `account-card ${account.type}`;
                card.innerHTML = `
                    <div class="account-info">
                        <h4>${account.name}</h4>
                        <p>${account.type}</p>
                    </div>
                    <div class="account-balance">$${parseFloat(account.balance).toFixed(2)}</div>
                `;
                card.addEventListener('click', () => showModal(account));
                accountsList.appendChild(card);

                if (account.type === 'asset') {
                    totalAssets += parseFloat(account.balance);
                } else {
                    totalDebts += parseFloat(account.balance);
                }
            });

            totalAssetsEl.textContent = `$${totalAssets.toFixed(2)}`;
            totalDebtsEl.textContent = `$${totalDebts.toFixed(2)}`;
            netWorthEl.textContent = `$${(totalAssets - totalDebts).toFixed(2)}`;

        } catch (err) {
            console.error('Error fetching accounts:', err);
            accountsList.innerHTML = '<p class="empty-state error">Could not fetch accounts.</p>';
        }
    };

    // --- Form Submission ---
    accountForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // --- THIS IS THE FIX ---
        // Get the current user's data first
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
            user_id: user.id // Include the user's ID in the data
        };

        try {
            let error;
            if (accountId) {
                // Update existing account
                // We don't need to send the user_id on an update, RLS handles it.
                delete accountData.user_id; 
                ({ error } = await supabase.from('accounts').update(accountData).eq('id', accountId));
            } else {
                // Insert new account
                ({ error } = await supabase.from('accounts').insert(accountData));
            }

            if (error) throw error;

            hideModal();
            fetchAndRenderAccounts();
        } catch (err) {
            console.error('Error saving account:', err);
            alert('Failed to save account. Check the console for details.');
        }
    });
    
    // --- Delete Logic ---
    deleteAccountBtn.addEventListener('click', async () => {
        const accountId = document.getElementById('accountId').value;
        if (!accountId || !confirm('Are you sure you want to delete this account?')) {
            return;
        }

        try {
            const { error } = await supabase.from('accounts').delete().eq('id', accountId);
            if (error) throw error;

            hideModal();
            fetchAndRenderAccounts();
        } catch (err) {
            console.error('Error deleting account:', err);
            alert('Failed to delete account.');
        }
    });

    // Initial load
    fetchAndRenderAccounts();
});