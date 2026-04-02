# Stripe Test Cards

## ⚠️ Important Note

**Test cards ONLY work with TEST API keys** (`pk_test_...` and `sk_test_...`).  
**They will NOT work with LIVE API keys** (`pk_live_...` and `sk_live_...`).

To test checkout, you need to:
1. Switch to **Test Mode** in your Stripe Dashboard
2. Use **Test API keys** in `/admin/settings/payment`
3. Use the test cards below

---

## 🧪 Test Card Numbers

### Successful Payments

| Card Number | Description | CVC | Date |
|------------|-------------|-----|------|
| `4242 4242 4242 4242` | Visa (most common) | Any 3 digits | Any future date |
| `5555 5555 5555 4444` | Mastercard | Any 3 digits | Any future date |
| `3782 822463 10005` | American Express | Any 4 digits | Any future date |
| `6011 1111 1111 1117` | Discover | Any 3 digits | Any future date |

### 3D Secure Authentication

| Card Number | Description | CVC | Date |
|------------|-------------|-----|------|
| `4000 0025 0000 3155` | Requires authentication | Any 3 digits | Any future date |
| `4000 0027 6000 3184` | Requires authentication | Any 3 digits | Any future date |

### Declined Cards

| Card Number | Description | CVC | Date |
|------------|-------------|-----|------|
| `4000 0000 0000 0002` | Card declined (generic decline) | Any 3 digits | Any future date |
| `4000 0000 0000 9995` | Insufficient funds | Any 3 digits | Any future date |
| `4000 0000 0000 0069` | Expired card | Any 3 digits | Any past date |
| `4000 0000 0000 0127` | Incorrect CVC | Any 3 digits | Any future date |

### Other Test Scenarios

| Card Number | Description | CVC | Date |
|------------|-------------|-----|------|
| `4000 0027 6000 3184` | Requires authentication (3D Secure) | Any 3 digits | Any future date |
| `4000 0000 0000 3220` | Processing error | Any 3 digits | Any future date |

---

## 🔄 How to Switch Between Test and Live Mode

### Option 1: Via Admin Panel (Recommended)

1. Go to `/admin/settings/payment`
2. Update your Stripe keys:
   - **Test Mode**: Use keys starting with `pk_test_...` and `sk_test_...`
   - **Live Mode**: Use keys starting with `pk_live_...` and `sk_live_...`
3. Save the settings

### Option 2: Via Environment Variables

Update your `.env.local` file:

```env
# Test Mode
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...

# Live Mode
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
```

**Note**: Admin panel settings take precedence over environment variables.

---

## 📝 Test Card Details

### Standard Test Card Format

- **Card Number**: Use any of the test numbers above
- **CVC**: Any 3 digits (e.g., `123`, `456`, `789`)
- **Expiry Date**: Any future date (e.g., `12/25`, `01/26`)
- **ZIP Code**: Any 5 digits (e.g., `12345`, `90210`)

### Example Test Card

```
Card Number: 4242 4242 4242 4242
CVC: 123
Expiry: 12/25
ZIP: 12345
```

---

## 🎯 Testing Different Payment Methods

### Apple Pay / Google Pay
- Use test cards in test mode
- Works automatically with test keys

### Link (Stripe's one-click checkout)
- Use test cards in test mode
- Create a test account with any email

### AfterPay / Klarna
- These require separate test credentials
- Configure in `/admin/settings/payment`

---

## 🔍 Verifying Test Mode

1. Check your Stripe Dashboard: https://dashboard.stripe.com/test
2. Look for "TEST MODE" indicator in the top right
3. Test payments will appear in the Test Data section
4. No real charges will be made

---

## 🚨 Important Security Notes

1. **Never use test cards in production** - They will fail with live keys
2. **Never commit API keys** to version control
3. **Use test mode for development** and staging environments
4. **Switch to live mode only** when ready for production

---

## 📚 Additional Resources

- [Stripe Test Cards Documentation](https://stripe.com/docs/testing)
- [Stripe Testing Guide](https://stripe.com/docs/testing)
- [Stripe Dashboard (Test Mode)](https://dashboard.stripe.com/test)

---

## Quick Reference

**Most Common Test Card:**
```
4242 4242 4242 4242
CVC: 123
Expiry: 12/25
```

**To Test Declines:**
```
4000 0000 0000 0002
CVC: 123
Expiry: 12/25
```

