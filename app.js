// Academic Work Tracker - Main Application
// This app connects to Google Sheets to store and retrieve work tracking data

class AcademicWorkTracker {
    constructor() {
        this.currentDate = new Date();
        this.viewMode = 'day';
        this.categories = JSON.parse(localStorage.getItem('categories')) || CONFIG.DEFAULT_CATEGORIES;
        this.spreadsheetId = localStorage.getItem('spreadsheetId');
        this.workData = {};
        this.allocationTargets = JSON.parse(localStorage.getItem('allocationTargets')) || {
            research: 40,
            teaching: 40,
            service: 20
        };
        this.reminderSettings = JSON.parse(localStorage.getItem('reminderSettings')) || {
            enabled: true,
            daysThreshold: 2,
            excludeWeekends: true
        };
        this.weekStartDay = parseInt(localStorage.getItem('weekStartDay')) || 0; // 0 = Sunday, 1 = Monday, etc.
        this.isSignedIn = false;
        this.accessToken = null;
        this.charts = {};
        this.autoSaveTimeout = null;
        this.autoSaveDelay = 2000; // 2 seconds after last change

        this.init();
    }

    async init() {
        // Load Google API
        await this.loadGoogleAPI();
        this.setupEventListeners();
        this.checkReminders();
    }

    loadGoogleAPI() {
        return new Promise((resolve, reject) => {
            // Load the Google API client
            gapi.load('client', async () => {
                try {
                    await gapi.client.init({
                        apiKey: CONFIG.API_KEY,
                        discoveryDocs: CONFIG.DISCOVERY_DOCS
                    });

                    // Initialize Google Identity Services
                    google.accounts.id.initialize({
                        client_id: CONFIG.CLIENT_ID,
                        callback: (response) => this.handleCredentialResponse(response)
                    });

                    // Check if we have a stored token
                    const storedToken = localStorage.getItem('accessToken');
                    if (storedToken) {
                        this.accessToken = storedToken;
                        gapi.client.setToken({ access_token: storedToken });
                        // Try to load user data
                        try {
                            await this.loadUserProfile();
                            this.updateSignInStatus(true);
                        } catch (error) {
                            // Token expired, clear it
                            localStorage.removeItem('accessToken');
                            this.accessToken = null;
                            this.updateSignInStatus(false);
                        }
                    } else {
                        this.updateSignInStatus(false);
                    }

                    resolve();
                } catch (error) {
                    console.error('Error initializing Google API:', error);
                    document.getElementById('login-status').textContent =
                        'Error: ' + (error.message || 'Failed to initialize Google API');
                    document.getElementById('login-status').style.color = 'red';
                    document.getElementById('login-status').style.marginTop = '1rem';
                    reject(error);
                }
            });
        });
    }

    handleCredentialResponse() {
        // This is called after ID token sign-in (for user info)
        // We still need to request access token for API access
        console.log('Credential response received');
    }

    async requestAccessToken() {
        return new Promise((resolve, reject) => {
            const tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CONFIG.CLIENT_ID,
                scope: CONFIG.SCOPES,
                callback: async (response) => {
                    if (response.error) {
                        console.error('Error getting access token:', response);
                        reject(response);
                        return;
                    }

                    this.accessToken = response.access_token;
                    localStorage.setItem('accessToken', this.accessToken);
                    gapi.client.setToken({ access_token: this.accessToken });

                    await this.loadUserProfile();
                    this.updateSignInStatus(true);
                    resolve();
                }
            });

            tokenClient.requestAccessToken({ prompt: 'consent' });
        });
    }

    async loadUserProfile() {
        // Get user email using the People API (simpler approach)
        // For now, we'll just use a placeholder
        this.userEmail = localStorage.getItem('userEmail') || 'User';
    }

    updateSignInStatus(isSignedIn) {
        this.isSignedIn = isSignedIn;

        if (isSignedIn) {
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('main-screen').classList.remove('hidden');
            document.getElementById('user-info').textContent = this.userEmail;

            // Load or create spreadsheet
            this.initializeSpreadsheet();
        } else {
            document.getElementById('login-screen').classList.remove('hidden');
            document.getElementById('main-screen').classList.add('hidden');
        }
    }

    signOut() {
        this.accessToken = null;
        this.isSignedIn = false;
        localStorage.removeItem('accessToken');
        localStorage.removeItem('userEmail');
        gapi.client.setToken(null);
        this.updateSignInStatus(false);
    }

    async initializeSpreadsheet() {
        if (this.spreadsheetId) {
            // Verify the spreadsheet exists and load data
            try {
                await this.loadDataFromSheet();
                this.renderTracker();
            } catch (error) {
                console.error('Error loading spreadsheet:', error);
                alert('Could not load your spreadsheet. It may have been deleted. Creating a new one...');
                this.spreadsheetId = null;
                localStorage.removeItem('spreadsheetId');
                await this.createNewSpreadsheet();
            }
        } else {
            // Create a new spreadsheet
            await this.createNewSpreadsheet();
        }
    }

    async createNewSpreadsheet() {
        try {
            const response = await gapi.client.sheets.spreadsheets.create({
                properties: {
                    title: CONFIG.SPREADSHEET_NAME + ' - ' + new Date().getFullYear()
                },
                sheets: [
                    {
                        properties: {
                            title: 'Daily Tracker',
                            gridProperties: {
                                frozenRowCount: 1,
                                frozenColumnCount: 1
                            }
                        }
                    },
                    {
                        properties: {
                            title: 'Statistics'
                        }
                    },
                    {
                        properties: {
                            title: 'Allocation'
                        }
                    }
                ]
            });

            this.spreadsheetId = response.result.spreadsheetId;
            localStorage.setItem('spreadsheetId', this.spreadsheetId);
            document.getElementById('sheet-id-display').textContent = this.spreadsheetId;

            // Initialize the sheet with headers
            await this.initializeSheetStructure();

            alert('New spreadsheet created! You can access it at:\nhttps://docs.google.com/spreadsheets/d/' + this.spreadsheetId);

            this.renderTracker();
        } catch (error) {
            console.error('Error creating spreadsheet:', error);
            alert('Error creating spreadsheet. Please try again.');
        }
    }

    async initializeSheetStructure() {
        // Create headers for the Daily Tracker sheet
        const headers = ['Date'];

        // Add all tasks as columns
        Object.keys(this.categories).forEach(categoryKey => {
            const category = this.categories[categoryKey];
            category.tasks.forEach(task => {
                headers.push(`${category.name}: ${task}`);
            });
        });

        const values = [headers];

        try {
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: 'Daily Tracker!A1',
                valueInputOption: 'RAW',
                resource: { values }
            });

            // Initialize allocation sheet
            const allocationValues = [
                ['Category', 'Target %', 'Actual %'],
                ['Research', this.allocationTargets.research, 0],
                ['Teaching', this.allocationTargets.teaching, 0],
                ['Service', this.allocationTargets.service, 0]
            ];

            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: 'Allocation!A1',
                valueInputOption: 'RAW',
                resource: { values: allocationValues }
            });

        } catch (error) {
            console.error('Error initializing sheet structure:', error);
        }
    }

    async loadDataFromSheet() {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: 'Daily Tracker!A:ZZ'
            });

            const rows = response.result.values;
            if (!rows || rows.length === 0) {
                console.log('No data found in sheet');
                return;
            }

            // Parse the data
            const headers = rows[0];
            this.workData = {};

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const date = row[0];
                if (!date) continue;

                this.workData[date] = {};

                for (let j = 1; j < headers.length && j < row.length; j++) {
                    const header = headers[j];
                    const value = parseFloat(row[j]) || 0;
                    this.workData[date][header] = value;
                }
            }

            // Load allocation data
            const allocationResponse = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: 'Allocation!A2:B4'
            });

            const allocationRows = allocationResponse.result.values;
            if (allocationRows && allocationRows.length > 0) {
                this.allocationTargets = {
                    research: parseFloat(allocationRows[0][1]) || 40,
                    teaching: parseFloat(allocationRows[1][1]) || 40,
                    service: parseFloat(allocationRows[2][1]) || 20
                };
                localStorage.setItem('allocationTargets', JSON.stringify(this.allocationTargets));
            }

        } catch (error) {
            console.error('Error loading data from sheet:', error);
            throw error;
        }
    }

    async saveDataToSheet(silent = false) {
        if (!this.spreadsheetId) {
            if (!silent) {
                alert('No spreadsheet connected. Please create a new spreadsheet first.');
            }
            return;
        }

        try {
            // Prepare data for saving
            const headers = ['Date'];
            Object.keys(this.categories).forEach(categoryKey => {
                const category = this.categories[categoryKey];
                category.tasks.forEach(task => {
                    headers.push(`${category.name}: ${task}`);
                });
            });

            const rows = [headers];

            // Sort dates and create rows
            const dates = Object.keys(this.workData).sort();
            dates.forEach(date => {
                const row = [date];
                headers.slice(1).forEach(header => {
                    row.push(this.workData[date][header] || 0);
                });
                rows.push(row);
            });

            // Clear existing data and write new data
            await gapi.client.sheets.spreadsheets.values.clear({
                spreadsheetId: this.spreadsheetId,
                range: 'Daily Tracker!A:ZZ'
            });

            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: 'Daily Tracker!A1',
                valueInputOption: 'RAW',
                resource: { values: rows }
            });

            if (silent) {
                this.showSaveStatus('Saved ✓');
            } else {
                alert('Data saved successfully to Google Sheets!');
            }
        } catch (error) {
            console.error('Error saving data to sheet:', error);
            if (!silent) {
                alert('Error saving data. Please try again.');
            }
            throw error; // Re-throw for auto-save error handling
        }
    }

    setupEventListeners() {
        // Auth buttons
        document.getElementById('authorize-button').addEventListener('click', async () => {
            try {
                await this.requestAccessToken();
            } catch (error) {
                console.error('Sign in error:', error);
                alert('Failed to sign in. Please try again.');
            }
        });

        document.getElementById('signout-button').addEventListener('click', () => {
            this.signOut();
        });

        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Date navigation
        document.getElementById('current-date').addEventListener('change', (e) => {
            this.currentDate = new Date(e.target.value);
            this.renderTracker();
        });

        document.getElementById('prev-day').addEventListener('click', () => {
            this.currentDate.setDate(this.currentDate.getDate() - 1);
            this.renderTracker();
        });

        document.getElementById('next-day').addEventListener('click', () => {
            this.currentDate.setDate(this.currentDate.getDate() + 1);
            this.renderTracker();
        });

        document.getElementById('prev-week').addEventListener('click', () => {
            this.currentDate.setDate(this.currentDate.getDate() - 7);
            this.renderTracker();
        });

        document.getElementById('next-week').addEventListener('click', () => {
            this.currentDate.setDate(this.currentDate.getDate() + 7);
            this.renderTracker();
        });

        document.getElementById('today-btn').addEventListener('click', () => {
            this.currentDate = new Date();
            this.renderTracker();
        });

        document.getElementById('view-mode').addEventListener('change', (e) => {
            this.viewMode = e.target.value;
            this.renderTracker();
        });

        // Save button
        document.getElementById('save-data').addEventListener('click', () => {
            this.saveDataToSheet();
        });

        // Statistics
        document.getElementById('stats-period').addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                document.getElementById('custom-range').classList.remove('hidden');
            } else {
                document.getElementById('custom-range').classList.add('hidden');
            }
        });

        document.getElementById('refresh-stats').addEventListener('click', () => {
            this.renderStatistics();
        });

        // Allocation
        document.getElementById('save-allocation').addEventListener('click', () => {
            this.saveAllocation();
        });

        ['research-target', 'teaching-target', 'service-target'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => {
                this.updateAllocationTotal();
                this.updateAllocationChart();
            });
        });

        // Settings
        document.getElementById('save-settings').addEventListener('click', () => {
            this.saveSettings();
        });

        document.getElementById('create-new-sheet').addEventListener('click', () => {
            if (confirm('This will create a new Google Sheet. Your current data will remain in the old sheet. Continue?')) {
                this.spreadsheetId = null;
                localStorage.removeItem('spreadsheetId');
                this.createNewSpreadsheet();
            }
        });

        document.getElementById('select-sheet').addEventListener('click', () => {
            const sheetId = prompt('Enter your Google Sheets ID (from the URL):');
            if (sheetId) {
                this.spreadsheetId = sheetId;
                localStorage.setItem('spreadsheetId', sheetId);
                this.loadDataFromSheet().then(() => {
                    this.renderTracker();
                    alert('Connected to spreadsheet!');
                }).catch(error => {
                    alert('Could not connect to that spreadsheet. Please check the ID and permissions.');
                });
            }
        });

        // Reminder
        document.getElementById('dismiss-reminder').addEventListener('click', () => {
            document.getElementById('reminder-banner').classList.add('hidden');
            localStorage.setItem('lastReminderDismissed', new Date().toISOString());
        });
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            }
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName + '-tab').classList.add('active');

        // Render content based on tab
        if (tabName === 'statistics') {
            this.renderStatistics();
        } else if (tabName === 'allocation') {
            this.renderAllocation();
        } else if (tabName === 'settings') {
            this.renderSettings();
        }
    }

    renderTracker() {
        const dateInput = document.getElementById('current-date');
        dateInput.value = this.formatDate(this.currentDate);

        const grid = document.getElementById('tracker-grid');

        if (this.viewMode === 'day') {
            grid.innerHTML = this.renderDayView();
        } else if (this.viewMode === 'week') {
            grid.innerHTML = this.renderWeekView();
        } else if (this.viewMode === 'month') {
            grid.innerHTML = this.renderMonthView();
        }

        this.updateDailySummary();
    }

    renderDayView() {
        const dateStr = this.formatDate(this.currentDate);
        const dayData = this.workData[dateStr] || {};

        let html = '<table class="tracker-table"><thead><tr><th>Task</th><th>Hours</th></tr></thead><tbody>';

        Object.keys(this.categories).forEach(categoryKey => {
            const category = this.categories[categoryKey];

            html += `<tr><td colspan="2" class="category-header ${categoryKey}">${category.name}</td></tr>`;

            category.tasks.forEach(task => {
                const key = `${category.name}: ${task}`;
                const value = dayData[key] || 0;
                html += `
                    <tr>
                        <td class="task-name">${task}</td>
                        <td><input type="number" min="0" step="0.5" value="${value}"
                            data-date="${dateStr}" data-key="${key}"
                            onchange="app.updateValue(this)"
                            onfocus="this.select()"></td>
                    </tr>
                `;
            });

            const categoryTotal = this.getCategoryTotal(dateStr, category.name);
            html += `<tr class="total-row"><td>${category.name} Total</td><td>${categoryTotal.toFixed(1)} hrs</td></tr>`;
        });

        const dayTotal = this.getDayTotal(dateStr);
        html += `<tr class="total-row"><td><strong>Daily Total</strong></td><td><strong>${dayTotal.toFixed(1)} hrs</strong></td></tr>`;

        html += '</tbody></table>';
        return html;
    }

    renderWeekView() {
        const weekStart = new Date(this.currentDate);
        // Calculate days to subtract to get to the week start day
        const currentDay = weekStart.getDay();
        const daysToSubtract = (currentDay - this.weekStartDay + 7) % 7;
        weekStart.setDate(weekStart.getDate() - daysToSubtract);

        let html = '<table class="tracker-table"><thead><tr><th>Task</th>';

        const dates = [];
        const today = this.formatDate(new Date());

        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart);
            date.setDate(date.getDate() + i);
            dates.push(date);

            const dateStr = this.formatDate(date);
            const dayOfWeek = date.getDay();
            const isToday = dateStr === today;
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            let headerClass = '';
            if (isToday) {
                headerClass = 'today-column';
            } else if (isWeekend) {
                headerClass = 'weekend-column';
            }

            html += `<th class="${headerClass}">${this.formatDateShort(date)}</th>`;
        }
        html += '</tr></thead><tbody>';

        Object.keys(this.categories).forEach(categoryKey => {
            const category = this.categories[categoryKey];

            html += `<tr><td colspan="${dates.length + 1}" class="category-header ${categoryKey}">${category.name}</td></tr>`;

            category.tasks.forEach(task => {
                html += `<tr><td class="task-name">${task}</td>`;

                dates.forEach(date => {
                    const dateStr = this.formatDate(date);
                    const key = `${category.name}: ${task}`;
                    const dayData = this.workData[dateStr] || {};
                    const value = dayData[key] || 0;

                    const dayOfWeek = date.getDay();
                    const isToday = dateStr === today;
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                    let cellClass = '';
                    if (isToday) {
                        cellClass = 'today-column';
                    } else if (isWeekend) {
                        cellClass = 'weekend-column';
                    }

                    html += `<td class="${cellClass}"><input type="number" min="0" step="0.5" value="${value}"
                        data-date="${dateStr}" data-key="${key}"
                        onchange="app.updateValue(this)"
                        onfocus="this.select()"></td>`;
                });

                html += '</tr>';
            });
        });

        html += '</tbody></table>';
        return html;
    }

    renderMonthView() {
        // Similar to week view but for the whole month
        const monthStart = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
        const monthEnd = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);

        let html = '<div class="month-grid"><p>Month view: Use day or week view for data entry. This shows a summary.</p>';

        const dates = [];
        for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
            dates.push(new Date(d));
        }

        html += '<table class="tracker-table"><thead><tr><th>Category</th><th>Total Hours</th><th>Avg/Day</th></tr></thead><tbody>';

        Object.keys(this.categories).forEach(categoryKey => {
            const category = this.categories[categoryKey];
            let categoryTotal = 0;

            dates.forEach(date => {
                const dateStr = this.formatDate(date);
                categoryTotal += this.getCategoryTotal(dateStr, category.name);
            });

            const avgPerDay = categoryTotal / dates.length;

            html += `
                <tr>
                    <td class="category-header ${categoryKey}">${category.name}</td>
                    <td>${categoryTotal.toFixed(1)} hrs</td>
                    <td>${avgPerDay.toFixed(1)} hrs</td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        return html;
    }

    updateValue(input) {
        const date = input.dataset.date;
        const key = input.dataset.key;
        const value = parseFloat(input.value) || 0;

        if (!this.workData[date]) {
            this.workData[date] = {};
        }

        this.workData[date][key] = value;
        this.updateDailySummary();

        // Save to localStorage for persistence
        localStorage.setItem('workData', JSON.stringify(this.workData));

        // Trigger auto-save
        this.scheduleAutoSave();
    }

    scheduleAutoSave() {
        // Clear any existing timeout
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }

        // Show saving indicator
        this.showSaveStatus('Saving...');

        // Schedule auto-save after delay
        this.autoSaveTimeout = setTimeout(async () => {
            try {
                await this.saveDataToSheet(true); // Pass true for silent save
            } catch (error) {
                console.error('Auto-save error:', error);
                this.showSaveStatus('Auto-save failed', true);
            }
        }, this.autoSaveDelay);
    }

    showSaveStatus(message, isError = false) {
        const saveBtn = document.getElementById('save-data');

        // Store original text on first use
        if (!saveBtn.dataset.originalText) {
            saveBtn.dataset.originalText = saveBtn.textContent;
        }

        saveBtn.textContent = message;
        saveBtn.style.background = isError ? 'var(--danger-color)' : 'var(--success-color)';

        if (!isError) {
            setTimeout(() => {
                saveBtn.textContent = saveBtn.dataset.originalText;
                saveBtn.style.background = '';
            }, 1500);
        } else {
            setTimeout(() => {
                saveBtn.textContent = saveBtn.dataset.originalText;
                saveBtn.style.background = '';
            }, 3000);
        }
    }

    updateDailySummary() {
        const dateStr = this.formatDate(this.currentDate);
        const summary = document.getElementById('daily-summary');

        let html = '';
        Object.keys(this.categories).forEach(categoryKey => {
            const category = this.categories[categoryKey];
            const total = this.getCategoryTotal(dateStr, category.name);

            html += `
                <div class="summary-item ${categoryKey}">
                    <h4>${category.name}</h4>
                    <div class="value">${total.toFixed(1)} hrs</div>
                </div>
            `;
        });

        const dayTotal = this.getDayTotal(dateStr);
        html += `
            <div class="summary-item">
                <h4>Total</h4>
                <div class="value">${dayTotal.toFixed(1)} hrs</div>
            </div>
        `;

        summary.innerHTML = html;
    }

    getCategoryTotal(dateStr, categoryName) {
        const dayData = this.workData[dateStr] || {};
        let total = 0;

        Object.keys(dayData).forEach(key => {
            if (key.startsWith(categoryName + ':')) {
                total += dayData[key];
            }
        });

        return total;
    }

    getDayTotal(dateStr) {
        const dayData = this.workData[dateStr] || {};
        return Object.values(dayData).reduce((sum, val) => sum + val, 0);
    }

    renderStatistics() {
        const period = document.getElementById('stats-period').value;
        let startDate, endDate;

        const today = new Date();

        switch(period) {
            case 'week':
                startDate = new Date(today);
                startDate.setDate(today.getDate() - 7);
                endDate = today;
                break;
            case 'month':
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                endDate = today;
                break;
            case 'quarter':
                const quarter = Math.floor(today.getMonth() / 3);
                startDate = new Date(today.getFullYear(), quarter * 3, 1);
                endDate = today;
                break;
            case 'year':
                startDate = new Date(today.getFullYear(), 0, 1);
                endDate = today;
                break;
            case 'custom':
                startDate = new Date(document.getElementById('stats-start-date').value);
                endDate = new Date(document.getElementById('stats-end-date').value);
                break;
        }

        // Calculate statistics
        const stats = this.calculateStatistics(startDate, endDate);

        // Render charts
        this.renderTotalHoursChart(stats);
        this.renderCategoryChart(stats);
        this.renderTrendChart(stats);
        this.renderStatsSummary(stats);
    }

    calculateStatistics(startDate, endDate) {
        const stats = {
            totalHours: 0,
            categories: {},
            daily: {}
        };

        Object.keys(this.categories).forEach(categoryKey => {
            stats.categories[categoryKey] = 0;
        });

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = this.formatDate(d);
            const dayTotal = this.getDayTotal(dateStr);
            stats.daily[dateStr] = dayTotal;
            stats.totalHours += dayTotal;

            Object.keys(this.categories).forEach(categoryKey => {
                const category = this.categories[categoryKey];
                const categoryTotal = this.getCategoryTotal(dateStr, category.name);
                stats.categories[categoryKey] += categoryTotal;
            });
        }

        return stats;
    }

    renderTotalHoursChart(stats) {
        const ctx = document.getElementById('total-hours-chart');

        if (this.charts.totalHours) {
            this.charts.totalHours.destroy();
        }

        const data = Object.keys(this.categories).map(key => stats.categories[key]);
        const labels = Object.keys(this.categories).map(key => this.categories[key].name);
        const colors = Object.keys(this.categories).map(key => this.categories[key].color);

        this.charts.totalHours = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Total Hours',
                    data: data,
                    backgroundColor: colors
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    renderCategoryChart(stats) {
        const ctx = document.getElementById('category-chart');

        if (this.charts.category) {
            this.charts.category.destroy();
        }

        const data = Object.keys(this.categories).map(key => stats.categories[key]);
        const labels = Object.keys(this.categories).map(key => this.categories[key].name);
        const colors = Object.keys(this.categories).map(key => this.categories[key].color);

        this.charts.category = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true
            }
        });
    }

    renderTrendChart(stats) {
        const ctx = document.getElementById('trend-chart');

        if (this.charts.trend) {
            this.charts.trend.destroy();
        }

        const dates = Object.keys(stats.daily).sort();
        const data = dates.map(date => stats.daily[date]);

        this.charts.trend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Daily Hours',
                    data: data,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    x: {
                        display: false
                    }
                }
            }
        });
    }

    renderStatsSummary(stats) {
        const summary = document.getElementById('stats-summary');
        const days = Object.keys(stats.daily).length;
        const avgPerDay = stats.totalHours / days;

        let html = `
            <div class="summary-item">
                <h4>Total Hours</h4>
                <div class="value">${stats.totalHours.toFixed(1)}</div>
            </div>
            <div class="summary-item">
                <h4>Average per Day</h4>
                <div class="value">${avgPerDay.toFixed(1)}</div>
            </div>
            <div class="summary-item">
                <h4>Days Tracked</h4>
                <div class="value">${days}</div>
            </div>
        `;

        Object.keys(this.categories).forEach(categoryKey => {
            const category = this.categories[categoryKey];
            const percentage = (stats.categories[categoryKey] / stats.totalHours * 100) || 0;
            html += `
                <div class="summary-item ${categoryKey}">
                    <h4>${category.name}</h4>
                    <div class="value">${percentage.toFixed(1)}%</div>
                </div>
            `;
        });

        summary.innerHTML = html;
    }

    renderAllocation() {
        // Set current targets
        document.getElementById('research-target').value = this.allocationTargets.research;
        document.getElementById('teaching-target').value = this.allocationTargets.teaching;
        document.getElementById('service-target').value = this.allocationTargets.service;

        // Calculate actual allocation from last 30 days (excluding "other" category)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        const stats = this.calculateStatistics(startDate, endDate);

        // Calculate total hours excluding "other" category
        const workHours = stats.categories.research + stats.categories.teaching + stats.categories.service;
        const totalHours = workHours || 1; // Avoid division by zero

        const actual = {
            research: (stats.categories.research / totalHours * 100).toFixed(1),
            teaching: (stats.categories.teaching / totalHours * 100).toFixed(1),
            service: (stats.categories.service / totalHours * 100).toFixed(1)
        };

        document.getElementById('research-actual').innerHTML = `<strong>Actual (30 days):</strong> ${actual.research}%`;
        document.getElementById('teaching-actual').innerHTML = `<strong>Actual (30 days):</strong> ${actual.teaching}%`;
        document.getElementById('service-actual').innerHTML = `<strong>Actual (30 days):</strong> ${actual.service}%`;

        this.updateAllocationTotal();
        this.updateAllocationChart();
    }

    updateAllocationTotal() {
        const research = parseInt(document.getElementById('research-target').value) || 0;
        const teaching = parseInt(document.getElementById('teaching-target').value) || 0;
        const service = parseInt(document.getElementById('service-target').value) || 0;
        const total = research + teaching + service;

        document.getElementById('allocation-total').textContent = total;

        const warningElement = document.getElementById('allocation-warning');
        if (total !== 100) {
            warningElement.classList.remove('hidden');
        } else {
            warningElement.classList.add('hidden');
        }
    }

    updateAllocationChart() {
        const ctx = document.getElementById('allocation-comparison-chart');

        if (this.charts.allocation) {
            this.charts.allocation.destroy();
        }

        const targets = [
            parseInt(document.getElementById('research-target').value) || 0,
            parseInt(document.getElementById('teaching-target').value) || 0,
            parseInt(document.getElementById('service-target').value) || 0
        ];

        // Get actuals from the display (already calculated)
        const actuals = [
            parseFloat(document.getElementById('research-actual').textContent.match(/[\d.]+/)?.[0]) || 0,
            parseFloat(document.getElementById('teaching-actual').textContent.match(/[\d.]+/)?.[0]) || 0,
            parseFloat(document.getElementById('service-actual').textContent.match(/[\d.]+/)?.[0]) || 0
        ];

        const labels = ['Research', 'Teaching', 'Service'];
        const colors = ['#3b82f6', '#10b981', '#f59e0b'];

        this.charts.allocation = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Target %',
                        data: targets,
                        backgroundColor: colors.map(c => c + '80')
                    },
                    {
                        label: 'Actual %',
                        data: actuals,
                        backgroundColor: colors
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    async saveAllocation() {
        const research = parseInt(document.getElementById('research-target').value) || 0;
        const teaching = parseInt(document.getElementById('teaching-target').value) || 0;
        const service = parseInt(document.getElementById('service-target').value) || 0;
        const total = research + teaching + service;

        if (total !== 100) {
            alert('Error: Allocation percentages must total 100%. Current total is ' + total + '%');
            return;
        }

        this.allocationTargets = {
            research,
            teaching,
            service
        };

        localStorage.setItem('allocationTargets', JSON.stringify(this.allocationTargets));

        // Save to Google Sheets
        if (this.spreadsheetId) {
            try {
                const values = [
                    ['Category', 'Target %'],
                    ['Research', this.allocationTargets.research],
                    ['Teaching', this.allocationTargets.teaching],
                    ['Service', this.allocationTargets.service]
                ];

                await gapi.client.sheets.spreadsheets.values.update({
                    spreadsheetId: this.spreadsheetId,
                    range: 'Allocation!A1',
                    valueInputOption: 'RAW',
                    resource: { values }
                });

                alert('Allocation targets saved!');
            } catch (error) {
                console.error('Error saving allocation:', error);
                alert('Error saving to Google Sheets, but saved locally.');
            }
        } else {
            alert('Allocation targets saved locally!');
        }
    }

    renderSettings() {
        // Render categories config
        const configDiv = document.getElementById('categories-config');
        let html = '';

        Object.keys(this.categories).forEach(categoryKey => {
            const category = this.categories[categoryKey];

            html += `
                <div class="category-config">
                    <h4>${category.name}</h4>
                    <div class="task-list" data-category="${categoryKey}">
            `;

            category.tasks.forEach((task, index) => {
                html += `
                    <div class="task-item">
                        <input type="text" value="${task}" data-category="${categoryKey}" data-index="${index}">
                        <button class="remove-task-btn" onclick="app.removeTask('${categoryKey}', ${index})">Remove</button>
                    </div>
                `;
            });

            html += `
                    </div>
                    <button class="add-task-config-btn" onclick="app.addTaskToCategory('${categoryKey}')">+ Add Task</button>
                </div>
            `;
        });

        configDiv.innerHTML = html;

        // Set display settings
        document.getElementById('week-start-day').value = this.weekStartDay;

        // Set reminder settings
        document.getElementById('enable-reminders').checked = this.reminderSettings.enabled;
        document.getElementById('reminder-days').value = this.reminderSettings.daysThreshold;
        document.getElementById('exclude-weekends').checked = this.reminderSettings.excludeWeekends;

        // Set sheet ID
        document.getElementById('sheet-id-display').textContent = this.spreadsheetId || 'Not connected';
    }

    addTaskToCategory(categoryKey) {
        const taskName = prompt('Enter task name:');
        if (taskName) {
            this.categories[categoryKey].tasks.push(taskName);
            localStorage.setItem('categories', JSON.stringify(this.categories));
            this.renderSettings();
        }
    }

    removeTask(categoryKey, index) {
        if (confirm('Remove this task? Data for this task will not be deleted from your sheets.')) {
            this.categories[categoryKey].tasks.splice(index, 1);
            localStorage.setItem('categories', JSON.stringify(this.categories));
            this.renderSettings();
        }
    }

    saveSettings() {
        // Save task names
        document.querySelectorAll('.task-item input').forEach(input => {
            const categoryKey = input.dataset.category;
            const index = parseInt(input.dataset.index);
            this.categories[categoryKey].tasks[index] = input.value;
        });

        localStorage.setItem('categories', JSON.stringify(this.categories));

        // Save display settings
        this.weekStartDay = parseInt(document.getElementById('week-start-day').value);
        localStorage.setItem('weekStartDay', this.weekStartDay);

        // Save reminder settings
        this.reminderSettings = {
            enabled: document.getElementById('enable-reminders').checked,
            daysThreshold: parseInt(document.getElementById('reminder-days').value),
            excludeWeekends: document.getElementById('exclude-weekends').checked
        };

        localStorage.setItem('reminderSettings', JSON.stringify(this.reminderSettings));

        alert('Settings saved!');
        this.renderTracker();
    }

    checkReminders() {
        if (!this.reminderSettings.enabled) return;

        const today = new Date();
        const lastRecorded = this.getLastRecordedDate();

        if (!lastRecorded) return;

        let daysSinceLastRecord;

        if (this.reminderSettings.excludeWeekends) {
            // Count only weekdays
            daysSinceLastRecord = this.countWeekdaysBetween(lastRecorded, today);
        } else {
            // Count all days
            daysSinceLastRecord = Math.floor((today - lastRecorded) / (1000 * 60 * 60 * 24));
        }

        if (daysSinceLastRecord >= this.reminderSettings.daysThreshold) {
            const lastDismissed = localStorage.getItem('lastReminderDismissed');
            const dismissedDate = lastDismissed ? new Date(lastDismissed) : null;

            if (!dismissedDate || (today - dismissedDate) > (1000 * 60 * 60 * 24)) {
                const banner = document.getElementById('reminder-banner');
                const message = document.getElementById('reminder-message');
                const dayType = this.reminderSettings.excludeWeekends ? 'workdays' : 'days';
                message.textContent = `You haven't recorded your work for ${daysSinceLastRecord} ${dayType}. Don't forget to track your time!`;
                banner.classList.remove('hidden');
            }
        }
    }

    countWeekdaysBetween(startDate, endDate) {
        let count = 0;
        const current = new Date(startDate);
        current.setDate(current.getDate() + 1); // Start from day after last recorded

        while (current <= endDate) {
            const dayOfWeek = current.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
                count++;
            }
            current.setDate(current.getDate() + 1);
        }

        return count;
    }

    getLastRecordedDate() {
        const dates = Object.keys(this.workData)
            .filter(date => this.getDayTotal(date) > 0)
            .sort()
            .reverse();

        return dates.length > 0 ? new Date(dates[0]) : null;
    }

    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    formatDateShort(date) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${days[date.getDay()]} ${months[date.getMonth()]} ${date.getDate()}`;
    }
}

// Initialize app when DOM is ready
let app;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        app = new AcademicWorkTracker();
    });
} else {
    app = new AcademicWorkTracker();
}
