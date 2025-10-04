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

// Initialize immediately when script loads
MonthNavigation.init();