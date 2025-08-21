# 🚀 Photo Check - Deployment Guide

This guide will walk you through deploying your Photo Check app to production.

## 📋 Prerequisites

- Supabase account and project
- Vercel, Netlify, or similar hosting platform
- Git repository

## 🗄️ Supabase Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Choose your organization and region
4. Enter project name: `photo-check`
5. Set database password (save this!)
6. Click "Create new project"

### 2. Database Setup

1. Go to SQL Editor in your Supabase dashboard
2. Copy and paste the contents of `database_schema.sql`
3. Click "Run" to execute the SQL

### 3. Storage Setup

1. Go to Storage > Buckets
2. Click "Create a new bucket"
3. Name: `photos`
4. Set to "Public" (or configure RLS policies)
5. Click "Create bucket"

### 4. Get API Keys

1. Go to Settings > API
2. Copy your Project URL
3. Copy your anon/public key

## 🌐 Environment Variables

Create a `.env` file in your project root:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## 🚀 Deploy to Vercel

### 1. Connect Repository

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your Git repository
4. Select the repository

### 2. Configure Project

1. Framework Preset: `Vite`
2. Root Directory: `./` (default)
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Install Command: `npm install`

### 3. Environment Variables

Add these in Vercel dashboard:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 4. Deploy

Click "Deploy" and wait for build to complete.

## 🌐 Deploy to Netlify

### 1. Connect Repository

1. Go to [netlify.com](https://netlify.com)
2. Click "New site from Git"
3. Choose your Git provider
4. Select your repository

### 2. Configure Build

1. Build command: `npm run build`
2. Publish directory: `dist`
3. Click "Deploy site"

### 3. Environment Variables

Go to Site settings > Environment variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 🔧 Local Development

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Environment Variables

Copy `.env.example` to `.env` and fill in your values.

### 3. Start Development Server

```bash
npm run dev
```

### 4. Open Browser

Navigate to `http://localhost:5173`

## 📱 PWA Testing

### 1. Build for Production

```bash
npm run build
```

### 2. Test PWA Features

1. Open your deployed site
2. Check if "Add to Home Screen" appears
3. Test offline functionality
4. Verify notifications work

### 3. Lighthouse Audit

1. Open Chrome DevTools
2. Go to Lighthouse tab
3. Run PWA audit
4. Address any issues

## 🔒 Security Checklist

- [ ] Row Level Security enabled
- [ ] Environment variables set
- [ ] HTTPS enabled
- [ ] CORS configured
- [ ] Storage policies set

## 🧪 Testing Checklist

- [ ] User registration works
- [ ] User login works
- [ ] Photo reminders scheduled
- [ ] Notifications appear
- [ ] Camera access works
- [ ] Photo upload works
- [ ] PWA installs correctly

## 🆘 Troubleshooting

### Common Issues

1. **Build fails**: Check TypeScript errors
2. **Supabase connection**: Verify environment variables
3. **Camera not working**: Check HTTPS and permissions
4. **Notifications not working**: Check browser permissions

### Debug Steps

1. Check browser console for errors
2. Verify Supabase connection
3. Check environment variables
4. Test on different devices

## 📞 Support

- Check Supabase documentation
- Review browser console logs
- Test on multiple devices
- Verify all environment variables

## 🎯 Next Steps

After successful deployment:

1. Set up custom domain
2. Configure analytics
3. Set up monitoring
4. Plan scaling strategy
5. Consider CDN for images
