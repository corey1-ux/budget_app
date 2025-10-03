// js/dashboard.js

// This is the main function that runs all the dashboard logic.
async function initializeDashboard() {
    const user = await requireAuth();
    if (!user) return;

    // --- INITIALIZATION ---
    setGreeting(user);
    
    // Add animation class to all cards for a smooth fade-in
    document.querySelectorAll('.card').forEach((card, index) => {
        card.style.animationDelay = `${index * 0.05}s`;
        card.classList.add('card-fade-in');
    });
    
    lucide.createIcons();
    loadNetWorth();
    loadBudgetData();
    loadRecentTransactions();
    loadRecurringPayments();
}

// --- EVENT LISTENERS ---

// This runs when the page first loads.
window.addEventListener('DOMContentLoaded', initializeDashboard);

// This runs every time the page is shown, including when using the back button.
window.addEventListener('pageshow', function(event) {
    // `event.persisted` is true if the page was restored from the bfcache.
    if (event.persisted) {
        // Re-run the initialization to restart animations and fetch fresh data.
        initializeDashboard();
    }
});


// --- FUNCTION DEFINITIONS (No changes below this line) ---

function setGreeting(user) {
    const hour = new Date().getHours();
    let greeting = (hour < 12) ? 'Good Morning' : (hour < 18) ? 'Good Afternoon' : 'Good Evening';
    document.getElementById('greeting').textContent = `${greeting}, ${user.user_metadata.full_name || user.email.split('@')[0]}`;
}

async function loadNetWorth() {
    try {
        const { data, error } = await supabase.from('accounts').select('type, balance');
        if (error) throw error;
        let totalAssets = 0, totalDebts = 0;
        data.forEach(acc => {
            if (acc.type === 'asset') totalAssets += acc.balance;
            else totalDebts += acc.balance;
        });
        countUp(document.getElementById('netWorthValue'), totalAssets - totalDebts);
    } catch (err) { console.error("Error loading net worth:", err); }
}

async function loadBudgetData() {
    const data = await BudgetData.getMonthData(MonthNavigation.currentMonth);
    const income = data.income || 0;
    const totalExpenses = data.expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const remaining = income - totalExpenses;
    
    countUp(document.getElementById('budgetSpent'), totalExpenses);
    countUp(document.getElementById('budgetRemaining'), remaining);
    document.getElementById('budgetRemaining').className = remaining >= 0 ? 'main-value positive' : 'main-value negative';

    const percentage = income > 0 ? (totalExpenses / income) * 100 : 0;
    document.getElementById('budgetProgress').style.width = `${Math.min(percentage, 100)}%`;
    document.getElementById('progress-label').textContent = `${formatCurrency(totalExpenses)} of ${formatCurrency(income)}`;
    document.getElementById('progress-percentage').textContent = `${Math.round(percentage)}%`;

    renderSpendingChart(data.expenses);
    displayTopExpenses(data.expenses);
}

async function loadRecentTransactions() {
    try {
        const { data, error } = await supabase.from('transactions').select('*').limit(5)
            .eq('month_key', MonthNavigation.currentMonth).order('day', { ascending: false });
        if (error) throw error;
        const listEl = document.getElementById('recentTransactionsList');
        if (!data || data.length === 0) {
            listEl.innerHTML = '<li class="list-item-empty"><p>No transactions this month.</p></li>';
            return;
        }
        listEl.innerHTML = data.map(t => {
            const type = t.tag === 'income' ? 'income' : 'expense';
            return `
                <li class="transaction-item">
                    <div class="transaction-icon ${type}"><i data-lucide="${type === 'income' ? 'plus' : 'minus'}"></i></div>
                    <div class="transaction-details">
                        <div class="name">${t.merchant}</div>
                        <div class="category">${t.tag}</div>
                    </div>
                    <div class="transaction-amount ${type}">${formatCurrency(t.amount)}</div>
                </li>`;
    }).join('');
        lucide.createIcons();
    } catch (err) { console.error("Error loading recent transactions:", err); }
}

async function loadRecurringPayments() {
    try {
        const { data, error } = await supabase.from('transactions').select('*').eq('recurring', true).order('day', { ascending: true });
        if (error) throw error;
        const listEl = document.getElementById('recurringPaymentsList');
        if (!data || data.length === 0) {
            listEl.innerHTML = '<li class="list-item-empty"><p>No recurring payments found.</p></li>';
            return;
        }
        listEl.innerHTML = data.map(t => `
            <li class="recurring-item">
                <div class="transaction-details">
                    <div class="name">${t.merchant}</div>
                    <div class="date">Next on day ${t.day}</div>
                </div>
                <div class="recurring-amount">${formatCurrency(t.amount)}</div>
            </li>`).join('');
    } catch(err) { console.error("Error loading recurring payments:", err); }
}

let spendingChartInstance = null;
function renderSpendingChart(expenses) {
    const ctx = document.getElementById('spendingChart').getContext('2d');
    if (spendingChartInstance) spendingChartInstance.destroy();

    const spendingByCategory = expenses.reduce((acc, expense) => {
        const category = expense.name || 'Uncategorized';
        acc[category] = (acc[category] || 0) + expense.amount;
        return acc;
    }, {});

    spendingChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(spendingByCategory),
            datasets: [{
                data: Object.values(spendingByCategory),
                backgroundColor: ['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5'],
                borderColor: '#fff',
                borderWidth: 4,
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: { label: (context) => `${context.label}: ${formatCurrency(context.raw)}` }
                }
            }
        }
    });
}

function displayTopExpenses(expenses) {
    const listEl = document.getElementById('topExpensesList');
    const topFive = [...expenses].sort((a, b) => b.amount - a.amount).slice(0, 5);

    if (topFive.length === 0) {
        listEl.innerHTML = '<li class="list-item-empty"><p>No expenses to show.</p></li>';
        return;
    }

    listEl.innerHTML = topFive.map(t => `
        <li class="transaction-item">
            <div class="transaction-details">
                <div class="name">${t.name}</div>
            </div>
            <div class="transaction-amount expense">${formatCurrency(t.amount)}</div>
        </li>`
    ).join('');
}

function countUp(el, endValue) {
    if (!el) return;
    let startValue = 0;
    const duration = 1500;
    const frameRate = 60;
    const totalFrames = Math.round(duration / (1000 / frameRate));
    const increment = (endValue - startValue) / totalFrames;
    let currentFrame = 0;
    
    // Clear any existing counter on the element
    if (el.counter) clearInterval(el.counter);

    el.counter = setInterval(() => {
        startValue += increment;
        currentFrame++;
        el.textContent = formatCurrency(startValue);
        if (currentFrame === totalFrames) {
            clearInterval(el.counter);
            el.textContent = formatCurrency(endValue);
        }
    }, 1000 / frameRate);
}

function formatCurrency(amount) {
    const value = amount || 0;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}