# Deploying Leaflet to AWS — step by step

This guide takes the project from your laptop to a public URL. It uses the simplest setup that is
still realistic and easy to explain in a viva:

```
                     ┌──────────────────── AWS EC2 (Ubuntu) ────────────────────┐
 Browser ──HTTP(S)──▶│  Nginx :80/:443                                           │
                     │    ├─ /      → static Angular build  (/var/www/leavemgm)  │
                     │    └─ /api/* → Node + Express :3000  (kept alive by PM2)  │
                     └───────────────────────────────┬───────────────────────────┘
                                                     │ TLS, allow-listed IP
                                              MongoDB Atlas (free M0 cluster)
```

Nginx serves the site and the API from **one origin**, so there are no CORS problems and the
production Angular build can call the API at the relative path `/api` (already configured in
`src/environments/environment.prod.ts`).

> **Cost warning.** Check the current free-tier / credit terms for your account in the AWS Billing
> console before you start. Even small things (a running instance, a public IPv4 address) can cost
> a little. Section 12 shows how to shut everything down so nothing keeps billing after your demo.

**Time needed:** about 60–90 minutes the first time.

---

## 0. Before you start

- [ ] The app works locally (see the README: backend + frontend running, you can sign in).
- [ ] Your code is pushed to GitHub (`github.com/pankqx/leavemgm`).
- [ ] An **AWS account** with a payment method (and MFA turned on for the root user).
- [ ] A **MongoDB Atlas account** (free): <https://www.mongodb.com/atlas>.
- [ ] Optional but recommended: a **domain name** (needed for HTTPS — see section 10).

---

## 1. Create the database (MongoDB Atlas)

1. In Atlas, create a project, then **Create a cluster** → choose the **free M0** tier → pick a
   region close to where your EC2 server will be (e.g. AWS `ap-south-1` Mumbai).
2. **Database Access → Add New Database User**: username e.g. `leavemgm_app`, a strong
   auto-generated password (save it), role **Read and write to any database**.
3. **Network Access** — leave it empty for now. You will add the server's IP in step 4.
   (Avoid `0.0.0.0/0`; it lets the whole internet attempt to connect.)
4. **Database → Connect → Drivers** and copy the connection string. It looks like:

   ```
   mongodb+srv://leavemgm_app:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

   Replace `<password>` with your password and put the database name before the `?`:

   ```
   mongodb+srv://leavemgm_app:YOURPASSWORD@cluster0.xxxxx.mongodb.net/leavemgm?retryWrites=true&w=majority
   ```

   If the password has special characters (`@ : / ?`), URL-encode them.

---

## 2. Launch the EC2 server

In the AWS console (choose your region first, top-right):

1. **EC2 → Launch instance**
   - **Name:** `leavemgm-server`
   - **AMI:** Ubuntu Server 24.04 LTS (or 22.04 LTS)
   - **Instance type:** `t3.micro` or `t2.micro` (whichever is marked *Free tier eligible* for you)
   - **Key pair:** *Create new key pair* → name `leavemgm-key`, type RSA, `.pem` format. The file
     downloads once — keep it safe and never commit it.
   - **Network settings → Edit → Security group** (create new) with these inbound rules:

     | Type  | Port | Source |
     |-------|------|--------|
     | SSH   | 22   | **My IP** (not Anywhere) |
     | HTTP  | 80   | Anywhere (0.0.0.0/0) |
     | HTTPS | 443  | Anywhere (0.0.0.0/0) |

     Do **not** open port 3000. The API is only reachable through Nginx on the same machine.
   - **Storage:** the default 8 GB is enough.
2. **Launch instance**.
3. **Give it a fixed address:** EC2 → **Elastic IPs → Allocate Elastic IP address → Allocate**, then
   **Actions → Associate Elastic IP address** → select your instance. Note the IP (e.g. `13.233.10.20`).
   Without this, the public IP changes every time the instance restarts.

---

## 3. Let the server reach the database

Atlas → **Network Access → Add IP Address** → paste your **Elastic IP** → add a comment
`leavemgm EC2` → Confirm.

---

## 4. Connect and install the software

On your computer (Mac/Linux; on Windows use PowerShell or WSL). Replace the IP:

```bash
chmod 400 ~/Downloads/leavemgm-key.pem
ssh -i ~/Downloads/leavemgm-key.pem ubuntu@13.233.10.20
```

You are now on the server. Install everything:

```bash
sudo apt update && sudo apt upgrade -y

# Node.js 22 (LTS) from NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs nginx git

# PM2 keeps the API running and restarts it after crashes/reboots
sudo npm install -g pm2

node -v && nginx -v && pm2 -v
```

---

## 5. Get the backend onto the server

```bash
cd ~
git clone https://github.com/pankqx/leavemgm.git
cd leavemgm/backend
npm ci --omit=dev
```

Create the environment file:

```bash
cp .env.example .env
nano .env
```

Set (use your own values):

```ini
PORT=3000
NODE_ENV=production
MONGODB_URI=mongodb+srv://leavemgm_app:YOURPASSWORD@cluster0.xxxxx.mongodb.net/leavemgm?retryWrites=true&w=majority
JWT_SECRET=<paste a 96-character random string>
JWT_EXPIRES_IN=8h
CORS_ORIGINS=http://13.233.10.20
```

Generate the secret on the server with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

`CORS_ORIGINS` should be the address people type in the browser. Change it to
`https://yourdomain.com` after step 10. (Because Nginx serves the site and API from one origin,
the site works either way; this setting matters only if you later host the frontend elsewhere.)

Protect the file: `chmod 600 .env`

### Demo accounts and your first manager

The seed script creates `manager@leaflet.dev` and two employees. **Its default password is in the
public repo**, so set your own before seeding a server that is on the internet:

```bash
SEED_PASSWORD='choose-a-strong-password' npm run seed
```

Alternative: skip the seed, sign up normally in the app, then in Atlas → **Browse Collections →
leavemgm → users**, edit your user and change `role` from `employee` to `manager`.

---

## 6. Start the API with PM2

```bash
cd ~/leavemgm/backend
pm2 start ecosystem.config.js
pm2 logs leavemgm-api --lines 20     # should show "Connected to MongoDB" and "listening on port 3000"
curl http://127.0.0.1:3000/api/health   # {"status":"ok"}
```

Make it survive reboots:

```bash
pm2 save
pm2 startup systemd      # it prints a command beginning with "sudo env PATH=..." — copy and run it
```

If the logs show a MongoDB timeout, the Elastic IP is not in Atlas Network Access yet (step 3).

---

## 7. Build the Angular app and upload it

Build on **your laptop** (a micro instance can run out of memory building Angular). In the repo root:

```bash
npm install
npm run build
```

The finished site is in `dist/leave-management-frontend/` (it contains `index.html`).
Upload it (replace key path and IP):

```bash
rsync -avz --delete -e "ssh -i ~/Downloads/leavemgm-key.pem" \
  dist/leave-management-frontend/ ubuntu@13.233.10.20:/tmp/leavemgm-site/
```

On the server, put it where Nginx will serve it:

```bash
sudo mkdir -p /var/www/leavemgm
sudo rsync -a --delete /tmp/leavemgm-site/ /var/www/leavemgm/
```

---

## 8. Configure Nginx

The repo includes a ready config at `deploy/nginx-leavemgm.conf`:

```bash
sudo cp ~/leavemgm/deploy/nginx-leavemgm.conf /etc/nginx/sites-available/leavemgm
sudo ln -s /etc/nginx/sites-available/leavemgm /etc/nginx/sites-enabled/leavemgm
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t                      # must say "syntax is ok"
sudo systemctl reload nginx
```

---

## 9. Test it

- Open `http://<your-elastic-ip>/` — you should see the sign-in page.
- `curl http://<your-elastic-ip>/api/health` → `{"status":"ok"}`
- Sign in with a seeded account (or create one), apply for leave, then approve it as the manager.
- Refresh on `/history` — it should still load (that proves the Angular `try_files` rule works).

🎉 The app is live. Section 10 adds HTTPS, which you should do before sharing it widely.

---

## 10. HTTPS with a domain (recommended)

Over plain HTTP, passwords and tokens travel unencrypted. That is tolerable only for a short demo
with throwaway passwords. To fix it you need a domain name:

1. Buy or use a domain. At its DNS provider (or **Route 53**), create an **A record**
   `yourdomain.com → your Elastic IP` (and optionally `www`). Wait until `nslookup yourdomain.com`
   shows your IP.
2. Edit the Nginx file: `sudo nano /etc/nginx/sites-available/leavemgm` and change
   `server_name _;` to `server_name yourdomain.com www.yourdomain.com;`, then `sudo nginx -t && sudo systemctl reload nginx`.
3. Get a free Let's Encrypt certificate:

   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
   ```

   Choose the option to redirect HTTP to HTTPS. Certificates renew automatically
   (`sudo certbot renew --dry-run` to verify).
4. Update `CORS_ORIGINS=https://yourdomain.com` in `~/leavemgm/backend/.env`, then
   `pm2 restart leavemgm-api`.

---

## 11. Updating the app later

```bash
# Backend change
ssh -i key.pem ubuntu@<ip>
cd ~/leavemgm && git pull
cd backend && npm ci --omit=dev && pm2 restart leavemgm-api

# Frontend change (from your laptop)
npm run build
rsync -avz --delete -e "ssh -i key.pem" dist/leave-management-frontend/ ubuntu@<ip>:/tmp/leavemgm-site/
ssh -i key.pem ubuntu@<ip> 'sudo rsync -a --delete /tmp/leavemgm-site/ /var/www/leavemgm/'
```

Useful commands: `pm2 status`, `pm2 logs leavemgm-api`, `sudo tail -f /var/log/nginx/error.log`.

---

## 12. Stop the bill when you are done

Do these in order if you no longer need the site (e.g. after your evaluation):

1. EC2 → select the instance → **Instance state → Terminate**.
2. EC2 → **Elastic IPs** → select the IP → **Actions → Disassociate**, then **Release Elastic IP addresses**
   (an Elastic IP you keep allocated can keep billing).
3. Atlas → delete the cluster (or leave the free M0 one — it costs nothing).
4. Billing console → check that no resources are still running in any region.

If you only want to pause it, **stopping** the instance halts compute charges, but storage and any
allocated Elastic IP can still be billed.

---

## Option B — S3 + CloudFront for the frontend (more "cloud-native")

Use this if your course wants S3/CloudFront. It still needs a server for the API (use the same EC2
steps 2–6, skipping Nginx's static-site part), and it is more fiddly, so get option A working first.

1. **S3:** create a bucket, keep *Block all public access* **on**. Upload the contents of
   `dist/leave-management-frontend/`.
2. **CloudFront:** create a distribution with the S3 bucket as origin using **Origin Access Control**
   (apply the bucket policy CloudFront suggests). Set **Default root object** to `index.html`.
3. **SPA routing:** in the distribution's **Error pages**, map **403** and **404** to
   `/index.html` with response code **200**.
4. **API behaviour:** add a second *origin* pointing at your EC2's **public DNS name**
   (CloudFront needs a hostname, not a bare IP) over HTTP port 80 or 443, then a *behaviour* with path
   pattern `/api/*` → that origin. Use the managed cache policy **CachingDisabled**, the origin request
   policy **AllViewerExceptHostHeader** (this forwards the `Authorization` header), and allow all HTTP
   methods. Now the site and the API share one CloudFront domain, so `apiUrl: '/api'` still works.
5. **HTTPS on your own domain:** request a certificate in **AWS Certificate Manager in `us-east-1`**,
   attach it to the distribution with your domain as an alternate name, and point a Route 53 alias record at it.
6. Set `CORS_ORIGINS` on the API to your CloudFront/site URL. After each frontend upload, create a
   CloudFront **invalidation** for `/*` (or the old `index.html` keeps being served).

---

## Troubleshooting

| Symptom | Likely cause and fix |
|---------|----------------------|
| `502 Bad Gateway` on `/api/...` | The API is not running. `pm2 status`, then `pm2 logs leavemgm-api`. |
| Logs: `MongooseServerSelectionError` / timeout | Elastic IP missing from Atlas **Network Access**, wrong password, or special characters not URL-encoded. |
| Server exits at start: `JWT_SECRET must be at least 32 characters` | Set a longer secret in `.env`, `pm2 restart leavemgm-api`. |
| Blank page or 404 when refreshing `/history` | Nginx `try_files … /index.html` rule missing — recopy `deploy/nginx-leavemgm.conf`. |
| Login says "Cannot reach the server" | Browser can't reach `/api`. Check `curl http://<ip>/api/health` and that `environment.prod.ts` still has `apiUrl: '/api'`. |
| `ng build` fails to download fonts | The production build inlines Google Fonts and needs internet access; run it on a normal network. |
| Browser shows a CORS error | You are hosting the frontend on a different origin than the API; add that exact origin (with `https://`, no trailing slash) to `CORS_ORIGINS`. |
| `Permission denied (publickey)` on SSH | Wrong key file, wrong user (`ubuntu` for Ubuntu AMIs), or key not `chmod 400`. |
| Can't SSH after your IP changed | Update the SSH rule in the security group to **My IP** again. |

## Security checklist before you share the link

- [ ] SSH (22) is limited to your IP; port 3000 is **not** open.
- [ ] Atlas Network Access lists only the server's IP (no `0.0.0.0/0`).
- [ ] `.env` is `chmod 600` and is **not** in Git.
- [ ] `JWT_SECRET` is long and random; demo accounts use a strong password (or you removed them).
- [ ] HTTPS is enabled (section 10).
- [ ] Root account has MFA; you use an IAM user for day-to-day work.
