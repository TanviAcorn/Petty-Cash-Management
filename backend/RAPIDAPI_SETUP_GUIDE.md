# RapidAPI Setup Guide for Travel Booking Integration

This guide will help you set up RapidAPI access for Skyscanner and Booking.com APIs.

## Step 1: Create RapidAPI Account

1. Go to https://rapidapi.com/
2. Click "Sign Up" (top right)
3. Create a free account using email or Google/GitHub

## Step 2: Subscribe to Skyscanner Flight Search API

1. Go to https://rapidapi.com/skyscanner/api/skyscanner-flight-search
2. Click "Subscribe to Test" button
3. Choose a plan:
   - **Basic (FREE)**: 100 requests/month - Good for testing
   - **Pro ($9.99/month)**: 500 requests/month - Good for small production
   - **Ultra ($49.99/month)**: 10,000 requests/month - For production use
4. Click "Subscribe"

## Step 3: Subscribe to Booking.com API

1. Go to https://rapidapi.com/apidojo/api/booking
2. Click "Subscribe to Test" button
3. Choose a plan:
   - **Basic (FREE)**: 500 requests/month - Good for testing
   - **Pro ($10/month)**: 10,000 requests/month - Good for production
   - **Ultra ($100/month)**: 100,000 requests/month - For high volume
4. Click "Subscribe"

## Step 4: Get Your API Key

1. After subscribing to both APIs, go to your RapidAPI Dashboard
2. Click on any API you subscribed to
3. Look for the "X-RapidAPI-Key" in the code snippets section
4. Copy this key - **it's the same key for all APIs you subscribe to**

## Step 5: Configure Your Application

1. Open `backend/.env` file
2. Find the line: `RAPIDAPI_KEY=your_rapidapi_key_here`
3. Replace `your_rapidapi_key_here` with your actual RapidAPI key
4. Save the file

Example:
```
RAPIDAPI_KEY=abc123def456ghi789jkl012mno345pqr
```

## Step 6: Restart Your Server

```bash
cd backend
npm start
```

## Step 7: Test the Integration

You can test the APIs using these endpoints:

### Test Flight Search
```bash
curl -X POST http://localhost:5005/api/travel/flights/search \
  -H "Content-Type: application/json" \
  -d '{
    "origin": "LHR",
    "destination": "JFK",
    "departureDate": "2024-12-01",
    "returnDate": "2024-12-08",
    "currency": "GBP"
  }'
```

### Test Accommodation Search
```bash
curl -X POST http://localhost:5005/api/travel/accommodations/search \
  -H "Content-Type: application/json" \
  -d '{
    "destination": "London",
    "checkInDate": "2024-12-01",
    "checkOutDate": "2024-12-05",
    "guests": 2,
    "currency": "GBP"
  }'
```

## Important Notes

### Rate Limits
- Free tier has limited requests per month
- Monitor your usage in RapidAPI dashboard
- Consider upgrading if you hit limits

### API Response Times
- Flight searches can take 5-15 seconds
- Hotel searches typically take 3-10 seconds
- This is normal for travel APIs

### Error Handling
The application handles these errors gracefully:
- Invalid API key (401/403)
- Rate limit exceeded (429)
- Network timeouts
- Invalid search parameters

### Cost Considerations
- Start with free tier for testing
- Monitor usage in RapidAPI dashboard
- Upgrade plans as needed based on traffic
- Each search counts as 1-2 API requests

## Troubleshooting

### "Flight search service authentication failed"
- Check that RAPIDAPI_KEY is correctly set in .env
- Verify you're subscribed to Skyscanner API
- Check your subscription is active in RapidAPI dashboard

### "Rate limit exceeded"
- You've hit your monthly request limit
- Wait until next month or upgrade your plan
- Check usage in RapidAPI dashboard

### "No results found"
- Try different airport codes (use 3-letter IATA codes like LHR, JFK)
- Check dates are in the future
- Verify destination city names are correct

### Server not using new API key
- Restart the Node.js server after updating .env
- Check for typos in the .env file
- Ensure no extra spaces around the key

## Support

- RapidAPI Support: https://rapidapi.com/support
- Skyscanner API Docs: https://rapidapi.com/skyscanner/api/skyscanner-flight-search
- Booking.com API Docs: https://rapidapi.com/apidojo/api/booking

## Security Best Practices

1. **Never commit .env file to git** - It's already in .gitignore
2. **Keep your API key secret** - Don't share it publicly
3. **Rotate keys periodically** - Generate new keys every few months
4. **Monitor usage** - Check for unexpected API calls
5. **Use environment variables** - Never hardcode keys in source code
