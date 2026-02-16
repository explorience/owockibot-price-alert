# Owockibot Price Alert Bot

A Node.js bot that monitors owockibot token price on Base and posts X alerts when the price moves more than 10% within an hour.

## Features

- 🚀 **Real-time monitoring**: Checks price every 5 minutes via DexScreener API
- 📈 **Smart alerts**: Only alerts on 10%+ moves within 1-hour windows  
- 🐦 **X integration**: Posts alerts via Postiz API (no apostrophes, <280 chars)
- 💾 **Price history**: Maintains local price history for accurate calculations
- ⚡ **Auto-recovery**: Handles API errors gracefully, continues monitoring
- 🔄 **Graceful shutdown**: Responds to SIGINT/SIGTERM signals

## Token Information

- **Token**: owockibot ($OWOCKI)
- **Contract**: `0xfDC933Ff4e2980d18beCF48e4E030d8463A2Bb07`
- **Network**: Base
- **Data Source**: DexScreener API

## Setup Instructions

### Prerequisites

- Node.js 18+ 
- Access to Postiz API (for X posting)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/heen-ai/owockibot-price-alert.git
   cd owockibot-price-alert
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure the bot:**
   
   The bot is pre-configured with:
   - Token address: `0xfDC933Ff4e2980d18beCF48e4E030d8463A2Bb07`
   - Check interval: 5 minutes
   - Alert threshold: 10% change in 1 hour
   - Postiz integration for X posting

   Configuration is in `bot.js` in the `CONFIG` object at the top.

### Running the Bot

#### Development/Testing
```bash
npm start
```

#### Production (with PM2)
```bash
# Install PM2 globally
npm install -g pm2

# Start the bot
pm2 start bot.js --name owockibot-alerts

# Monitor logs
pm2 logs owockibot-alerts

# Restart if needed
pm2 restart owockibot-alerts

# Stop the bot
pm2 stop owockibot-alerts
```

#### Production (with systemd)
```bash
# Copy the systemd service file
sudo cp owockibot-alerts.service /etc/systemd/system/

# Reload systemd and start
sudo systemctl daemon-reload
sudo systemctl enable owockibot-alerts
sudo systemctl start owockibot-alerts

# Check status
sudo systemctl status owockibot-alerts

# View logs
sudo journalctl -u owockibot-alerts -f
```

### Cron Setup (Alternative)

Add to crontab for basic scheduled checks:
```bash
# Check every 5 minutes
*/5 * * * * cd /path/to/owockibot-price-alert && timeout 60 node bot.js >> logs/cron.log 2>&1
```

## How It Works

### Price Monitoring
1. **Fetch Price**: Queries DexScreener API for owockibot token data
2. **Select Best Pair**: Automatically picks the pair with highest liquidity
3. **Store History**: Maintains rolling 1-hour price history in `price_history.json`
4. **Calculate Changes**: Compares current price to oldest price in 1-hour window

### Alert Logic
- **Threshold**: 10% absolute change (up or down)
- **Time Window**: 1 hour rolling window
- **Trigger**: When `|current_price - oldest_price| / oldest_price >= 0.10`

### Alert Format
Tweets are formatted to stay under 280 characters:

```
🚀📈 OWOCKIBOT ALERT!

SURGE: 15.3% in 47min
$0.000123 → $0.000142

24h Vol: $45K
Liquidity: $128K

#owockibot #DeFi #Base $OWOCKI
```

## Files

- `bot.js` - Main bot script
- `package.json` - Node.js project configuration  
- `price_history.json` - Auto-generated price history (created on first run)
- `owockibot-alerts.service` - systemd service file
- `logs/` - Log directory (auto-created)

## API Integration

### DexScreener API
- **Endpoint**: `https://api.dexscreener.com/latest/dex/tokens/{address}`
- **Rate Limits**: No authentication required, reasonable rate limits
- **Data**: Price, volume, liquidity, pair information

### Postiz API  
- **Endpoint**: `https://api.postiz.com/public/v1/posts`
- **Authentication**: API key in Authorization header (no Bearer prefix)
- **Integration**: Posts to X account via integration ID
- **Limits**: Standard X API limits apply

## Error Handling

- **API Failures**: Logs error, continues monitoring next cycle
- **Network Issues**: Retries on next scheduled check
- **Invalid Data**: Skips cycle if price data is malformed  
- **Posting Failures**: Logs error but doesn't crash bot

## Logs

Bot outputs timestamped logs:
- Price checks and results
- Alert triggers and posts
- Error messages and recovery
- Startup/shutdown events

## Troubleshooting

### Common Issues

1. **No price data**: Check if token address is correct and has active trading pairs
2. **Posting fails**: Verify Postiz API key and integration ID
3. **High memory usage**: Price history auto-cleans old entries (1-hour window)
4. **Bot stops**: Check logs for errors, restart with PM2/systemd

### Debug Mode

Add debug logging by modifying the `console.log` statements in `bot.js`:

```javascript
// Add after price fetch
console.log('Full API response:', JSON.stringify(data, null, 2));
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Bounty Submission

This bot was created for the owockibot bounty program:
- **Bounty**: Price Alert Bot (20 USDC)
- **Requirements**: ✅ Monitors 10%+ moves ✅ Posts to social ✅ Uses on-chain data ✅ Working source code
- **Submission**: [Working bot link] + [GitHub source]

Built with ❤️ by HeenAI (@heen_ai)