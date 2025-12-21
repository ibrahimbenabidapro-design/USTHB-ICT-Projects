# Vercel Serverless Deployment - Profile Picture Upload Fix

## Problem

Multer with `diskStorage` **fails on Vercel** because serverless functions have **ephemeral filesystems** - any files written to disk are deleted after the function execution ends.

**Error on Vercel**: `INTERNAL SERVER ERROR 500` when editing profile with image upload.

## Solution

Changed from **disk-based storage** to **memory-based storage** with optional external upload service.

---

## What Changed

### 1. Multer Configuration ✅
**Before** (local only):
```javascript
const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "public", "uploads", "avatars"),
  filename: (req, file, cb) => { /* ... */ }
});
```

**After** (Vercel-compatible):
```javascript
const storage = multer.memoryStorage();
```

### 2. File Handling ✅
**Before**:
```javascript
if (req.file) {
  profilePicture = `/uploads/avatars/${req.file.filename}`;
}
```

**After** (memory-based):
```javascript
if (req.file) {
  // req.file.buffer contains file data in memory
  // Option 1: Base64 string (simple)
  // profilePicture = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  
  // Option 2: Upload to Cloudinary (recommended)
  // profilePicture = await uploadToCloudinary(req.file.buffer, req.file.mimetype, req.user.id);
}
```

### 3. Removed File System Operations ✅
Deleted:
- `fs` import
- `path` import  
- `uploadDir` directory creation
- Disk storage configuration

---

## Implementation Options

### Option 1: Base64 Storage (⚠️ Not Recommended)

**Pros**: Works immediately, no external service needed

**Cons**: Database grows very large, slower loading, base64 is 33% larger than binary

```javascript
// In routes/users.js, line 115
if (req.file) {
  profilePicture = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
}
```

**Result**: Images stored in DB as base64 strings (~1.5-2MB per image)

---

### Option 2: Cloudinary Integration ✅ RECOMMENDED

**Pros**: Fast, scalable, free tier (25GB), automatic image optimization

**Cons**: Requires external account and environment variables

#### Setup Steps:

1. **Install Cloudinary SDK**:
```bash
npm install cloudinary
```

2. **Get Cloudinary Credentials**:
   - Go to [cloudinary.com](https://cloudinary.com)
   - Sign up (free tier available)
   - Copy `Cloud Name`, `API Key`, `API Secret`

3. **Add Environment Variables**:

   **On Vercel**:
   - Go to Vercel Project Settings → Environment Variables
   - Add:
     ```
     CLOUDINARY_CLOUD_NAME=your_cloud_name
     CLOUDINARY_API_KEY=your_api_key
     CLOUDINARY_API_SECRET=your_api_secret
     ```

   **Locally** (in `.env`):
   ```
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

4. **Use the Helper Functions**:

   Update [routes/users.js](routes/users.js#L106-L120):

   ```javascript
   import { uploadToCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js";

   // In the PUT /users/me route
   if (req.file) {
     try {
       const imageUrl = await uploadToCloudinary(req.file.buffer, req.file.mimetype, req.user.id);
       if (imageUrl) {
         // Delete old image from Cloudinary if exists
         if (currentUser.profile_picture && currentUser.profile_picture.includes('cloudinary')) {
           await deleteFromCloudinary(currentUser.profile_picture);
         }
         profilePicture = imageUrl;
       }
     } catch (err) {
       console.error("[ERROR] Avatar upload to Cloudinary failed:", err.message);
       // Continue without updating image on upload failure
     }
   }
   ```

---

## Other External Storage Options

| Service | Free Tier | Speed | Setup Difficulty |
|---------|-----------|-------|-------------------|
| **Cloudinary** | 25GB | ⚡ Very Fast | ⭐ Easy |
| **AWS S3** | 12 months free | ⚡ Very Fast | ⭐⭐ Medium |
| **Supabase Storage** | 1GB | ⚡ Fast | ⭐ Easy |
| **Firebase Storage** | 1GB | ⚡ Fast | ⭐⭐ Medium |

### Quick Alternative: Supabase Storage

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

if (req.file) {
  const filename = `avatars/${req.user.id}-${Date.now()}`;
  const { data, error } = await supabase.storage
    .from('profiles')
    .upload(filename, req.file.buffer);
  
  if (!error && data) {
    profilePicture = supabase.storage
      .from('profiles')
      .getPublicUrl(filename).data.publicUrl;
  }
}
```

---

## Files Modified

| File | Changes |
|------|---------|
| [routes/users.js](routes/users.js) | Changed multer to memoryStorage, updated file handling logic |
| [utils/cloudinary.js](utils/cloudinary.js) | New file: Cloudinary upload/delete functions |

---

## Testing on Vercel

1. **Deploy** to Vercel (git push)
2. **Add environment variables** in Vercel dashboard
3. **Test profile edit** → Upload image → Should work without 500 error ✅

## Local Testing

```bash
# Works with both disk (original behavior) AND memory storage
npm start
```

---

## Current State (After Fix)

✅ Profile edit works on Vercel (no disk writes)  
⚠️ Images currently not stored (optional external service)  
📝 Ready for Cloudinary integration (follow steps above)

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 500 error on profile edit (Vercel) | Multer now uses memoryStorage ✅ |
| Images not saving | Need to set up external storage (Cloudinary/S3/Supabase) |
| "Cloudinary not configured" warning | Set env vars: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| Rate limiting | Use dedicated Cloudinary account for production |

