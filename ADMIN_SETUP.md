# Admin Setup Guide

## How to Make Yourself an Admin

There are several ways to become an admin user:

### Option 1: Use the Demo Admin Account (Quickest)

The seed script creates a demo admin account:
- **Email**: `akash@example.com`
- **Password**: `password`

You can use this account to log in and access admin features.

### Option 2: Promote Your Account via Script

If you've already signed up with your own account, you can promote it to admin using the provided script:

```bash
# From the project root directory
npm run promote-admin your-email@example.com
```

**Example:**
```bash
npm run promote-admin user@example.com
```

**Alternative (using tsx directly):**
```bash
npx tsx server/src/utils/promoteToAdmin.ts user@example.com
```

This will:
1. Find your user account by email
2. Promote it to admin role
3. Confirm the change

### Option 3: Manual Database Update

If you prefer to update the database directly:

1. Connect to your MongoDB database
2. Find your user document:
   ```javascript
   db.users.findOne({ "auth.email": "your-email@example.com" })
   ```
3. Update the role:
   ```javascript
   db.users.updateOne(
     { "auth.email": "your-email@example.com" },
     { $set: { role: "admin" } }
   )
   ```

### Option 4: Update Seed Script

You can modify `server/src/utils/seed.ts` to create your account as admin during seeding:

1. Add your user to the `users` array in the seed script
2. Set `role: 'admin' as const`
3. Run the seed script (or force seed if needed)

## Password Requirements

When signing up, passwords must meet these requirements:
- **Minimum 8 characters**
- **At least one uppercase letter** (A-Z)
- **At least one lowercase letter** (a-z)
- **At least one number** (0-9)
- **At least one special character** (!@#$%^&*()_+-=[]{}|;:,.<>?)

If your password doesn't meet these requirements, you'll receive a clear error message explaining what's missing.

## Troubleshooting

### "User not found" error
- Make sure you've signed up first
- Check that the email address is correct (case-insensitive)
- Verify the user exists in the database

### "Already an admin" message
- Your account is already an admin, no action needed

### Script execution errors
- Ensure MongoDB is running
- Check that you're in the project root directory
- Verify TypeScript is installed: `npm install`











