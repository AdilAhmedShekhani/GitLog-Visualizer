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
        document.getElementById('browseBtn').addEventListener('click', () => {
            document.getElementById('dirPicker').click();
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

        document.getElementById('dirPicker').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const path = e.target.files[0].webkitRelativePath.split('/')[0];
                document.getElementById('repoPath').value = path;
            }
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

    async generateDashboard() {
        const repoPath = document.getElementById('repoPath').value.trim() || '.';
        this.currentRepo = repoPath;

        this.showLoading();
        this.updateStatus(`Analyzing repository: ${repoPath}...`, 'loading');

        try {
            const command = `node gitviz.js --repo "${repoPath}" --meta --total-commits --top --contributor-stats --file-stats --directory-stats --branches --branch-stats --commit-frequency --json`
            const data = await this.runCommand(command);
            this.currentData = data;

            // Debugging
            console.log(`Repo Path: ${repoPath} \nCommand: ${command} \nData: ${JSON.stringify(data, null, 2)}`);

            this.renderDashboard();
            this.updateStatus(`Dashboard generated successfully for: ${repoPath}`, 'success');
            this.hideLoading();

            // Show refresh charts button
            document.getElementById('refreshChartsBtn').style.display = 'inline-flex';
        } catch (error) {
            this.updateStatus(`Error: ${error.message}`, 'error');
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

            const data = await res.json();
            return data;
        } catch (err) {
            console.error("Error:", err);
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
