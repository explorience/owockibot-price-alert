#!/usr/bin/env node

const OwockibotPriceBot = require('./bot.js');

async function runTests() {
    console.log('🧪 Testing Owockibot Price Alert Bot\n');
    
    const bot = new OwockibotPriceBot();
    
    try {
        // Test 1: Price fetching
        console.log('Test 1: Fetching current price...');
        const price = await bot.fetchPrice();
        
        if (price && price.price) {
            console.log('✅ Price fetch successful');
            console.log(`   Price: $${bot.formatPrice(price.price)}`);
            console.log(`   Volume 24h: ${bot.formatVolume(price.volume24h)}`);
            console.log(`   Liquidity: ${bot.formatVolume(price.liquidity)}`);
        } else {
            console.log('❌ Price fetch failed');
            return false;
        }
        
        // Test 2: Price history management
        console.log('\nTest 2: Price history management...');
        bot.priceHistory.push(price);
        bot.savePriceHistory();
        
        const loadedHistory = bot.loadPriceHistory();
        if (loadedHistory.length > 0) {
            console.log('✅ Price history save/load successful');
            console.log(`   History entries: ${loadedHistory.length}`);
        } else {
            console.log('❌ Price history save/load failed');
            return false;
        }
        
        // Test 3: Alert message formatting
        console.log('\nTest 3: Alert message formatting...');
        const mockAlert = {
            direction: 'UP',
            percentage: 12.5,
            oldPrice: 0.000123,
            newPrice: 0.000138,
            timespan: 45,
            volume24h: 45000,
            liquidity: 128000
        };
        
        const tweet = bot.createAlertTweet(mockAlert);
        console.log('✅ Alert tweet formatted successfully');
        console.log(`   Length: ${tweet.length}/280 characters`);
        console.log('   Preview:');
        console.log('   ' + tweet.split('\n').join('\n   '));
        
        if (tweet.length > 280) {
            console.log('❌ Tweet too long!');
            return false;
        }
        
        if (tweet.includes("'")) {
            console.log('❌ Tweet contains apostrophes (Postiz quirk)!');
            return false;
        }
        
        // Test 4: Clean old prices
        console.log('\nTest 4: Old price cleanup...');
        const oldTimestamp = Date.now() - (2 * 60 * 60 * 1000); // 2 hours ago
        bot.priceHistory.push({
            price: 0.000100,
            timestamp: oldTimestamp
        });
        
        const beforeCount = bot.priceHistory.length;
        bot.cleanOldPrices();
        const afterCount = bot.priceHistory.length;
        
        if (afterCount < beforeCount) {
            console.log('✅ Old price cleanup successful');
            console.log(`   Removed ${beforeCount - afterCount} old entries`);
        } else {
            console.log('❌ Old price cleanup may not be working');
        }
        
        console.log('\n🎉 All tests passed! Bot is ready to run.');
        return true;
        
    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        return false;
    }
}

// Mock alert posting for testing (don't actually post)
OwockibotPriceBot.prototype.postAlert = async function(alert) {
    console.log('🔇 Mock alert post (test mode):', alert.direction, alert.percentage.toFixed(1) + '%');
    return true;
};

if (require.main === module) {
    runTests().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = runTests;