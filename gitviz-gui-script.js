/**
 * GitViz Dashboard JavaScript
 * Static implementation - generates data once and displays it
 */

class GitVizDashboard {
    constructor() {
        this.currentData = null;
        this.currentRepo = '.';
        this.resizeTimeout = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateStatus('Ready to analyze repository...');
    }

    bindEvents() {
        // Repository input controls
        document.getElementById('demoDataBtn').addEventListener('click', () => {
            this.loadDemoData();
        });

        document.getElementById('currentDirBtn').addEventListener('click', () => {
            document.getElementById('repoPath').value = '.';
        });

        document.getElementById('generateBtn').addEventListener('click', () => {
            this.generateDashboard();
        });

        document.getElementById('refreshChartsBtn').addEventListener('click', () => {
            this.refreshCharts();
        });

        // Enter key support
        document.getElementById('repoPath').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.generateDashboard();
            }
        });
    }

    // Manual method to refresh charts (useful for debugging)
    refreshCharts() {
        if (this.currentData && this.currentData.commitFrequency) {
            const aggregated = this.aggregateCommitFrequencies(this.currentData.commitFrequency);
            console.log('Refreshing charts with data:', aggregated);
            this.renderSimpleChart('dailyChart', aggregated.daily, '#059669');
            this.renderSimpleChart('weeklyChart', aggregated.weekly, '#2563eb');
            this.renderSimpleChart('monthlyChart', aggregated.monthly, '#dc2626');
        }
    }

    // Load demo data instead of making server calls
    async loadDemoData() {
        this.showLoading();
        this.updateStatus('Loading demo data...', 'loading');

        try {
            // Use direct mock data - no file loading complexity
            const demoData = this.getMockData();
            this.currentData = demoData;
            this.currentRepo = 'Demo Repository';

            this.renderDashboard();
            this.updateStatus('Demo dashboard loaded successfully!', 'success');
            this.hideLoading();

            // Show refresh charts button
            document.getElementById('refreshChartsBtn').style.display = 'inline-flex';
        } catch (error) {
            this.updateStatus(`Error loading demo data: ${error.message}`, 'error');
            this.hideLoading();
        }
    }

    // Direct mock data - no external dependencies
    getMockData() {
        return {
            meta: {
                repo: "Demo Repository",
                since: "2025-07-23",
                until: "2025-08-22",
                rangeDays: 30,
                firstCommitDate: "2025-02-22",
                repoAgeDays: 180,
                generated: new Date().toISOString()
            },
            contributors: [
                { name: "Alice Johnson", email: "alice@example.com", commits: 45 },
                { name: "Bob Smith", email: "bob@example.com", commits: 32 },
                { name: "Carol Davis", email: "carol@example.com", commits: 28 },
                { name: "David Wilson", email: "david@example.com", commits: 19 },
                { name: "Eve Brown", email: "eve@example.com", commits: 12 }
            ],
            contributorStats: [
                { additions: 2847, deletions: 1203 },
                { additions: 1956, deletions: 892 },
                { additions: 1643, deletions: 734 },
                { additions: 1124, deletions: 567 },
                { additions: 743, deletions: 298 }
            ],
            commitFrequency: {
                "2025-07-23": 3, "2025-07-24": 5, "2025-07-25": 2,
                "2025-07-28": 4, "2025-07-29": 7, "2025-07-30": 6, "2025-07-31": 3, "2025-08-01": 8,
                "2025-08-02": 4, "2025-08-05": 9, "2025-08-06": 12,
                "2025-08-07": 5, "2025-08-08": 7, "2025-08-09": 3,
                "2025-08-12": 6, "2025-08-13": 8, "2025-08-14": 4, "2025-08-15": 11, "2025-08-16": 2,
            },
            branches: [
                { branch: "main", tip: "a1b2c3d" },
                { branch: "feature/auth", tip: "e4f5g6h" },
                { branch: "bugfix/login", tip: "i7j8k9l" },
                { branch: "develop", tip: "m0n1o2p" }
            ],
            branchStats: [
                { commits: 89, authors: 5, merges: 12 },
                { commits: 23, authors: 2, merges: 0 },
                { commits: 8, authors: 1, merges: 1 },
                { commits: 56, authors: 4, merges: 8 }
            ],
            fileStats: [
                { path: "src/main.js", changes: 34, additions: 892, deletions: 267 },
                { path: "src/components/Dashboard.vue", changes: 28, additions: 654, deletions: 123 },
                { path: "src/utils/api.js", changes: 22, additions: 445, deletions: 189 },
                { path: "README.md", changes: 19, additions: 234, deletions: 45 },
                { path: "package.json", changes: 15, additions: 89, deletions: 23 },
                { path: "src/styles/main.css", changes: 12, additions: 156, deletions: 67 },
                { path: "tests/unit/main.test.js", changes: 11, additions: 289, deletions: 34 },
                { path: "src/components/UserProfile.vue", changes: 9, additions: 178, deletions: 45 },
                { path: "src/router/index.js", changes: 8, additions: 123, deletions: 29 },
                { path: "config/webpack.config.js", changes: 7, additions: 98, deletions: 12 }
            ],
            directoryStats: [
                { directory: "src", changes: 127, additions: 2435, deletions: 678 },
                { directory: "tests", changes: 34, additions: 567, deletions: 123 },
                { directory: "docs", changes: 23, additions: 345, deletions: 89 },
                { directory: "config", changes: 18, additions: 234, deletions: 56 },
                { directory: ".", changes: 45, additions: 456, deletions: 134 },
                { directory: "public", changes: 12, additions: 145, deletions: 23 },
                { directory: "scripts", changes: 8, additions: 89, deletions: 15 }
            ]
        };
    }

    updateStatus(message, type = 'info') {
        const statusBar = document.getElementById('statusBar');
        statusBar.textContent = message;
        statusBar.className = `status-bar status-${type}`;
    }

    showLoading() {
        document.getElementById('loadingSpinner').style.display = 'block';
        document.getElementById('dashboardContent').style.display = 'none';
    }

    hideLoading() {
        document.getElementById('loadingSpinner').style.display = 'none';
        document.getElementById('dashboardContent').style.display = 'block';
    }

    hideDashboard() {
        document.getElementById('loadingSpinner').style.display = 'none';
        document.getElementById('dashboardContent').style.display = 'none';

        // Hide refresh charts button
        document.getElementById('refreshChartsBtn').style.display = 'none';

        // Clear current data
        this.currentData = null;
    }

    async generateDashboard() {
        const repoPath = document.getElementById('repoPath').value.trim() || '.';
        this.currentRepo = repoPath;

        this.showLoading();
        this.updateStatus(`Analyzing repository: ${repoPath}...`, 'loading');

        try {
            const command = `node gitviz.js --repo "${repoPath}" --meta --total-commits --top --contributor-stats --file-stats --directory-stats --branches --branch-stats --commit-frequency --json`
            const data = await this.runCommand(command);

            // Check if data is valid
            if (!data || data.error) {
                throw new Error(data?.error || 'No data received from GitViz CLI');
            }

            this.currentData = data;

            // Debugging
            console.log(`Repo Path: ${repoPath} \nCommand: ${command} \nData: ${JSON.stringify(data, null, 2)}`);

            this.renderDashboard();
            this.updateStatus(`Dashboard generated successfully for: ${repoPath}`, 'success');
            this.hideLoading();

            // Show refresh charts button
            document.getElementById('refreshChartsBtn').style.display = 'inline-flex';
        } catch (error) {
            console.error('Dashboard generation failed:', error);

            // Hide dashboard and show error
            this.hideDashboard();

            // Provide detailed error message with troubleshooting
            let errorMessage = 'Failed to load repository data. ';
            if (error.message.includes('fetch')) {
                errorMessage += 'Server not running? Start: node gitviz-gui-server.js \ Also Check Console (Press F12)';
            } else if (error.message.includes('No data')) {
                errorMessage += 'Check console for CLI errors.';
            } else {
                errorMessage += `Error: ${error.message}`;
            }

            this.updateStatus(errorMessage, 'error');
            this.hideLoading();
        }
    }

    // Sends Command to Server
    async runCommand(cmd) {
        try {
            const res = await fetch("http://localhost:3000/run", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ command: cmd }),
            });

            if (!res.ok) {
                throw new Error(`Server responded with status: ${res.status}`);
            }

            const data = await res.json();

            // Log server response for debugging
            console.log('Server response:', data);

            return data;
        } catch (err) {
            console.error("Server communication error:", err);
            throw new Error(`Server communication failed: ${err.message}. Make sure gitviz-gui-server.js is running.`);
        }
    }

    renderDashboard() {
        if (!this.currentData) return;

        // Render sections in sequence to ensure proper layout
        this.renderMeta();

        // Render other sections first
        this.renderContributors();
        this.renderBranches();
        this.renderFileStats();
        this.renderDirectoryStats();

        // Render commit frequency last to ensure layout is complete
        this.renderCommitFrequency();

        // Add window resize listener to redraw charts
        this.addResizeListener();
    }

    addResizeListener() {
        // Remove existing listener if any
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }

        // Debounced resize handler
        const handleResize = () => {
            if (this.resizeTimeout) {
                clearTimeout(this.resizeTimeout);
            }
            this.resizeTimeout = setTimeout(() => {
                if (this.currentData && this.currentData.commitFrequency) {
                    const aggregated = this.aggregateCommitFrequencies(this.currentData.commitFrequency);
                    this.renderSimpleChart('dailyChart', aggregated.daily, '#059669');
                    this.renderSimpleChart('weeklyChart', aggregated.weekly, '#2563eb');
                    this.renderSimpleChart('monthlyChart', aggregated.monthly, '#dc2626');
                }
            }, 250);
        };

        window.addEventListener('resize', handleResize);
    }

    renderMeta() {
        const meta = this.currentData.meta;
        const metaInfo = document.getElementById('metaInfo');

        metaInfo.innerHTML = `
            <div class="meta-item">
                <span class="meta-label">Repository:</span>
                <span class="meta-value">${meta.repo}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">Time Range:</span>
                <span class="meta-value">${meta.since} to ${meta.until}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">Range Days:</span>
                <span class="meta-value">${meta.rangeDays} days</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">First Commit:</span>
                <span class="meta-value">${meta.firstCommitDate}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">Repository Age:</span>
                <span class="meta-value">${meta.repoAgeDays} days</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">Generated:</span>
                <span class="meta-value">${new Date(meta.generated).toLocaleString()}</span>
            </div>
        `;
    }

    renderCommitFrequency() {
        const frequency = this.currentData.commitFrequency;

        // Generate aggregated data
        const aggregated = this.aggregateCommitFrequencies(frequency);

        // Render sparklines
        this.renderSparkline('dailySparkline', aggregated.daily, 'Daily commits');
        this.renderSparkline('weeklySparkline', aggregated.weekly, 'Weekly commits');
        this.renderSparkline('monthlySparkline', aggregated.monthly, 'Monthly commits');

        // Render simple charts with proper timing
        // Use setTimeout to ensure layout is complete
        setTimeout(() => {
            this.renderSimpleChart('dailyChart', aggregated.daily, '#059669');
            this.renderSimpleChart('weeklyChart', aggregated.weekly, '#2563eb');
            this.renderSimpleChart('monthlyChart', aggregated.monthly, '#dc2626');
        }, 100);
    }

    aggregateCommitFrequencies(dailyFreq) {
        const weekly = {};
        const monthly = {};

        Object.entries(dailyFreq).forEach(([dateStr, commitCount]) => {
            // Monthly aggregation
            const monthKey = dateStr.slice(0, 7);
            monthly[monthKey] = (monthly[monthKey] || 0) + commitCount;

            // Weekly aggregation (simplified)
            const weekKey = this.getWeekKey(dateStr);
            weekly[weekKey] = (weekly[weekKey] || 0) + commitCount;
        });

        return {
            daily: dailyFreq,
            weekly: this.sortObject(weekly),
            monthly: this.sortObject(monthly)
        };
    }

    getWeekKey(dateStr) {
        const date = new Date(dateStr + "T00:00:00Z");
        const year = date.getUTCFullYear();
        const start = new Date(Date.UTC(year, 0, 1));
        const dayNum = Math.floor((date - start) / 86400000) + 1;
        const week = Math.ceil(dayNum / 7);
        return `${year}-W${String(week).padStart(2, "0")}`;
    }

    sortObject(obj) {
        const sorted = {};
        Object.keys(obj).sort().forEach(key => {
            sorted[key] = obj[key];
        });
        return sorted;
    }

    renderSparkline(elementId, data, title) {
        const element = document.getElementById(elementId);
        const values = Object.values(data);
        const maxValue = Math.max(...values);

        if (maxValue === 0) {
            element.innerHTML = '(no data)';
            return;
        }

        const blocks = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
        const sparkline = values
            .map(v => blocks[Math.round((v / maxValue) * (blocks.length - 1))])
            .join('');

        element.innerHTML = `${sparkline} <span style="font-size: 12px; opacity: 0.7;">max: ${maxValue}</span>`;
    }

    renderSimpleChart(canvasId, data, color) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.warn(`Canvas element not found: ${canvasId}`);
            return;
        }

        const ctx = canvas.getContext('2d');

        // Get parent container dimensions
        const rect = canvas.parentElement.getBoundingClientRect();

        // Check if container has valid dimensions
        if (rect.width <= 0 || rect.height <= 0) {
            console.warn(`Invalid container dimensions for ${canvasId}, retrying...`);
            // Retry after a short delay
            setTimeout(() => this.renderSimpleChart(canvasId, data, color), 200);
            return;
        }

        // Set canvas size with device pixel ratio for crisp rendering
        const dpr = window.devicePixelRatio || 1;
        const displayWidth = rect.width;
        const displayHeight = 200;

        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
        canvas.style.width = displayWidth + 'px';
        canvas.style.height = displayHeight + 'px';

        ctx.scale(dpr, dpr);

        // Clear canvas
        ctx.clearRect(0, 0, displayWidth, displayHeight);

        const entries = Object.entries(data);
        if (entries.length === 0) {
            // Draw "No data" message
            ctx.fillStyle = '#64748b';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No data available', displayWidth / 2, displayHeight / 2);
            return;
        }

        const values = entries.map(([, value]) => value);
        const maxValue = Math.max(...values);

        if (maxValue === 0) {
            // Draw "No commits" message
            ctx.fillStyle = '#64748b';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No commits in this period', displayWidth / 2, displayHeight / 2);
            return;
        }

        const padding = 40;
        const chartHeight = displayHeight - padding;
        const barWidth = Math.max(2, (displayWidth - padding) / entries.length * 0.8);
        const spacing = (displayWidth - padding) / entries.length * 0.2;

        // Draw bars
        ctx.fillStyle = color;
        entries.forEach(([key, value], index) => {
            const barHeight = (value / maxValue) * (chartHeight - 40);
            const x = padding / 2 + index * (barWidth + spacing) + spacing / 2;
            const y = chartHeight - barHeight - 20;

            // Draw bar
            ctx.fillRect(x, y, barWidth, barHeight);

            // Draw value on top (only if there's space)
            if (barHeight > 15) {
                ctx.fillStyle = '#374151';
                ctx.font = '10px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(value.toString(), x + barWidth / 2, y - 5);
            }

            // Draw label at bottom
            ctx.fillStyle = '#64748b';
            ctx.font = '8px monospace';
            ctx.textAlign = 'center';
            const label = key.length > 8 ? key.slice(-6) : key;
            ctx.fillText(label, x + barWidth / 2, displayHeight - 5);

            // Reset fill style for next bar
            ctx.fillStyle = color;
        });
    }

    renderContributors() {
        const contributors = this.currentData.contributors;
        const contributorStats = this.currentData.contributorStats;
        const contributorsList = document.getElementById('contributorsList');

        // Merge contributor data
        const mergedContributors = contributors.map((contributor, index) => ({
            ...contributor,
            ...contributorStats[index]
        }));

        // Calculate percentages
        const totalCommits = mergedContributors.reduce((sum, c) => sum + c.commits, 0);

        contributorsList.innerHTML = mergedContributors.map(contributor => {
            const percentage = ((contributor.commits / totalCommits) * 100).toFixed(1);
            return `
                <div class="contributor-item">
                    <div class="item-name">${contributor.name} &lt;${contributor.email}&gt;</div>
                    <div class="item-stats">
                        <span class="stat stat-commits">${contributor.commits}</span>
                        <span class="stat stat-percentage">${percentage}%</span>
                        <span class="stat stat-additions">+${contributor.additions}</span>
                        <span class="stat stat-deletions">-${contributor.deletions}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderBranches() {
        const branches = this.currentData.branches;
        const branchStats = this.currentData.branchStats;
        const branchesList = document.getElementById('branchesList');

        // Merge branch data
        const mergedBranches = branches.map((branch, index) => ({
            ...branch,
            ...branchStats[index]
        }));

        branchesList.innerHTML = mergedBranches.map(branch => `
            <div class="branch-item">
                <div class="item-name">
                    ${branch.branch}
                    <span class="branch-tip">${branch.tip}</span>
                </div>
                <div class="item-stats">
                    <span class="stat stat-commits">${branch.commits}</span>
                    <span class="stat stat-changes">${branch.authors} authors</span>
                    <span class="stat stat-percentage">${branch.merges} merges</span>
                </div>
            </div>
        `).join('');
    }

    renderFileStats() {
        const files = this.currentData.fileStats.slice(0, 5); // Top 5 files
        const filesList = document.getElementById('filesList');

        filesList.innerHTML = files.map(file => `
            <div class="file-item">
                <div class="item-name">${file.path}</div>
                <div class="item-stats">
                    <span class="stat stat-changes">${file.changes}</span>
                    <span class="stat stat-additions">+${file.additions}</span>
                    <span class="stat stat-deletions">-${file.deletions}</span>
                </div>
            </div>
        `).join('');
    }

    renderDirectoryStats() {
        const directories = this.currentData.directoryStats.slice(0, 5); // Top 5 directories
        const directoriesList = document.getElementById('directoriesList');

        directoriesList.innerHTML = directories.map(dir => `
            <div class="directory-item">
                <div class="item-name">${dir.directory === '.' ? '(root)' : dir.directory}</div>
                <div class="item-stats">
                    <span class="stat stat-changes">${dir.changes}</span>
                    <span class="stat stat-additions">+${dir.additions}</span>
                    <span class="stat stat-deletions">-${dir.deletions}</span>
                </div>
            </div>
        `).join('');
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new GitVizDashboard();
});

// Note: To integrate with your actual CLI, replace the generateMockData method with:
/*
async generateMockData(repoPath) {
    // This would be replaced with actual CLI execution
    // For now, you can pre-generate data files and load them
    try {
        const response = await fetch(`data/${encodeURIComponent(repoPath)}.json`);
        return await response.json();
    } catch (error) {
        throw new Error(`Could not load data for repository: ${repoPath}`);
    }
}
*/
