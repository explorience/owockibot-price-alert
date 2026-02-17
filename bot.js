#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
    TOKEN_ADDRESS: '0xfDC933Ff4e2980d18beCF48e4E030d8463A2Bb07',
    DEXSCREENER_API: 'https://api.dexscreener.com/latest/dex/tokens/0xfDC933Ff4e2980d18beCF48e4E030d8463A2Bb07',
    POSTIZ_API: 'https://api.postiz.com/public/v1/posts',
    POSTIZ_API_KEY: '873ea1f048b3c615861b748ba7d09c4839bcea3f89c2090dc7c870ee0bf79c69',
    POSTIZ_INTEGRATION_ID: 'cmlb43mjo01x5ns0ysgfqs8z1',
    CHECK_INTERVAL: 5 * 60 * 1000, // 5 minutes in milliseconds
    ALERT_THRESHOLD: 0.10, // 10% change
    TIME_WINDOW: 60 * 60 * 1000, // 1 hour in milliseconds
    ALERT_COOLDOWN: 60 * 60 * 1000, // 1 hour minimum between alerts
    PRICE_HISTORY_FILE: path.join(__dirname, 'price_history.json'),
    LAST_ALERT_FILE: path.join(__dirname, 'last_alert.json')
};

class OwockibotPriceBot {
    constructor() {
        this.priceHistory = this.loadPriceHistory();
        this.lastAlert = this.loadLastAlert();
        this.isRunning = false;
    }

    loadLastAlert() {
        try {
            if (fs.existsSync(CONFIG.LAST_ALERT_FILE)) {
                return JSON.parse(fs.readFileSync(CONFIG.LAST_ALERT_FILE, 'utf8'));
            }
        } catch (error) {}
        return { timestamp: 0, direction: null };
    }

    saveLastAlert(direction) {
        const data = { timestamp: Date.now(), direction };
        try {
            fs.writeFileSync(CONFIG.LAST_ALERT_FILE, JSON.stringify(data));
        } catch (error) {}
        this.lastAlert = data;
    }

    isOnCooldown() {
        return (Date.now() - this.lastAlert.timestamp) < CONFIG.ALERT_COOLDOWN;
    }

    loadPriceHistory() {
        try {
            if (fs.existsSync(CONFIG.PRICE_HISTORY_FILE)) {
                const data = fs.readFileSync(CONFIG.PRICE_HISTORY_FILE, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading price history:', error.message);
        }
        return [];
    }

    savePriceHistory() {
        try {
            fs.writeFileSync(CONFIG.PRICE_HISTORY_FILE, JSON.stringify(this.priceHistory, null, 2));
        } catch (error) {
            console.error('Error saving price history:', error.message);
        }
    }

    async fetchPrice() {
        try {
            const response = await fetch(CONFIG.DEXSCREENER_API);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.pairs || data.pairs.length === 0) {
                throw new Error('No trading pairs found');
            }

            // Get the most liquid pair (highest liquidity)
            const bestPair = data.pairs.reduce((prev, current) => 
                (current.liquidity?.usd || 0) > (prev.liquidity?.usd || 0) ? current : prev
            );

            return {
                price: parseFloat(bestPair.priceUsd),
                timestamp: Date.now(),
                pairAddress: bestPair.pairAddress,
                dexId: bestPair.dexId,
                volume24h: parseFloat(bestPair.volume?.h24 || 0),
                liquidity: parseFloat(bestPair.liquidity?.usd || 0),
                marketCap: parseFloat(bestPair.marketCap || bestPair.fdv || 0)
            };
        } catch (error) {
            console.error('Error fetching price:', error.message);
            return null;
        }
    }

    cleanOldPrices() {
        const cutoff = Date.now() - CONFIG.TIME_WINDOW;
        this.priceHistory = this.priceHistory.filter(entry => entry.timestamp > cutoff);
    }

    checkForAlerts(currentPrice) {
        if (this.priceHistory.length === 0) return null;

        // Clean old prices first
        this.cleanOldPrices();

        // Find the oldest price in our window for comparison
        const oldestPrice = this.priceHistory.reduce((oldest, current) =>
            current.timestamp < oldest.timestamp ? current : oldest
        );

        // Calculate percentage change
        const priceChange = ((currentPrice.price - oldestPrice.price) / oldestPrice.price) * 100;
        const absChange = Math.abs(priceChange);

        // Check if it exceeds our threshold
        if (absChange >= CONFIG.ALERT_THRESHOLD * 100) {
            const direction = priceChange > 0 ? 'UP' : 'DOWN';
            const timespan = Math.round((currentPrice.timestamp - oldestPrice.timestamp) / (1000 * 60)); // minutes
            
            return {
                direction,
                percentage: Math.abs(priceChange),
                oldPrice: oldestPrice.price,
                newPrice: currentPrice.price,
                timespan,
                volume24h: currentPrice.volume24h,
                liquidity: currentPrice.liquidity,
                marketCap: currentPrice.marketCap
            };
        }

        return null;
    }

    formatPrice(price) {
        if (price < 0.000001) {
            return price.toExponential(6);
        } else if (price < 0.01) {
            return price.toFixed(9);
        } else if (price < 1) {
            return price.toFixed(7);
        } else {
            return price.toFixed(5);
        }
    }

    formatVolume(volume) {
        if (volume >= 1000000) {
            return `$${(volume / 1000000).toFixed(1)}M`;
        } else if (volume >= 1000) {
            return `$${(volume / 1000).toFixed(0)}K`;
        } else {
            return `$${volume.toFixed(0)}`;
        }
    }

    createAlertTweet(alert) {
        const emoji = alert.direction === 'UP' ? '🚀📈' : '📉💥';
        const direction = alert.direction === 'UP' ? 'SURGE' : 'DROP';
        
        // Keep tweet under 280 chars and avoid apostrophes (Postiz quirk)
        const tweet = `${emoji} $OWOCKI ALERT @owocki @owockibot

${direction}: ${alert.percentage.toFixed(1)}% in ${alert.timespan}min
${this.formatPrice(alert.oldPrice)} → ${this.formatPrice(alert.newPrice)}

MCap: ${this.formatVolume(alert.marketCap)}
24h Vol: ${this.formatVolume(alert.volume24h)}
Liquidity: ${this.formatVolume(alert.liquidity)}`;

        return tweet;
    }

    async postAlert(alert) {
        try {
            const tweet = this.createAlertTweet(alert);
            
            // Ensure tweet is under 280 characters
            if (tweet.length > 280) {
                console.error('Tweet too long:', tweet.length, 'characters');
                return false;
            }

            const payload = {
                type: 'now',
                date: new Date().toISOString(),
                shortLink: false,
                tags: [],
                posts: [{
                    integration: {
                        id: CONFIG.POSTIZ_INTEGRATION_ID
                    },
                    value: [{
                        content: tweet,
                        image: []
                    }],
                    settings: {
                        __type: 'x',
                        who_can_reply_post: 'everyone'
                    }
                }]
            };

            const response = await fetch(CONFIG.POSTIZ_API, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': CONFIG.POSTIZ_API_KEY // No Bearer prefix!
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
            }

            const result = await response.json();
            console.log('Alert posted successfully:', tweet);
            return true;
            
        } catch (error) {
            console.error('Error posting alert:', error.message);
            return false;
        }
    }

    async checkPrice() {
        console.log(`[${new Date().toISOString()}] Checking owockibot price...`);
        
        const currentPrice = await this.fetchPrice();
        if (!currentPrice) {
            console.log('Failed to fetch price, skipping this check');
            return;
        }

        console.log(`Current price: $${this.formatPrice(currentPrice.price)}`);

        // Add to history
        this.priceHistory.push(currentPrice);
        
        // Check for alerts
        const alert = this.checkForAlerts(currentPrice);
        if (alert) {
            if (this.isOnCooldown()) {
                console.log(`ALERT suppressed (cooldown): ${alert.direction} ${alert.percentage.toFixed(1)}% - last alert ${Math.round((Date.now() - this.lastAlert.timestamp) / 60000)}min ago`);
            } else {
                console.log(`ALERT: ${alert.direction} ${alert.percentage.toFixed(1)}% in ${alert.timespan} minutes!`);
                const posted = await this.postAlert(alert);
                if (posted) {
                    this.saveLastAlert(alert.direction);
                }
            }
        }

        // Save history
        this.savePriceHistory();
    }

    async start() {
        if (this.isRunning) {
            console.log('Bot is already running');
            return;
        }

        this.isRunning = true;
        console.log('Starting owockibot price alert bot...');
        console.log(`Monitoring token: ${CONFIG.TOKEN_ADDRESS}`);
        console.log(`Check interval: ${CONFIG.CHECK_INTERVAL / 1000 / 60} minutes`);
        console.log(`Alert threshold: ${CONFIG.ALERT_THRESHOLD * 100}% in 1 hour`);

        // Do initial check
        await this.checkPrice();

        // Set up interval
        this.interval = setInterval(async () => {
            try {
                await this.checkPrice();
            } catch (error) {
                console.error('Error in price check:', error.message);
            }
        }, CONFIG.CHECK_INTERVAL);

        console.log('Bot started successfully!');
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.isRunning = false;
        console.log('Bot stopped');
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    if (global.bot) {
        global.bot.stop();
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM, shutting down gracefully...');
    if (global.bot) {
        global.bot.stop();
    }
    process.exit(0);
});

// Main execution
if (require.main === module) {
    global.bot = new OwockibotPriceBot();
    global.bot.start().catch(error => {
        console.error('Failed to start bot:', error.message);
        process.exit(1);
    });
}

module.exports = OwockibotPriceBot;