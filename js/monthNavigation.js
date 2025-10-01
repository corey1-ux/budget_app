const MonthNavigation = {
    currentMonth: null,
    
    init() {
        const savedMonth = this.getSavedMonth();
        const today = new Date();
        this.currentMonth = savedMonth || this.formatMonthKey(today);
        this.saveCurrentMonth();
        return this.currentMonth;
    },
    
    getSavedMonth() {
        return localStorage.getItem('currentMonth');
    },
    
    saveCurrentMonth() {
        localStorage.setItem('currentMonth', this.currentMonth);
    },
    
    formatMonthKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    },
    
    getRealCurrentMonth() {
        return this.formatMonthKey(new Date());
    },
    
    isViewingCurrentMonth() {
        return this.currentMonth === this.getRealCurrentMonth();
    },
    
    previousMonth() {
        const [year, month] = this.currentMonth.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        date.setMonth(date.getMonth() - 1);
        this.currentMonth = this.formatMonthKey(date);
        this.saveCurrentMonth();
        return this.currentMonth;
    },
    
    nextMonth() {
        const [year, month] = this.currentMonth.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        date.setMonth(date.getMonth() + 1);
        this.currentMonth = this.formatMonthKey(date);
        this.saveCurrentMonth();
        return this.currentMonth;
    },
    
    goToCurrent() {
        this.currentMonth = this.getRealCurrentMonth();
        this.saveCurrentMonth();
        return this.currentMonth;
    },
    
    getDisplayName(monthKey) {
        const [year, month] = monthKey.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        const monthName = date.toLocaleString('default', { month: 'long' });
        return `${monthName} ${year}`;
    }
};

// Load and initialize month navigation UI component
async function loadMonthNavComponent() {
    try {
        const response = await fetch('components/monthNav.html');
        const html = await response.text();
        
        // Insert at top of container
        const container = document.querySelector('.container');
        if (container) {
            container.insertAdjacentHTML('afterbegin', html);
            initMonthNavUI();
        }
        
    } catch (error) {
        console.error('Error loading month nav component:', error);
    }
}

// Initialize month navigation UI
function initMonthNavUI() {
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
        // Trigger custom event that pages can listen to
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
}

// Auto-load component if this script is included
loadMonthNavComponent();