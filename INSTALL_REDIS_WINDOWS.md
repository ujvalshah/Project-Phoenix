# Installing Redis on Windows

## ✅ Your .env is Already Configured!

I can see you've already added:
```env
USE_LOCAL_REDIS=true
REDIS_LOCAL_URL=redis://localhost:6379
```

Now we just need to install Redis.

## 🚀 Option 1: Memurai (Recommended - Windows Native)

### Step 1: Download Memurai Developer Edition
1. Go to: https://www.memurai.com/get-memurai
2. Download **Memurai Developer Edition** (free)
3. Run the installer

### Step 2: Start Memurai Service
After installation, Memurai should start automatically as a Windows service.

### Step 3: Verify Installation
Open PowerShell **as Administrator** and run:
```powershell
# Check if Memurai is running
Get-Service Memurai*

# If not running, start it
Start-Service Memurai
```

## 🐳 Option 2: Docker Desktop (Alternative)

### Step 1: Install Docker Desktop
1. Download from: https://www.docker.com/products/docker-desktop
2. Install and start Docker Desktop

### Step 2: Run Redis Container
Open PowerShell and run:
```powershell
docker run -d -p 6379:6379 --name redis redis:latest
```

### Step 3: Verify
```powershell
docker ps
# Should show redis container running
```

## 🍫 Option 3: Chocolatey (Requires Admin)

Open PowerShell **as Administrator** and run:
```powershell
choco install memurai-developer -y
```

After installation, start the service:
```powershell
Start-Service Memurai
```

## ✅ Verify Redis is Working

After installation, test the connection:

```powershell
# Test connection (if you have redis-cli installed)
redis-cli ping
# Should return: PONG

# Or test from Node.js
node -e "const redis = require('redis'); const client = redis.createClient({url: 'redis://localhost:6379'}); client.connect().then(() => { console.log('✅ Redis Connected!'); client.quit(); }).catch(err => console.error('❌ Error:', err.message));"
```

## 🎯 Quick Test After Installation

1. **Start your server:**
   ```powershell
   npm run dev:all
   ```

2. **Look for this in logs:**
   ```
   [Redis] Connected
   [TokenService] Initialized successfully
   ```

3. **Try logging in** - it should work!

## 🔧 Troubleshooting

### If Redis connection fails:

1. **Check if Redis is running:**
   ```powershell
   # For Memurai
   Get-Service Memurai*
   
   # For Docker
   docker ps
   ```

2. **Check port 6379:**
   ```powershell
   Test-NetConnection -ComputerName localhost -Port 6379
   ```
   Should show `TcpTestSucceeded : True`

3. **Start Redis if not running:**
   ```powershell
   # Memurai
   Start-Service Memurai
   
   # Docker
   docker start redis
   ```

## 📝 Next Steps

Once Redis is installed and running:
1. ✅ Your `.env` is already configured correctly
2. ✅ Restart your server: `npm run dev:all`
3. ✅ Check logs for `[Redis] Connected`
4. ✅ Try logging in!

---

**Recommendation:** Use **Memurai Developer Edition** - it's free, Windows-native, and works perfectly for development!
