# Debugging INTERNAL SERVER ERROR on Vercel

## What We Fixed

Added **comprehensive error logging and handling** to identify the exact failure point.

---

## Where to Check for Errors

### 1. **Vercel Function Logs**
This is the PRIMARY place to see errors.

**How to access**:
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click on your project
3. Go to **Deployments** → Select the latest deployment
4. Click **View Function Logs** (or **Functions** tab)
5. Look for lines starting with:
   - `[ERROR]` - Actual errors
   - `[CRITICAL]` - Server startup errors
   - `[WARN]` - Warnings (not critical)

**Example output you'll see**:
```
[INFO] Server running on port 3000
[INFO] Database: Configured
[ERROR] PUT /users/me - Profile update failed:
[ERROR] Error code: ECONNREFUSED
[CRITICAL] Database connection refused - check DATABASE_URL
```

---

## Common Errors and Fixes

### ❌ Error: "ECONNREFUSED" or "ENOTFOUND" (Database Connection Failed)

**Means**: DATABASE_URL is wrong or database is down

**How to fix**:
1. Go to Vercel Project → Settings → Environment Variables
2. Check `DATABASE_URL` is set correctly
3. Test it locally: `psql $DATABASE_URL`
4. If it's a PostgreSQL URL from Render/Supabase/AWS, ensure:
   - Host is reachable from Vercel
   - Firewall allows connections
   - Credentials are correct

---

### ❌ Error: "MULTER ERROR" or "File upload error"

**Means**: File validation or size limit failed

**How to fix**:
1. Check file size is under 5MB
2. Check file type is: jpeg, jpg, png, gif, webp
3. Look at the exact error in Function Logs for details

---

### ❌ Error: "Username is required"

**Means**: Form data parsing failed or field was empty

**How to fix**:
1. Check frontend is sending FormData correctly in profile.html
2. Check Content-Type header is NOT set (let browser auto-set for multipart/form-data)
3. Verify username field is not empty in form

---

### ❌ Error: "500 with no details in response"

**Means**: Unhandled error - check Function Logs for stack trace

**How to fix**:
1. Check Vercel Function Logs (see above)
2. Look for `[ERROR]` or `[CRITICAL]` lines
3. Share the error stack with developer

---

## Enhanced Error Messages

All errors now log:
- ✅ Error code (ECONNREFUSED, LIMIT_FILE_SIZE, etc.)
- ✅ Full error message
- ✅ Stack trace
- ✅ Request details (body, user ID, file info)
- ✅ Environment info (database configured, NODE_ENV)

---

## Step-by-Step: How to Debug Profile Edit Failure

1. **Open Vercel Function Logs**
   - Dashboard → Project → Deployments → Functions

2. **Try to edit profile and upload image**
   - Go to website profile page
   - Click "Edit Profile"
   - Upload an image
   - Click "Save Changes"

3. **Check Function Logs for errors**
   - Look for lines with `[ERROR]` or `[CRITICAL]`
   - Read the error message and stack

4. **Match error to table above**
   - Find your error code
   - Follow the fix steps

5. **If still not working**
   - Copy the FULL error stack
   - Share it with developer

---

## What Info to Share When Reporting Bug

```
When reporting "still shows INTERNAL SERVER ERROR", please share:

1. Screenshot of Vercel Function Logs (the [ERROR] line)
2. The exact error code (ECONNREFUSED, LIMIT_FILE_SIZE, etc.)
3. Full error message
4. Stack trace (if visible)
5. Steps to reproduce
6. Browser console errors (F12 → Console tab)
```

---

## Testing Locally (Optional)

To test profile edit locally:

```bash
# 1. Ensure DATABASE_URL is set locally
export DATABASE_URL="postgresql://user:pass@localhost:5432/tic_projects"

# 2. Start server
npm start

# 3. Go to http://localhost:5000
# 4. Click edit profile, upload image
# 5. Check terminal for [ERROR] logs
```

---

## Key Files With Error Handling

| File | What It Does |
|------|-------------|
| [db/postgres.js](db/postgres.js) | Database connection with error logging, non-blocking init |
| [routes/users.js](routes/users.js) | Multer error handler, detailed route logging, DB error detection |
| [index.js](index.js) | Global error handler, uncaught exception handler, process monitoring |
| [public/profile.html](public/profile.html) | Client-side error display |

---

## Checklist Before Deployment

- [ ] DATABASE_URL set in Vercel environment
- [ ] Database is running and accessible
- [ ] User table exists in database
- [ ] Check Vercel Function Logs for `[CRITICAL]` errors
- [ ] Test profile edit with small image file
- [ ] Check browser console (F12) for client-side errors

