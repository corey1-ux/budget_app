// At the very top of js/dashboard.js
document.addEventListener('DOMContentLoaded', async () => {
    const user = await requireAuth();
    if (!user) return; // Stop executing if not authenticated

    // The rest of your dashboard code...
    MonthNavigation.init();
    loadDashboardData();
});

MonthNavigation.init();
const testData = BudgetData.getMonthData(MonthNavigation.currentMonth);
console.log('Data for current month:', testData);
console.log('======================');

// Dashboard element references
const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');
const goToCurrentMonthBtn = document.getElementById('goToCurrentMonth');
const monthDisplayEl = document.getElementById('currentMonthDisplay');
const dashboardIncomeEl = document.getElementById('dashboardIncome');
const dashboardExpensesEl = document.getElementById('dashboardExpenses');
const dashboardRemainingEl = document.getElementById('dashboardRemaining');
const chartPercentageEl = document.getElementById('chartPercentage');

// Update month display
function updateMonthDisplay() {
    monthDisplayEl.textContent = MonthNavigation.getDisplayName(MonthNavigation.currentMonth);
    
    if (MonthNavigation.isViewingCurrentMonth()) {
        goToCurrentMonthBtn.classList.add('hidden');
    } else {
        goToCurrentMonthBtn.classList.remove('hidden');
    }
}

// Load dashboard data
function loadDashboardData() {
    const data = BudgetData.getMonthData(MonthNavigation.currentMonth);
    
    const income = data.income || 0;
    let totalExpenses = 0;
    
    if (data.expenses && data.expenses.length > 0) {
        data.expenses.forEach(expense => {
            totalExpenses += expense.amount || 0;
        });
    }
    
    const remaining = income - totalExpenses;
    const percentageSpent = income > 0 ? Math.round((totalExpenses / income) * 100) : 0;
    
    // Update cards
    dashboardIncomeEl.textContent = `$${income.toFixed(2)}`;
    dashboardExpensesEl.textContent = `$${totalExpenses.toFixed(2)}`;
    dashboardRemainingEl.textContent = `$${remaining.toFixed(2)}`;
    
    // Update remaining color
    if (remaining < 0) {
        dashboardRemainingEl.classList.add('negative');
    } else {
        dashboardRemainingEl.classList.remove('negative');
    }
    
    // Update chart percentage
    chartPercentageEl.textContent = `${percentageSpent}%`;
    
    // Update chart
    updateChart(income, totalExpenses);
}

let chartInstance = null; // Keep track of chart instance

function updateChart(income, expenses) {
    const ctx = document.getElementById('budgetChart').getContext('2d');
    
    const remaining = Math.max(0, income - expenses);
    
    // Destroy existing chart if it exists
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    // Create new chart
    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Expenses', 'Remaining'],
            datasets: [{
                data: [expenses, remaining],
                backgroundColor: ['#e74c3c', '#3498db'],
                borderWidth: 0,
                cutout: '60%'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false // We have our own legend
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            return label + ': $' + value.toFixed(2);
                        }
                    }
                }
            }
        }
    });
}

// Month navigation
prevMonthBtn.addEventListener('click', () => {
    MonthNavigation.previousMonth();
    updateMonthDisplay();
    loadDashboardData();
});

nextMonthBtn.addEventListener('click', () => {
    MonthNavigation.nextMonth();
    updateMonthDisplay();
    loadDashboardData();
});

goToCurrentMonthBtn.addEventListener('click', () => {
    MonthNavigation.goToCurrent();
    updateMonthDisplay();
    loadDashboardData();
});

// Initialize on page load
MonthNavigation.init();
updateMonthDisplay();
loadDashboardData();