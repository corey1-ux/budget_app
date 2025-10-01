const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('navMenu');
const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');
const goToCurrentMonthBtn = document.getElementById('goToCurrentMonth');
const monthDisplayEl = document.getElementById('currentMonthDisplay');
const dashboardIncomeEl = document.getElementById('dashboardIncome');
const dashboardExpensesEl = document.getElementById('dashboardExpenses');
const dashboardRemainingEl = document.getElementById('dashboardRemaining');
const chartPercentageEl = document.getElementById('chartPercentage');

let budgetChart = null;

// Hamburger menu
hamburger.addEventListener('click', function() {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
});

const navLinks = document.querySelectorAll('.nav-link');
navLinks.forEach(link => {
    link.addEventListener('click', function() {
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

// Create/Update chart
function updateChart(income, expenses) {
    const canvas = document.getElementById('budgetChart');
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    canvas.width = 300;
    canvas.height = 300;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 120;
    
    // Calculate angles
    const remaining = Math.max(0, income - expenses);
    const total = income || 1;
    const expenseAngle = (expenses / total) * 2 * Math.PI;
    
    // Draw remaining (blue)
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, expenseAngle - Math.PI / 2, 2 * Math.PI - Math.PI / 2);
    ctx.closePath();
    ctx.fillStyle = '#3498db';
    ctx.fill();
    
    // Draw expenses (red)
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, -Math.PI / 2, expenseAngle - Math.PI / 2);
    ctx.closePath();
    ctx.fillStyle = '#e74c3c';
    ctx.fill();
    
    // Draw inner circle (donut effect)
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.6, 0, 2 * Math.PI);
    ctx.fillStyle = 'white';
    ctx.fill();
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

// Initialize
MonthNavigation.init();
updateMonthDisplay();
loadDashboardData();