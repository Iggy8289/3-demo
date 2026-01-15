// ============================================================================
// BESS SIZING CALCULATOR - Interactive Tool
// ============================================================================
// This calculates Battery Energy Storage System requirements for peak shaving
// Based on electric school bus fleet load profile data
// ============================================================================

// Sample fleet load profile data (15-minute intervals over 24 hours)
// In production, this would come from actual fleet analysis
const fleetLoadData = {
    // Time labels for 24 hours in 15-minute intervals
    timeLabels: [
        '00:00', '00:15', '00:30', '00:45', '01:00', '01:15', '01:30', '01:45',
        '02:00', '02:15', '02:30', '02:45', '03:00', '03:15', '03:30', '03:45',
        '04:00', '04:15', '04:30', '04:45', '05:00', '05:15', '05:30', '05:45',
        '06:00', '06:15', '06:30', '06:45', '07:00', '07:15', '07:30', '07:45',
        '08:00', '08:15', '08:30', '08:45', '09:00', '09:15', '09:30', '09:45',
        '10:00', '10:15', '10:30', '10:45', '11:00', '11:15', '11:30', '11:45',
        '12:00', '12:15', '12:30', '12:45', '13:00', '13:15', '13:30', '13:45',
        '14:00', '14:15', '14:30', '14:45', '15:00', '15:15', '15:30', '15:45',
        '16:00', '16:15', '16:30', '16:45', '17:00', '17:15', '17:30', '17:45',
        '18:00', '18:15', '18:30', '18:45', '19:00', '19:15', '19:30', '19:45',
        '20:00', '20:15', '20:30', '20:45', '21:00', '21:15', '21:30', '21:45',
        '22:00', '22:15', '22:30', '22:45', '23:00', '23:15', '23:30', '23:45'
    ],
    
    // Original demand in kW (electric bus fleet charging profile)
    // Peak occurs during evening charging window (~80 kW)
    originalDemand: [
        1.95, 1.95, 1.95, 1.95, 1.95, 1.95, 1.95, 1.95,  // 00:00-02:00 (overnight base)
        1.95, 1.95, 1.95, 1.95, 1.95, 1.95, 1.95, 1.95,  // 02:00-04:00
        24.4, 24.4, 24.4, 24.4, 24.4, 24.4, 24.4, 24.4,  // 04:00-06:00 (early charging)
        28.3, 5.85, 5.85, 5.85, 5.85, 5.85, 5.85, 5.85,  // 06:00-08:00 (morning prep)
        5.85, 5.85, 5.85, 5.85, 64.3, 5.85, 43.3, 43.3,  // 08:00-10:00 (routes start, mid-day charging)
        43.3, 43.3, 43.3, 43.3, 43.3, 43.3, 43.3, 43.3,  // 10:00-12:00 (mid-day charging)
        43.3, 43.3, 43.3, 43.3, 5.85, 5.85, 5.85, 5.85,  // 12:00-14:00 (afternoon routes)
        5.85, 5.85, 5.85, 5.85, 64.3, 5.85, 80.7, 80.7,  // 14:00-16:00 (routes end, peak charging starts)
        80.7, 80.7, 80.7, 80.7, 80.7, 80.7, 76.8, 76.8,  // 16:00-18:00 (peak charging)
        76.8, 76.8, 76.8, 76.8, 76.8, 76.8, 76.8, 76.8,  // 18:00-20:00 (continued charging)
        76.8, 76.8, 76.8, 76.8, 76.8, 76.8, 76.8, 76.8,  // 20:00-22:00 (late charging)
        76.8, 76.8, 76.8, 76.8, 1.95, 1.95, 1.95, 1.95   // 22:00-24:00 (charging complete)
    ]
};

// Store chart instances globally to update them
let loadProfileChart = null;
let bessSizingChart = null;
let economicsChart = null;

// Initialize charts on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeCharts();
    calculateBESS(50); // Default to 50 kW target
});

// ============================================================================
// MAIN CALCULATION FUNCTION
// ============================================================================
function calculateBESS(targetPeak) {
    // Update active button state
    document.querySelectorAll('.target-btn').forEach(btn => {
        btn.classList.remove('active');
        if (parseInt(btn.dataset.target) === targetPeak) {
            btn.classList.add('active');
        }
    });

    // Calculate BESS requirements
    const results = calculateBESSRequirements(targetPeak);
    
    // Update result displays
    document.getElementById('energy-result').textContent = `${results.energy.toFixed(1)} kWh`;
    document.getElementById('power-result').textContent = `${results.power.toFixed(1)} kW`;
    document.getElementById('payback-result').textContent = `${results.payback.toFixed(1)} years`;
    
    // Update charts
    updateLoadProfileChart(targetPeak, results.shavedLoad);
    updateBESSSizingChart();
    updateEconomicsChart();
}

// ============================================================================
// BESS REQUIREMENTS CALCULATION
// ============================================================================
function calculateBESSRequirements(targetPeak) {
    const originalDemand = fleetLoadData.originalDemand;
    let totalExcessEnergy = 0;
    let maxExcessPower = 0;
    const shavedLoad = [];
    
    // For each 15-minute interval
    for (let i = 0; i < originalDemand.length; i++) {
        // Calculate excess power above target
        const excessPower = Math.max(0, originalDemand[i] - targetPeak);
        
        // Calculate excess energy (kWh = kW × hours)
        const excessEnergy = excessPower * 0.25; // 0.25 hours = 15 minutes
        
        // Accumulate total energy that BESS must store
        totalExcessEnergy += excessEnergy;
        
        // Track maximum excess power (determines BESS power rating)
        maxExcessPower = Math.max(maxExcessPower, excessPower);
        
        // Calculate shaved load (what demand looks like with BESS)
        shavedLoad.push(Math.min(originalDemand[i], targetPeak));
    }
    
    // Calculate economic metrics
    const bessEnergy = totalExcessEnergy; // kWh
    const bessPower = maxExcessPower; // kW
    
    // Cost estimates (simplified for demonstration)
    // Typical BESS costs: $400/kWh for energy, $200/kW for power electronics
    const bessCost = (bessEnergy * 400) + (bessPower * 200);
    
    // Annual savings estimate (simplified)
    // Assumes $15/kW/month demand charge × 12 months
    const peakReduction = Math.max(...originalDemand) - targetPeak;
    const annualSavings = peakReduction * 15 * 12;
    
    // Simple payback period
    const payback = annualSavings > 0 ? bessCost / annualSavings : 99;
    
    return {
        energy: bessEnergy,
        power: bessPower,
        cost: bessCost,
        savings: annualSavings,
        payback: payback,
        shavedLoad: shavedLoad
    };
}

// ============================================================================
// CHART INITIALIZATION
// ============================================================================
function initializeCharts() {
    // Common chart options for consistent styling
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                display: true,
                position: 'top'
            }
        }
    };
    
    // Initialize Load Profile Chart
    const loadProfileCtx = document.getElementById('loadProfileChart').getContext('2d');
    loadProfileChart = new Chart(loadProfileCtx, {
        type: 'line',
        data: {
            labels: fleetLoadData.timeLabels,
            datasets: []
        },
        options: {
            ...commonOptions,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Power Demand (kW)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Time of Day'
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        autoSkip: true,
                        maxTicksLimit: 12
                    }
                }
            }
        }
    });
    
    // Initialize BESS Sizing Chart
    const bessSizingCtx = document.getElementById('bessSizingChart').getContext('2d');
    bessSizingChart = new Chart(bessSizingCtx, {
        type: 'line',
        data: {
            labels: [30, 40, 50, 60, 70],
            datasets: []
        },
        options: {
            ...commonOptions,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'BESS Requirements'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Target Peak (kW)'
                    }
                }
            }
        }
    });
    
    // Initialize Economics Chart
    const economicsCtx = document.getElementById('economicsChart').getContext('2d');
    economicsChart = new Chart(economicsCtx, {
        type: 'bar',
        data: {
            labels: ['30 kW', '40 kW', '50 kW', '60 kW', '70 kW'],
            datasets: []
        },
        options: {
            ...commonOptions,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Cost ($1000s)'
                    }
                }
            }
        }
    });
}

// ============================================================================
// CHART UPDATE FUNCTIONS
// ============================================================================
function updateLoadProfileChart(targetPeak, shavedLoad) {
    const originalDemand = fleetLoadData.originalDemand;
    
    loadProfileChart.data.datasets = [
        {
            label: 'Original Demand',
            data: originalDemand,
            borderColor: '#003DA5', // OPTERRA blue
            backgroundColor: 'rgba(0, 61, 165, 0.1)',
            borderWidth: 2,
            tension: 0.1,
            pointRadius: 0
        },
        {
            label: 'With BESS',
            data: shavedLoad,
            borderColor: '#28A745', // Green
            backgroundColor: 'rgba(40, 167, 69, 0.1)',
            borderWidth: 2,
            tension: 0.1,
            pointRadius: 0
        },
        {
            label: 'Target Peak',
            data: Array(fleetLoadData.originalDemand.length).fill(targetPeak),
            borderColor: '#DC3545', // Red
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0
        }
    ];
    
    loadProfileChart.update();
}

function updateBESSSizingChart() {
    const targets = [30, 40, 50, 60, 70];
    const energyRequirements = [];
    const powerRequirements = [];
    
    // Calculate requirements for each target
    targets.forEach(target => {
        const results = calculateBESSRequirements(target);
        energyRequirements.push(results.energy);
        powerRequirements.push(results.power);
    });
    
    bessSizingChart.data.datasets = [
        {
            label: 'BESS Energy (kWh)',
            data: energyRequirements,
            borderColor: '#003DA5',
            backgroundColor: 'rgba(0, 61, 165, 0.2)',
            borderWidth: 2,
            tension: 0.1,
            yAxisID: 'y'
        },
        {
            label: 'BESS Power (kW)',
            data: powerRequirements,
            borderColor: '#FFC107',
            backgroundColor: 'rgba(255, 193, 7, 0.2)',
            borderWidth: 2,
            tension: 0.1,
            yAxisID: 'y'
        }
    ];
    
    bessSizingChart.update();
}

function updateEconomicsChart() {
    const targets = [30, 40, 50, 60, 70];
    const costs = [];
    const paybacks = [];
    
    targets.forEach(target => {
        const results = calculateBESSRequirements(target);
        costs.push(results.cost / 1000); // Convert to thousands
        paybacks.push(results.payback);
    });
    
    economicsChart.data.datasets = [
        {
            label: 'BESS Cost ($1000s)',
            data: costs,
            backgroundColor: '#003DA5',
            borderColor: '#003DA5',
            borderWidth: 1
        },
        {
            label: 'Payback Period (years)',
            data: paybacks,
            backgroundColor: '#28A745',
            borderColor: '#28A745',
            borderWidth: 1
        }
    ];
    
    economicsChart.update();
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Format numbers with commas
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Add smooth scroll behavior for better UX
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// ============================================================================
// EXPORT FOR TESTING (if needed)
// ============================================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateBESSRequirements,
        fleetLoadData
    };
}