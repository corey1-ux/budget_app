const MonthNavigation = {
    currentMonth: null,
    
    // Initialize month navigation
    init() {
        const savedMonth = this.getSavedMonth();
        const today = new Date();
        
        // Use saved month if exists, otherwise current month
        this.currentMonth = savedMonth || this.formatMonthKey(today);
        this.saveCurrentMonth();
        
        return this.currentMonth;
    },
    
    // Get the saved current month from storage
    getSavedMonth() {
        const data = localStorage.getItem('currentMonth');
        return data;
    },
    
    // Save current month to storage
    saveCurrentMonth() {
        localStorage.setItem('currentMonth', this.currentMonth);
    },
    
    // Format date as YYYY-MM
    formatMonthKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    },
    
    // Get current real month (today)
    getRealCurrentMonth() {
        return this.formatMonthKey(new Date());
    },
    
    // Check if viewing current month
    isViewingCurrentMonth() {
        return this.currentMonth === this.getRealCurrentMonth();
    },
    
    // Navigate to previous month
    previousMonth() {
        const [year, month] = this.currentMonth.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        date.setMonth(date.getMonth() - 1);
        this.currentMonth = this.formatMonthKey(date);
        this.saveCurrentMonth();
        return this.currentMonth;
    },
    
    // Navigate to next month
    nextMonth() {
        const [year, month] = this.currentMonth.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        date.setMonth(date.getMonth() + 1);
        this.currentMonth = this.formatMonthKey(date);
        this.saveCurrentMonth();
        return this.currentMonth;
    },
    
    // Go back to current real month
    goToCurrent() {
        this.currentMonth = this.getRealCurrentMonth();
        this.saveCurrentMonth();
        return this.currentMonth;
    },
    
    // Get display name for month
    getDisplayName(monthKey) {
        const [year, month] = monthKey.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        const monthName = date.toLocaleString('default', { month: 'long' });
        return `${monthName} ${year}`;
    }
};