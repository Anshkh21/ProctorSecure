# ProctorTool Free Hosting Plan

Based on the investigation of your project structure, your application is a full-stack web application with the following components:

1. **Frontend**: A React.js application using Tailwind CSS.
2. **Backend**: A Python-based FastAPI application that is highly ML-intensive. It uses heavy libraries including PyTorch (`torch`), YOLOv5, OpenCV (`opencv-contrib-python`), MediaPipe, and `deepface`.
3. **Database**: A MongoDB database (accessed via `motor` and `pymongo`).

## The Challenge

Hosting the **Frontend** and **Database** for free is straightforward. However, hosting your **Backend** is challenging because deep learning models (YOLOv5, DeepFace) require a significant amount of RAM (often > 2GB) just to load into memory. Standard free tiers from platforms like Render, Heroku, or Vercel Serverless provide limited RAM (e.g., 512MB or 250MB), which will result in **Out-Of-Memory (OOM) crashes**.

Below is the best strategy to host your entire stack for **$0/month**.

---

## 1. Database: MongoDB Atlas (Always Free)

MongoDB Atlas offers a generous and reliable "Always Free" M0 cluster.

**Steps:**
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign up.
2. Create a new Deployment and select the **M0 Free** cluster. Choose AWS/GCP/Azure as the provider and a region closest to you.
3. Once the cluster is created, go to **Database Access** and create a new user with a password.
4. Go to **Network Access** and add IP address `0.0.0.0/0` (Allows access from anywhere, which is needed for cloud hosting).
5. Click **Connect** on your Database to get the connection string (it looks like `mongodb+srv://<username>:<password>@cluster0...`). You will use this in your backend `.env` file.

---

## 2. Frontend: Vercel (Always Free)

Vercel is the easiest and most robust way to host React applications, and its free "Hobby" tier offers everything you need.

**Steps:**
1. Push your entire `ProctorTool-main` project to a **GitHub repository**.
2. Go to [Vercel](https://vercel.com/) and sign up with GitHub.
3. Click **Add New** -> **Project** and import your GitHub repository.
4. In the Project Configuration on Vercel:
   - **Framework Preset**: Create React App
   - **Root Directory**: Select `frontend` (Important! Don't leave it as root).
   - **Environment Variables**: Add your backend URL (e.g., `REACT_APP_API_URL` or `VITE_API_URL` depending on your setup) pointing to your hosted backend.
5. Click **Deploy**. Vercel will build and host your site, giving you a free `.vercel.app` domain and automatic HTTPS.

---

## 3. Backend: 3 Strategies for Free ML Hosting

Because your backend is ML-heavy, you cannot use conventional free platforms. Choose one of the following options based on your preference:

### Option A: Hugging Face Spaces (Easiest & Best for ML)
Hugging Face offers free "Spaces" intended for ML demos. They give you up to **16GB RAM and 2 vCPUs** for free! This is more than enough for YOLO + DeepFace.

**Steps:**
1. Create an account on [Hugging Face](https://huggingface.co/).
2. Create a **New Space**, specify the name, and select **Docker** as the SDK (with a Blank template).
3. Inside your project's `backend` folder, create a `Dockerfile`:
   ```dockerfile
   FROM python:3.10-slim

   # Install system dependencies for OpenCV and MediaPipe
   RUN apt-get update && apt-get install -y libgl1 libglib2.0-0

   WORKDIR /app
   COPY requirements.txt .
   # Install torch explicitly to get CPU version to save space
   RUN pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
   RUN pip install -r requirements.txt

   COPY . .

   CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "7860"]
   ```
4. Push your `backend` code + `Dockerfile` to the Hugging Face Space repository.
5. Hugging Face will automatically build and deploy it. Your API will be available at your space URL.
*(Note: Free HF Spaces pause after 48 hours of inactivity, requiring you to manually wake them up).*

### Option B: Oracle Cloud Always Free (Most Robust 24/7)
Oracle Cloud provides an incredibly generous "Always Free" tier giving you up to **4 ARM CPUs and 24GB RAM**. This is essentially a powerful virtual private server.

**Steps:**
1. Sign up for [Oracle Cloud](https://www.oracle.com/cloud/free/).
2. Create an **Ampere A1 Compute Instance** (ARM architecture). Allocate 2 or 4 OCPUs and up to 24 GB RAM.
3. Choose an OS (e.g., Ubuntu 22.04).
4. Connect to the instance via SSH.
5. Install Python, Git, and Pip. Clone your repository.
6. Check if ARM architecture limits any pip packages, sometimes OpenCV takes longer to compile.
7. Run your FastAPI app using `uvicorn` and a manager like `pm2` or `systemd` to keep it running 24/7.
8. Open port 8000 in your Oracle subnet Security List.

### Option C: AWS EC2 t2.micro + Swap Space (Classic approach)
AWS offers a free `t2.micro` instance for 12 months with 1GB RAM. By itself, 1GB RAM **will crash** when loading DeepFace/YOLO. You must add Swap space (using disk space as fake RAM).

**Steps:**
1. Create an AWS account and launch an Ubuntu EC2 `t2.micro` instance.
2. SSH into your instance.
3. **Crucial**: Create 4GB of Swap Space:
   ```bash
   sudo fallocate -l 4G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```
4. Clone your repository to the EC2 instance.
5. Install dependencies and run `uvicorn server:app --host 0.0.0.0 --port 8000`.
6. Use NGINX as a reverse proxy with Let's Encrypt to get HTTPS.
*(Note: Execution might be slightly slower because it relies on disk swap memory instead of real RAM).*

## Recommended Implementation Order
1. Setup a MongoDB Atlas Database and replace your local Mongo URI with the Atlas URI in your backend.
2. Try running the backend via **Hugging Face Spaces (Option A)** first, as it handles the SSL setup and gives you plenty of RAM without Linux administration overhead.
3. Once the backend has a live HTTPS URL, add that URL to your `frontend/.env` file.
4. Deploy the frontend to **Vercel**.
